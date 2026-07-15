# import os
# from typing import Optional, List
# from fastapi import FastAPI, Header, HTTPException, Depends
# from pydantic import BaseModel, EmailStr
# from supabase import create_client, Client
# from dotenv import load_dotenv

# # Load environment variables from .env.local in the parent Next.js project
# load_dotenv(dotenv_path="../.env.local")

# supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# if not supabase_url or not supabase_key:
#     raise ValueError("Missing Supabase variables (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY) in .env.local")

# # Create Supabase Client using the service_role key to bypass RLS for write operations
# supabase_client: Client = create_client(supabase_url, supabase_key)

# app = FastAPI(title="SOCD Portal FastAPI Backend", version="1.0.0")

# # Dependency to verify the user session from the Authorization header
# def verify_session(authorization: Optional[str] = Header(None)):
#     if not authorization or not authorization.startswith("Bearer "):
#         raise HTTPException(status_code=401, detail="Missing or invalid authentication token")

#     token = authorization.split(" ")[1]
#     try:
#         user_resp = supabase_client.auth.get_user(token)
#         user = user_resp.user
        
#         # Verify the user email exists in the personnel directory
#         personnel_res = supabase_client.table("personnel").select("id").eq("email", user.email).execute()
#         if not personnel_res.data:
#             raise HTTPException(status_code=403, detail="Access Denied: You are not registered in the personnel directory.")
            
#         return user
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=401, detail=f"Unauthorized session: {str(e)}")

# # Dependency to verify the user is a SuperAdmin
# def verify_superadmin(user=Depends(verify_session)):
#     try:
#         response = supabase_client.table("personnel").select("portal_role").eq("email", user.email).single().execute()
#         if not response.data or response.data.get("portal_role") != "SuperAdmin":
#             raise HTTPException(status_code=403, detail="Permission Denied: Only SuperAdmins can manage personnel records.")
#         return user
#     except Exception as e:
#         if isinstance(e, HTTPException):
#             raise
#         raise HTTPException(status_code=403, detail="Permission Denied: Unable to verify administrator status.")


# # ─────────────────────────────────────────────
# # Pydantic Models
# # ─────────────────────────────────────────────
# class PersonnelBase(BaseModel):
#     name: str
#     email: EmailStr
#     role: str
#     office: str
#     local_ext: Optional[str] = None
#     portal_role: Optional[str] = None  # "RSSO" or "PSO"

# class StatusUpdate(BaseModel):
#     status: str

# class ActivityCreate(BaseModel):
#     pap_id: str
#     activity_type: str   # "monthly" | "quarterly" | "one-time"
#     quarter: Optional[str] = None
#     month: Optional[str] = None
#     output_deliverable: str
#     deadline: str        # ISO date string
#     response_rate_fillable: bool = False

# class ActivityPatch(BaseModel):
#     actual_submission: Optional[str] = None
#     rsso_remarks: Optional[str] = None
#     pso_remarks: Optional[str] = None
#     response_rate: Optional[float] = None
#     rating_quantity: Optional[float] = None


# # ─────────────────────────────────────────────
# # Personnel Endpoints
# # ─────────────────────────────────────────────
# @app.get("/api/me")
# def get_me(user=Depends(verify_session)):
#     """Return the current authenticated user's personnel record (including portal_role)."""
#     try:
#         response = supabase_client.table("personnel").select("*").eq("email", user.email).single().execute()
#         return response.data
#     except Exception as e:
#         raise HTTPException(status_code=404, detail=f"Personnel record not found for {user.email}: {str(e)}")

# @app.get("/api/personnel")
# def get_personnel(user=Depends(verify_session)):
#     try:
#         response = supabase_client.table("personnel").select("*").order("office").order("name").execute()
#         return response.data
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

