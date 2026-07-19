import os
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class LoginRequest(BaseModel):
    email: str
    password: str

def hash_password(password: str) -> str:
    salt = "BLOCK_BUSTER_SALT_2026"
    return hashlib.sha256((password + salt).encode()).hexdigest()

@app.post("/api/login")
def login_api(req: LoginRequest):
    # ইমেইল দিয়ে ইউজার কুয়েরি
    user_res = supabase.table("users").select("*").eq("email", req.email).execute()
    if not user_res.data:
        raise HTTPException(status_code=400, detail="এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।")
    
    user = user_res.data[0]
    
    # পাসওয়ার্ড হ্যাশ মিলিয়ে দেখা
    hashed_input = hash_password(req.password)
    if user.get("password_hash") != hashed_input:
        raise HTTPException(status_code=400, detail="ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।")

    # পাসওয়ার্ড হ্যাশ ছাড়া বাকি ডেটা পাঠানো (নিরাপত্তার জন্য)
    user.pop("password_hash", None)
    return {"success": True, "message": "লগইন সফল হয়েছে", "user": user}
