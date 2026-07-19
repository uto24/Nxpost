import os
import re
import random
import smtplib
import hashlib
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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

# ================= REQUEST MODELS =================
class SignupRequest(BaseModel):
    action: str  # 'send_otp' অথবা 'verify_and_register'
    email: str
    password: str = None
    nickname: str = None
    device_fingerprint: str = None
    referrer_id: int = None
    otp_code: str = None

# ================= SECURE PASSWORD HASHING =================
def hash_password(password: str) -> str:
    salt = "BLOCK_BUSTER_SALT_2026"
    return hashlib.sha256((password + salt).encode()).hexdigest()

# ================= SMTP OTP EMAILING =================
def send_via_brevo(recipient: str, otp: str) -> bool:
    msg = MIMEMultipart()
    msg['From'] = '"Block Buster Spport" <rakib03x@gmail.com>'
    msg['To'] = recipient
    msg['Subject'] = 'Your Block Buster OTP Verification Code'
    html = f"""
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #2E7D32;">Email Verification Code</h2>
        <p>Use the following One-Time Password (OTP) to complete your signup process:</p>
        <h1 style="background: #E8F5E9; padding: 10px; display: inline-block; border-radius: 5px; color: #1B5E20; letter-spacing: 2px;">{otp}</h1>
        <p style="font-size: 11px; color: #888;">Valid for 5 minutes.</p>
    </div>
    """
    msg.attach(MIMEText(html, 'html'))
    try:
        with smtplib.SMTP('smtp-relay.brevo.com', 587) as server:
            server.starttls()
            server.login('b28253001@smtp-brevo.com', 'xsmtpsib-353d161fe87c9a2398286c939abd2d88eded89aa076c0b476a489151d2928745-r81KzrWee8rBANwz')
            server.sendmail('b28253001@smtp-brevo.com', recipient, msg.as_string())
        return True
    except Exception as e:
        print(f"Brevo SMTP Error: {e}")
        return False

def send_via_resend(recipient: str, otp: str) -> bool:
    msg = MIMEMultipart()
    msg['From'] = '"Block Buster Support" <rakib03x@gmail.com>'
    msg['To'] = recipient
    msg['Subject'] = 'Your Block Buster OTP Verification Code'
    html = f"""
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #2E7D32;">Email Verification Code</h2>
        <p>Use the following One-Time Password (OTP) to complete your signup process:</p>
        <h1 style="background: #E8F5E9; padding: 10px; display: inline-block; border-radius: 5px; color: #1B5E20; letter-spacing: 2px;">{otp}</h1>
        <p style="font-size: 11px; color: #888;">Valid for 5 minutes.</p>
    </div>
    """
    msg.attach(MIMEText(html, 'html'))
    try:
        with smtplib.SMTP('smtp.resend.com', 587) as server:
            server.starttls()
            server.login('resend', 're_3t1FPYUa_5kzAJGgftdZx8MkEaXvUsYAP')
            server.sendmail('onboarding@resend.dev', recipient, msg.as_string())
        return True
    except Exception as e:
        print(f"Resend SMTP Error: {e}")
        return False

# ================= SIGNUP HANDLER ROUTE =================
@app.post("/api/signup")
def signup_api(req: SignupRequest):
    # জিমেইল ফরম্যাট চেক
    if not re.match(r"^[a-zA-Z0-9._%+-]+@gmail\.com$", req.email):
        raise HTTPException(status_code=400, detail="শুধুমাত্র @gmail.com ইমেইল গ্রহণযোগ্য।")

    # কন্ডিশন ১: ওটিপি সেন্ড প্রসেস
    if req.action == "send_otp":
        # ডিভাইস চেক
        device_res = supabase.table("users").select("id").eq("device_fingerprint", req.device_fingerprint).execute()
        if device_res.data:
            raise HTTPException(status_code=400, detail="এই ডিভাইসে ইতিমধ্যেই একটি অ্যাকাউন্ট খোলা রয়েছে।")

        # ইমেইল চেক
        email_res = supabase.table("users").select("id").eq("email", req.email).execute()
        if email_res.data:
            raise HTTPException(status_code=400, detail="এই ইমেইলে ইতিমধ্যেই একটি অ্যাকাউন্ট রয়েছে।")

        # ওটিপি জেনারেট (৬ ডিজিট)
        otp = str(random.randint(100000, 999999))
        
        # পূর্বের ওটিপি ডাটা ক্লিন ও নতুন এন্ট্রি সেভ
        supabase.table("otp_codes").delete().eq("email", req.email).execute()
        supabase.table("otp_codes").insert({"email": req.email, "otp_code": otp}).execute()

        # SMTP দৈনিক লিমিট ও ফেইলওভার চেক
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        b_count = supabase.table("email_logs").select("id", count="exact").eq("provider", "Brevo").gte("sent_at", today_start).execute().count or 0
        r_count = supabase.table("email_logs").select("id", count="exact").eq("provider", "Resend").gte("sent_at", today_start).execute().count or 0

        sent = False
        provider_used = ""
        if b_count < 290:
            if send_via_brevo(req.email, otp):
                sent, provider_used = True, "Brevo"
        elif r_count < 98:
            if send_via_resend(req.email, otp):
                sent, provider_used = True, "Resend"

        if sent:
            supabase.table("email_logs").insert({"provider": provider_used, "recipient": req.email}).execute()
            return {"success": True, "message": "আপনার ইমেইলে ওটিপি কোড পাঠানো হয়েছে।"}
        else:
            raise HTTPException(status_code=500, detail="সার্ভার থেকে ইমেইল পাঠাতে সমস্যা হচ্ছে। পরে চেষ্টা করুন।")

    # কন্ডিশন ২: ওটিপি ভেরিফিকেশন ও অ্যাকাউন্ট তৈরি
    elif req.action == "verify_and_register":
        if not req.otp_code or not req.password:
            raise HTTPException(status_code=400, detail="পাসওয়ার্ড এবং ওটিপি কোড আবশ্যক।")

        # ডাটাবেজে ওটিপি কোড মেলানো
        otp_res = supabase.table("otp_codes").select("*").eq("email", req.email).eq("otp_code", req.otp_code).execute()
        if not otp_res.data:
            raise HTTPException(status_code=400, detail="ভুল ওটিপি কোড। দয়া করে আবার চেক করুন।")

        # সফল হলে ওটিপি ডাটা মুছে ফেলা
        supabase.table("otp_codes").delete().eq("email", req.email).execute()

        # নিকনেম জেনারেট (User30795512)
        random_num = random.randint(10000000, 99999999)
        nickname = req.nickname if req.nickname else f"User{random_num}"

        # পাসওয়ার্ড হ্যাশ করা
        hashed = hash_password(req.password)

        # ইউজার ডেটাবেজে সেভ
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

        # রেফারেল এন্ট্রি হ্যান্ডলিং
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