# @app.post("/api/personnel")
# def add_personnel(staff: PersonnelBase, create_account: bool = True, user=Depends(verify_superadmin)):
#     data = {
#         "name": staff.name,
#         "email": staff.email,
#         "role": staff.role,
#         "unit": staff.office,
#         "office": staff.office,
#         "local_ext": staff.local_ext,
#         "portal_role": staff.portal_role,
#         "status": "in-office"
#     }

#     try:
#         response = supabase_client.table("personnel").insert(data).execute()
#         if not response.data:
#             raise HTTPException(status_code=400, detail="Failed to create personnel record")

#         if create_account:
#             try:
#                 supabase_client.auth.admin.invite_user_by_email(staff.email, {
#                     "data": {"name": staff.name, "role": staff.role}
#                 })
#             except Exception as invite_err:
#                 return {
#                     "success": True,
#                     "data": response.data[0],
#                     "invite_error": f"Added staff but invite failed: {str(invite_err)}"
#                 }

#         return {"success": True, "data": response.data[0]}
#     except Exception as e:
#         if "violates unique constraint" in str(e) or "23505" in str(e):
#             raise HTTPException(status_code=400, detail="A staff member with this email already exists.")
#         raise HTTPException(status_code=500, detail=f"Error creating staff: {str(e)}")

# @app.put("/api/personnel/{id}")
# def update_personnel(id: str, staff: PersonnelBase, user=Depends(verify_superadmin)):
#     data = {
#         "name": staff.name,
#         "email": staff.email,
#         "role": staff.role,
#         "unit": staff.office,
#         "office": staff.office,
#         "local_ext": staff.local_ext,
#         "portal_role": staff.portal_role,
#     }

#     try:
#         response = supabase_client.table("personnel").update(data).eq("id", id).execute()
#         if not response.data:
#             raise HTTPException(status_code=404, detail="Personnel record not found")
#         return {"success": True, "data": response.data[0]}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error updating staff: {str(e)}")

# @app.patch("/api/personnel/{id}/status")
# def update_status(id: str, body: StatusUpdate, user=Depends(verify_superadmin)):
#     if body.status not in ["in-office", "wfh", "on-leave", "fieldwork"]:
#         raise HTTPException(status_code=400, detail="Invalid status value")

#     try:
#         response = supabase_client.table("personnel").update({"status": body.status}).eq("id", id).execute()
#         if not response.data:
#             raise HTTPException(status_code=404, detail="Personnel record not found")
#         return {"success": True, "data": response.data[0]}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error updating status: {str(e)}")

# @app.delete("/api/personnel/{id}")
# def delete_personnel(id: str, user=Depends(verify_superadmin)):
#     try:
#         supabase_client.table("personnel").delete().eq("id", id).execute()
#         return {"success": True}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error deleting staff: {str(e)}")



# # ─────────────────────────────────────────────
# # PAP Endpoints
# # ─────────────────────────────────────────────
# @app.get("/api/paps")
# def get_paps(user=Depends(verify_session)):
#     """Return all PAPs for the dropdown selector."""
#     try:
#         response = supabase_client.table("paps").select("*").order("name").execute()
#         return response.data
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to fetch PAPs: {str(e)}")


# # ─────────────────────────────────────────────
# # PAP Monitoring Endpoints
# # ─────────────────────────────────────────────
# @app.get("/api/monitoring")
# def get_monitoring(
#     pap_id: Optional[str] = None,
#     quarter: Optional[str] = None,
#     month: Optional[str] = None,
#     user=Depends(verify_session)
# ):
#     """Return monitoring activities, optionally filtered by PAP, quarter, and month."""
#     try:
#         query = (
#             supabase_client
#             .table("pap_monitoring")
#             .select("*, paps(name)")
#             .order("deadline")
#         )
#         if pap_id:
#             query = query.eq("pap_id", pap_id)
#         if quarter:
#             query = query.eq("quarter", quarter)
#         if month:
#             query = query.eq("month", month)

#         response = query.execute()
#         # Flatten pap name into each row
#         results = []
#         for row in (response.data or []):
#             pap_info = row.pop("paps", None)
#             if pap_info:
#                 row["pap_name"] = pap_info.get("name")
#             results.append(row)
#         return results
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to fetch monitoring data: {str(e)}")

