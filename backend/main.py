import os
from typing import Optional, List
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env.local in the parent Next.js project
load_dotenv(dotenv_path="../.env.local")

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase variables (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY) in .env.local")

# Create Supabase Client using the service_role key to bypass RLS for write operations
supabase_client: Client = create_client(supabase_url, supabase_key)

app = FastAPI(title="SOCD Portal FastAPI Backend", version="1.0.0")

# Dependency to verify the user session from the Authorization header
def verify_session(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token")

    token = authorization.split(" ")[1]
    try:
        user_resp = supabase_client.auth.get_user(token)
        return user_resp.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized session: {str(e)}")

# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────
class PersonnelBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    office: str
    local_ext: Optional[str] = None
    portal_role: Optional[str] = None  # "RSSO" or "PSO"

class StatusUpdate(BaseModel):
    status: str

class ActivityCreate(BaseModel):
    pap_id: str
    activity_type: str   # "monthly" | "quarterly" | "one-time"
    quarter: Optional[str] = None
    month: Optional[str] = None
    output_deliverable: str
    deadline: str        # ISO date string
    response_rate_fillable: bool = False

class ActivityPatch(BaseModel):
    actual_submission: Optional[str] = None
    rsso_remarks: Optional[str] = None
    pso_remarks: Optional[str] = None
    response_rate: Optional[float] = None
    rating_quantity: Optional[float] = None


# ─────────────────────────────────────────────
# Personnel Endpoints
# ─────────────────────────────────────────────
@app.get("/api/me")
def get_me(user=Depends(verify_session)):
    """Return the current authenticated user's personnel record (including portal_role)."""
    try:
        response = supabase_client.table("personnel").select("*").eq("email", user.email).single().execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Personnel record not found for {user.email}: {str(e)}")

@app.get("/api/personnel")
def get_personnel(user=Depends(verify_session)):
    try:
        response = supabase_client.table("personnel").select("*").order("office").order("name").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@app.post("/api/personnel")
def add_personnel(staff: PersonnelBase, create_account: bool = False, user=Depends(verify_session)):
    data = {
        "name": staff.name,
        "email": staff.email,
        "role": staff.role,
        "unit": staff.office,
        "office": staff.office,
        "local_ext": staff.local_ext,
        "portal_role": staff.portal_role,
        "status": "in-office"
    }

    try:
        response = supabase_client.table("personnel").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create personnel record")

        if create_account:
            try:
                supabase_client.auth.admin.invite_user_by_email(staff.email, {
                    "data": {"name": staff.name, "role": staff.role}
                })
            except Exception as invite_err:
                return {
                    "success": True,
                    "data": response.data[0],
                    "invite_error": f"Added staff but invite failed: {str(invite_err)}"
                }

        return {"success": True, "data": response.data[0]}
    except Exception as e:
        if "violates unique constraint" in str(e) or "23505" in str(e):
            raise HTTPException(status_code=400, detail="A staff member with this email already exists.")
        raise HTTPException(status_code=500, detail=f"Error creating staff: {str(e)}")

@app.put("/api/personnel/{id}")
def update_personnel(id: str, staff: PersonnelBase, user=Depends(verify_session)):
    data = {
        "name": staff.name,
        "email": staff.email,
        "role": staff.role,
        "unit": staff.office,
        "office": staff.office,
        "local_ext": staff.local_ext,
        "portal_role": staff.portal_role,
    }

    try:
        response = supabase_client.table("personnel").update(data).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Personnel record not found")
        return {"success": True, "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating staff: {str(e)}")

@app.patch("/api/personnel/{id}/status")
def update_status(id: str, body: StatusUpdate, user=Depends(verify_session)):
    if body.status not in ["in-office", "wfh", "on-leave", "fieldwork"]:
        raise HTTPException(status_code=400, detail="Invalid status value")

    try:
        response = supabase_client.table("personnel").update({"status": body.status}).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Personnel record not found")
        return {"success": True, "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating status: {str(e)}")

@app.delete("/api/personnel/{id}")
def delete_personnel(id: str, user=Depends(verify_session)):
    try:
        supabase_client.table("personnel").delete().eq("id", id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting staff: {str(e)}")


# ─────────────────────────────────────────────
# PAP Endpoints
# ─────────────────────────────────────────────
@app.get("/api/paps")
def get_paps(user=Depends(verify_session)):
    """Return all PAPs for the dropdown selector."""
    try:
        response = supabase_client.table("paps").select("*").order("name").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch PAPs: {str(e)}")


# ─────────────────────────────────────────────
# PAP Monitoring Endpoints
# ─────────────────────────────────────────────
@app.get("/api/monitoring")
def get_monitoring(
    pap_id: Optional[str] = None,
    quarter: Optional[str] = None,
    month: Optional[str] = None,
    user=Depends(verify_session)
):
    """Return monitoring activities, optionally filtered by PAP, quarter, and month."""
    try:
        query = (
            supabase_client
            .table("pap_monitoring")
            .select("*, paps(name)")
            .order("deadline")
        )
        if pap_id:
            query = query.eq("pap_id", pap_id)
        if quarter:
            query = query.eq("quarter", quarter)
        if month:
            query = query.eq("month", month)

        response = query.execute()
        # Flatten pap name into each row
        results = []
        for row in (response.data or []):
            pap_info = row.pop("paps", None)
            if pap_info:
                row["pap_name"] = pap_info.get("name")
            results.append(row)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch monitoring data: {str(e)}")

@app.post("/api/monitoring")
def add_activity(activity: ActivityCreate, user=Depends(verify_session)):
    """Add a new PAP monitoring activity (RSSO-only, enforced in frontend)."""
    data = {
        "pap_id": activity.pap_id,
        "activity_type": activity.activity_type,
        "quarter": activity.quarter,
        "month": activity.month,
        "output_deliverable": activity.output_deliverable,
        "deadline": activity.deadline,
        "response_rate_fillable": activity.response_rate_fillable,
    }
    try:
        response = supabase_client.table("pap_monitoring").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create activity")
        return {"success": True, "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating activity: {str(e)}")

@app.patch("/api/monitoring/{id}")
def patch_activity(id: str, body: ActivityPatch, user=Depends(verify_session)):
    """Partial update for an activity (actual submission, remarks, response rate, rating_quantity)."""
    update_data = {}
    if body.actual_submission is not None:
        update_data["actual_submission"] = body.actual_submission
    if body.rsso_remarks is not None:
        update_data["rsso_remarks"] = body.rsso_remarks
    if body.pso_remarks is not None:
        update_data["pso_remarks"] = body.pso_remarks
    if body.response_rate is not None:
        update_data["response_rate"] = body.response_rate
    if body.rating_quantity is not None:
        update_data["rating_quantity"] = body.rating_quantity

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        response = supabase_client.table("pap_monitoring").update(update_data).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Activity not found")
        return {"success": True, "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating activity: {str(e)}")

@app.delete("/api/monitoring/{id}")
def delete_activity(id: str, user=Depends(verify_session)):
    """Delete a monitoring activity (RSSO-only, enforced in frontend)."""
    try:
        supabase_client.table("pap_monitoring").delete().eq("id", id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting activity: {str(e)}")
