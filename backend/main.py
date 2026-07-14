import os
from typing import Optional
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
        # Validate the token directly using Supabase Auth
        user_resp = supabase_client.auth.get_user(token)
        return user_resp.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized session: {str(e)}")

# Request Validation Models
class PersonnelBase(BaseModel):
    name: str
    email: EmailStr
    role: str
    office: str
    local_ext: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str

# Endpoints
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
        "unit": staff.office,  # Map unit to office
        "office": staff.office,
        "local_ext": staff.local_ext,
        "status": "in-office"
    }
    
    try:
        # Insert into personnel table
        response = supabase_client.table("personnel").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create personnel record")
        
        # Optionally trigger Supabase Auth invitation email
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
        "local_ext": staff.local_ext
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
        response = supabase_client.table("personnel").delete().eq("id", id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting staff: {str(e)}")