# @app.post("/api/monitoring")
# def add_activity(activity: ActivityCreate, user=Depends(verify_session)):
#     """Add a new PAP monitoring activity (RSSO-only, enforced in frontend)."""
#     data = {
#         "pap_id": activity.pap_id,
#         "activity_type": activity.activity_type,
#         "quarter": activity.quarter,
#         "month": activity.month,
#         "output_deliverable": activity.output_deliverable,
#         "deadline": activity.deadline,
#         "response_rate_fillable": activity.response_rate_fillable,
#     }
#     try:
#         response = supabase_client.table("pap_monitoring").insert(data).execute()
#         if not response.data:
#             raise HTTPException(status_code=400, detail="Failed to create activity")
#         return {"success": True, "data": response.data[0]}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error creating activity: {str(e)}")

# @app.patch("/api/monitoring/{id}")
# def patch_activity(id: str, body: ActivityPatch, user=Depends(verify_session)):
#     """Partial update for an activity (actual submission, remarks, response rate, rating_quantity)."""
#     update_data = {}
#     if body.actual_submission is not None:
#         update_data["actual_submission"] = body.actual_submission
#     if body.rsso_remarks is not None:
#         update_data["rsso_remarks"] = body.rsso_remarks
#     if body.pso_remarks is not None:
#         update_data["pso_remarks"] = body.pso_remarks
#     if body.response_rate is not None:
#         update_data["response_rate"] = body.response_rate
#     if body.rating_quantity is not None:
#         update_data["rating_quantity"] = body.rating_quantity

#     if not update_data:
#         raise HTTPException(status_code=400, detail="No fields to update")
#     try:
#         response = supabase_client.table("pap_monitoring").update(update_data).eq("id", id).execute()
#         if not response.data:
#             raise HTTPException(status_code=404, detail="Activity not found")
#         return {"success": True, "data": response.data[0]}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error updating activity: {str(e)}")

# @app.delete("/api/monitoring/{id}")
# def delete_activity(id: str, user=Depends(verify_session)):
#     """Delete a monitoring activity (RSSO-only, enforced in frontend)."""
#     try:
#         supabase_client.table("pap_monitoring").delete().eq("id", id).execute()
#         return {"success": True}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error deleting activity: {str(e)}")



import os
import uuid
from typing import Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

import bcrypt
from jose import jwt, JWTError

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
if os.path.exists(".env.local"):
    load_dotenv(dotenv_path=".env.local")
