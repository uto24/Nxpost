import os
import re
import random
import hashlib
import requests
from datetime import datetime, timezone

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

# Supabase ক্লায়েন্ট কানেকশন
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ================= এপিআই কি কনফিগারেশন সেকশন =================
# দয়া করে নিচে আপনার জেনারেট করা নতুন সিক্রেট কি-গুলো কোটেশনের ভেতরে বসিয়ে দিন:

BREVO_API_KEY = "YOUR_NEW_BREVO_API_KEY_HERE"    # এখানে আপনার নতুন 'xkeysib-...' কী-টি বসান
RESEND_API_KEY = "YOUR_NEW_RESEND_API_KEY_HERE"  # এখানে আপনার নতুন 're_...' কী-টি বসান
SENDER_EMAIL = "rakib03x@gmail.com"               # আপনার ভেরিফাইড Brevo প্রেরক ইমেইল


# ================= REQUEST MODELS =================
class SignupRequest(BaseModel):
    action: str  # 'send_otp' অথবা 'verify_and_register'
    email: str
    password: str = None
    nickname: str = None
    device_fingerprint: str = None
    referrer_id: int = None
    otp_code: str = None

# ================= নিরাপদ পাসওয়ার্ড হ্যাশিং =================
def hash_password(password: str) -> str:
    salt = "BLOCK_BUSTER_SALT_2026"
    return hashlib.sha256((password + salt).encode()).hexdigest()

# ================= ১০০% ফাস্ট ও সিকিউর BREVO HTTP API =================
def send_via_brevo_api(recipient: str, otp: str) -> bool:
    url = "https://api.brevo.com/v3/smtp/email"
    
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }
    payload = {
        "sender": {"name": "Block Buster Support", "email": SENDER_EMAIL},
        "to": [{"email": recipient}],
        "subject": "Your Block Buster OTP Verification Code",
        "htmlContent": f"""
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #2E7D32;">Email Verification Code</h2>
            <p>Use the following One-Time Password (OTP) to complete your signup process:</p>
            <h1 style="background: #E8F5E9; padding: 10px; display: inline-block; border-radius: 5px; color: #1B5E20; letter-spacing: 2px;">{otp}</h1>
            <p style="font-size: 11px; color: #888;">Valid for 5 minutes. Do not share this code.</p>
        </div>
        """
    }
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code in [200, 201, 202]:
            return True
        else:
            print(f"Brevo API Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Brevo HTTP Request Connection Error: {e}")
        return False

# ================= ১০০% ফাস্ট ও সিকিউর RESEND HTTP API =================
def send_via_resend_api(recipient: str, otp: str) -> bool:
    url = "https://api.resend.com/emails"
    
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": "onboarding@resend.dev",
        "to": [recipient],
        "subject": "Your Block Buster OTP Verification Code",
        "html": f"""
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #2E7D32;">Email Verification Code</h2>
            <p>Use the following One-Time Password (OTP) to complete your signup process:</p>
            <h1 style="background: #E8F5E9; padding: 10px; display: inline-block; border-radius: 5px; color: #1B5E20; letter-spacing: 2px;">{otp}</h1>
            <p style="font-size: 11px; color: #888;">Valid for 5 minutes. Do not share this code.</p>
        </div>
        """
    }
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code in [200, 201, 202]:
            return True
        else:
            print(f"Resend API Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Resend HTTP Request Connection Error: {e}")
        return False

# ================= SIGNUP ROUTE HANDLER =================
@app.post("/api/signup")
def signup_api(req: SignupRequest):
    if not re.match(r"^[a-zA-Z0-9._%+-]+@gmail\.com$", req.email):
        raise HTTPException(status_code=400, detail="শুধুমাত্র @gmail.com ইমেইল গ্রহণযোগ্য।")

    if req.action == "send_otp":
        device_res = supabase.table("users").select("id").eq("device_fingerprint", req.device_fingerprint).execute()
        if device_res.data:
            raise HTTPException(status_code=400, detail="এই ডিভাইসে ইতিমধ্যেই একটি অ্যাকাউন্ট খোলা রয়েছে।")

        email_res = supabase.table("users").select("id").eq("email", req.email).execute()
        if email_res.data:
            raise HTTPException(status_code=400, detail="এই ইমেইলে ইতিমধ্যেই একটি অ্যাকাউন্ট রয়েছে।")

        otp = str(random.randint(100000, 999999))
        
        supabase.table("otp_codes").delete().eq("email", req.email).execute()
        supabase.table("otp_codes").insert({"email": req.email, "otp_code": otp}).execute()

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        b_count = supabase.table("email_logs").select("id", count="exact").eq("provider", "Brevo").gte("sent_at", today_start).execute().count or 0
        r_count = supabase.table("email_logs").select("id", count="exact").eq("provider", "Resend").gte("sent_at", today_start).execute().count or 0

        sent = False
        provider_used = ""
        
        if b_count < 290:
            if send_via_brevo_api(req.email, otp):
                sent, provider_used = True, "Brevo"
        
        if not sent and r_count < 98:
            if send_via_resend_api(req.email, otp):
                sent, provider_used = True, "Resend"

        if sent:
            supabase.table("email_logs").insert({"provider": provider_used, "recipient": req.email}).execute()
            return {"success": True, "message": "আপনার জিমেইলে ওটিপি কোড পাঠানো হয়েছে।"}
        else:
            raise HTTPException(status_code=500, detail="ইমেইল পাঠাতে समस्या হচ্ছে। Senders বা ডোমেইন কনফিগারেশন চেক করুন।")

    elif req.action == "verify_and_register":
        if not req.otp_code or not req.password:
            raise HTTPException(status_code=400, detail="পাসওয়ার্ড এবং ওটিপি কোড আবশ্যক।")

        now = datetime.now(timezone.utc).isoformat()
        otp_res = supabase.table("otp_codes").select("*").eq("email", req.email).eq("otp_code", req.otp_code).gt("expires_at", now).execute()
        
        if not otp_res.data:
            raise HTTPException(status_code=400, detail="ভুল ওটিপি অথবা ওটিপির ৫ মিনিটের মেয়াদ শেষ হয়ে গেছে।")

        supabase.table("otp_codes").delete().eq("email", req.email).execute()

        random_num = random.randint(10000000, 99999999)
        nickname = req.nickname if req.nickname else f"User{random_num}"
        hashed = hash_password(req.password)

        user_data = {
            "email": req.email,
            "nickname": nickname,
            "password_hash": hashed,
            "device_fingerprint": req.device_fingerprint,
            "age": 20,
            "gender": "Female",
            "country": "Bangladesh"
        }
        
        insert_res = supabase.table("users").insert(user_data).execute()
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="অ্যাকাউন্ট তৈরি করতে ব্যর্থ হয়েছে।")
        
        new_user = insert_res.data[0]

        if req.referrer_id:
            referrer_res = supabase.table("users").select("device_fingerprint").eq("id", req.referrer_id).execute()
            if referrer_res.data:
                referrer = referrer_res.data[0]
                if referrer["device_fingerprint"] != req.device_fingerprint:
                    supabase.table("referrals").insert({
                        "referrer_id": req.referrer_id,
                        "referred_id": new_user["id"],
                        "status": "Processing"
                    }).execute()

        return {"success": True, "message": "নিবন্ধন সফল হয়েছে", "user": new_user}

    else:
        raise HTTPException(status_code=400, detail="Invalid action")