else:
    load_dotenv(dotenv_path="../.env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET   = os.getenv("JWT_SECRET")
JWT_ALGO     = "HS256"
JWT_HOURS    = 8

if not DATABASE_URL:
    raise ValueError("Missing DATABASE_URL in .env.local")
if not JWT_SECRET:
    raise ValueError("Missing JWT_SECRET in .env.local")

engine       = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


app = FastAPI(title="SOCD Portal FastAPI Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# DB Dependency
# ─────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─────────────────────────────────────────────
# Auth Helpers
# ─────────────────────────────────────────────
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_token(email: str) -> str:
    exp = datetime.utcnow() + timedelta(hours=JWT_HOURS)
    return jwt.encode({"sub": email, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ─────────────────────────────────────────────
# Auth Dependencies
# ─────────────────────────────────────────────
def verify_session(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token")
    email = decode_token(authorization.split(" ")[1])
    row = db.execute(
        text("SELECT * FROM personnel WHERE email = :email"), {"email": email}
    ).fetchone()
    if not row:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: You are not registered in the personnel directory. Please contact a SuperAdmin."
        )
    return row

def verify_superadmin(user=Depends(verify_session)):
    if user.portal_role != "SuperAdmin":
        raise HTTPException(
            status_code=403,
            detail="Permission Denied: Only SuperAdmins can perform this action."
        )
    return user

# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SetPasswordRequest(BaseModel):
    email: EmailStr
    password: str

class PersonnelBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    office: str
    local_ext: Optional[str] = None
    portal_role: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str

class ActivityCreate(BaseModel):
    pap_id: str
    activity_type: str
    quarter: Optional[str] = None
    month: Optional[str] = None
    output_deliverable: str
    deadline: str
    response_rate_fillable: bool = False

class ActivityPatch(BaseModel):
    actual_submission: Optional[str] = None
    rsso_remarks: Optional[str] = None
    pso_remarks: Optional[str] = None
    response_rate: Optional[float] = None
    rating_quantity: Optional[float] = None

# ─────────────────────────────────────────────
# Auth Endpoints
# ─────────────────────────────────────────────
@app.post("/api/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password — returns a JWT token."""
    row = db.execute(
        text("SELECT * FROM personnel WHERE email = :email"), {"email": body.email}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not row.password_hash:
        raise HTTPException(status_code=401, detail="Account not activated. Contact a SuperAdmin to set your password.")
    if not check_password(body.password, row.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(body.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": dict(row._mapping)
    }

@app.post("/api/auth/set-password")
def set_password(body: SetPasswordRequest, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    """SuperAdmin sets or resets a personnel member's password."""
    hashed = hash_password(body.password)
    result = db.execute(
        text("UPDATE personnel SET password_hash = :hash WHERE email = :email"),
        {"hash": hashed, "email": body.email}
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return {"success": True, "message": f"Password set for {body.email}"}

# ─────────────────────────────────────────────
# Me Endpoint
# ─────────────────────────────────────────────
@app.get("/api/me")
def get_me(user=Depends(verify_session)):
    """Return the current authenticated user's personnel record."""
    return dict(user._mapping)

# ─────────────────────────────────────────────
# Personnel Endpoints
# ─────────────────────────────────────────────
@app.get("/api/personnel")
def get_personnel(user=Depends(verify_session), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT * FROM personnel ORDER BY unit, name")
    ).fetchall()
    return [dict(r._mapping) for r in rows]

@app.post("/api/personnel")
def add_personnel(staff: PersonnelBase, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    new_id = str(uuid.uuid4())
    try:
        db.execute(text("""
            INSERT INTO personnel (id, name, email, role, unit, office, local_ext, portal_role, status)
            VALUES (:id, :name, :email, :role, :unit, :office, :local_ext, :portal_role, 'in-office')
        """), {
            "id": new_id, "name": staff.name, "email": staff.email,
            "role": staff.role, "unit": staff.office, "office": staff.office,
            "local_ext": staff.local_ext, "portal_role": staff.portal_role,
        })
        db.commit()
        row = db.execute(text("SELECT * FROM personnel WHERE id = :id"), {"id": new_id}).fetchone()
        return {"success": True, "data": dict(row._mapping)}
    except Exception as e:
        db.rollback()
        if "Duplicate entry" in str(e) or "1062" in str(e):
            raise HTTPException(status_code=400, detail="A staff member with this email already exists.")
        raise HTTPException(status_code=500, detail=f"Error creating staff: {str(e)}")

@app.put("/api/personnel/{id}")
def update_personnel(id: str, staff: PersonnelBase, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    try:
        result = db.execute(text("""
            UPDATE personnel
            SET name=:name, email=:email, role=:role,
                unit=:unit, office=:office, local_ext=:local_ext, portal_role=:portal_role
            WHERE id=:id
        """), {
            "name": staff.name, "email": staff.email, "role": staff.role,
            "unit": staff.office, "office": staff.office,
            "local_ext": staff.local_ext, "portal_role": staff.portal_role, "id": id,
        })
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Personnel record not found")
        row = db.execute(text("SELECT * FROM personnel WHERE id = :id"), {"id": id}).fetchone()
        return {"success": True, "data": dict(row._mapping)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating staff: {str(e)}")

@app.patch("/api/personnel/{id}/status")
def update_status(id: str, body: StatusUpdate, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    if body.status not in ["in-office", "wfh", "on-leave", "fieldwork"]:
        raise HTTPException(status_code=400, detail="Invalid status value")
    try:
        result = db.execute(
            text("UPDATE personnel SET status=:status WHERE id=:id"),
            {"status": body.status, "id": id}
        )
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Personnel record not found")
        row = db.execute(text("SELECT * FROM personnel WHERE id = :id"), {"id": id}).fetchone()
        return {"success": True, "data": dict(row._mapping)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating status: {str(e)}")

@app.delete("/api/personnel/{id}")
def delete_personnel(id: str, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM personnel WHERE id=:id"), {"id": id})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting staff: {str(e)}")

# ─────────────────────────────────────────────
# PAP Endpoints
# ─────────────────────────────────────────────
@app.get("/api/paps")
def get_paps(user=Depends(verify_session), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM paps ORDER BY name")).fetchall()
    return [dict(r._mapping) for r in rows]

# ─────────────────────────────────────────────
# PAP Monitoring Endpoints
# ─────────────────────────────────────────────
@app.get("/api/monitoring")
def get_monitoring(
    pap_id: Optional[str] = None,
    quarter: Optional[str] = None,
    month: Optional[str] = None,
    user=Depends(verify_session),
    db: Session = Depends(get_db)
):
    query  = "SELECT pm.*, p.name AS pap_name FROM pap_monitoring pm LEFT JOIN paps p ON pm.pap_id = p.id WHERE 1=1"
    params = {}
    if pap_id:
        query += " AND pm.pap_id = :pap_id";  params["pap_id"]  = pap_id
    if quarter:
        query += " AND pm.quarter = :quarter"; params["quarter"] = quarter
    if month:
        query += " AND pm.month = :month";     params["month"]   = month
    query += " ORDER BY pm.deadline"
    rows = db.execute(text(query), params).fetchall()
    return [dict(r._mapping) for r in rows]

@app.post("/api/monitoring")
def add_activity(activity: ActivityCreate, user=Depends(verify_session), db: Session = Depends(get_db)):
    new_id = str(uuid.uuid4())
    try:
        db.execute(text("""
            INSERT INTO pap_monitoring
            (id, pap_id, activity_type, quarter, month, output_deliverable, deadline, response_rate_fillable)
            VALUES (:id, :pap_id, :activity_type, :quarter, :month, :output_deliverable, :deadline, :rfill)
        """), {
            "id": new_id, "pap_id": activity.pap_id,
            "activity_type": activity.activity_type, "quarter": activity.quarter,
            "month": activity.month, "output_deliverable": activity.output_deliverable,
            "deadline": activity.deadline, "rfill": activity.response_rate_fillable,
        })
        db.commit()
        row = db.execute(text("SELECT * FROM pap_monitoring WHERE id = :id"), {"id": new_id}).fetchone()
        return {"success": True, "data": dict(row._mapping)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating activity: {str(e)}")

@app.patch("/api/monitoring/{id}")
def patch_activity(id: str, body: ActivityPatch, user=Depends(verify_session), db: Session = Depends(get_db)):
    fields = {k: v for k, v in {
        "actual_submission": body.actual_submission,
        "rsso_remarks": body.rsso_remarks,
        "pso_remarks": body.pso_remarks,
        "response_rate": body.response_rate,
        "rating_quantity": body.rating_quantity,
    }.items() if v is not None}

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = id
    try:
        result = db.execute(
            text(f"UPDATE pap_monitoring SET {set_clause} WHERE id = :id"), fields
        )
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Activity not found")
        row = db.execute(text("SELECT * FROM pap_monitoring WHERE id = :id"), {"id": id}).fetchone()
        return {"success": True, "data": dict(row._mapping)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating activity: {str(e)}")

@app.delete("/api/monitoring/{id}")
def delete_activity(id: str, user=Depends(verify_session), db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM pap_monitoring WHERE id=:id"), {"id": id})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting activity: {str(e)}")
