import os
import re
import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client

# FastAPI ইনিশিয়ালাইজেশন
app = FastAPI()

# CORS পলিসি কনফিগারেশন (ফ্রন্টএন্ড কানেক্টিভিটির জন্য)
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

# ================= PYDANTIC REQUEST MODELS =================

class RegisterRequest(BaseModel):
    email: str
    device_fingerprint: str
    age: int = 20
    gender: str = "Female"
    country: str = "Bangladesh"
    referrer_id: int = None

class HeartbeatRequest(BaseModel):
    userId: int

class AddCoinsRequest(BaseModel):
    userId: int
    coinsEarned: int

class SendOTPRequest(BaseModel):
    email: str
    otp: str

# ================= HELPER FUNCTIONS =================

def send_via_brevo(recipient: str, otp: str) -> bool:
    msg = MIMEMultipart()
    msg['From'] = '"Block Buster Support" <b28253001@smtp-brevo.com>'
    msg['To'] = recipient
    msg['Subject'] = 'Your Block Buster OTP Verification Code'
    
    html = f"""
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #2E7D32;">Block Buster Verification</h2>
        <p>Welcome! Use the following One-Time Password (OTP) to verify your Gmail account:</p>
        <h1 style="background: #E8F5E9; padding: 10px; display: inline-block; border-radius: 5px; color: #1B5E20; letter-spacing: 2px;">{otp}</h1>
        <p style="font-size: 11px; color: #888;">This OTP is valid for 5 minutes. Do not share this with anyone.</p>
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
    msg['From'] = '"Block Buster Support" <onboarding@resend.dev>'
    msg['To'] = recipient
    msg['Subject'] = 'Your Block Buster OTP Verification Code'
    
    html = f"""
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #2E7D32;">Block Buster Verification</h2>
        <p>Welcome! Use the following One-Time Password (OTP) to verify your Gmail account:</p>
        <h1 style="background: #E8F5E9; padding: 10px; display: inline-block; border-radius: 5px; color: #1B5E20; letter-spacing: 2px;">{otp}</h1>
        <p style="font-size: 11px; color: #888;">This OTP is valid for 5 minutes. Do not share this with anyone.</p>
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

# ================= API ROUTE ENDPOINTS =================

@app.post("/api/register")
def register_user(req: RegisterRequest):
    # ১. জিমেইল ভ্যালিডেশন
    if not re.match(r"^[a-zA-Z0-9._%+-]+@gmail\.com$", req.email):
        raise HTTPException(status_code=400, detail="শুধুমাত্র @gmail.com ইমেইল গ্রহণযোগ্য।")

    # ২. ইউনিক ডিভাইস ভ্যালিডেশন
    existing_device = supabase.table("users").select("id").eq("device_fingerprint", req.device_fingerprint).execute()
    if existing_device.data:
        raise HTTPException(status_code=400, detail="এই ডিভাইসে ইতিমধ্যেই একটি অ্যাকাউন্ট তৈরি করা হয়েছে।")

    # ৩. র্যান্ডম নিকনেম জেনারেট (User30795512)
    random_num = random.randint(10000000, 99999999)
    nickname = f"User{random_num}"

    # ৪. ইউজার ডেটাবেজে ইনসার্ট
    user_data = {
        "email": req.email,
        "device_fingerprint": req.device_fingerprint,
        "age": req.age,
        "gender": req.gender,
        "country": req.country,
        "nickname": nickname
    }
    
    insert_res = supabase.table("users").insert(user_data).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে।")
    
    new_user = insert_res.data[0]

    # ৫. সেলফ-রেফার চেক ও পেন্ডিং রেফারেল রিলেশন তৈরি
    if req.referrer_id:
        referrer_res = supabase.table("users").select("device_fingerprint").eq("id", req.referrer_id).execute()
        if referrer_res.data:
            referrer = referrer_res.data[0]
            if referrer["device_fingerprint"] == req.device_fingerprint:
                return {"message": "রেজিস্ট্রেশন সফল, তবে একই ডিভাইসে রেফারেল ব্লক করা হয়েছে।", "user": new_user}

            # পেন্ডিং রেফারেল এন্ট্রি সেভ
            supabase.table("referrals").insert({
                "referrer_id": req.referrer_id,
                "referred_id": new_user["id"],
                "status": "Processing"
            }).execute()

    return {"message": "রেজিস্ট্রেশন সফল হয়েছে", "user": new_user}


@app.post("/api/heartbeat")
def record_heartbeat(req: HeartbeatRequest):
    supabase.table("activity_logs").insert({"user_id": req.userId}).execute()
    return {"success": True, "message": "Heartbeat logged"}


@app.get("/api/referrals")
def get_referrals(userId: int):
    # রিলেশনাল জয়েনিং কুয়েরি
    res = supabase.table("referrals").select("id, status, created_at, referred:referred_id(id, nickname, avatar_url, age, gender, level)").eq("referrer_id", userId).execute()
    return res.data


@app.post("/api/add-coins")
def add_coins(req: AddCoinsRequest):
    user_res = supabase.table("users").select("coin_balance").eq("id", req.userId).execute()
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_balance = user_res.data[0].get("coin_balance", 0)
    new_balance = current_balance + req.coinsEarned
    
    update_res = supabase.table("users").update({"coin_balance": new_balance}).eq("id", req.userId).execute()
    return {"success": True, "newBalance": new_balance}


@app.post("/api/send-otp")
def send_otp(req: SendOTPRequest):
    today_utc_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # আজ Brevo ও Resend এর ইমেইল ট্র্যাকিং কাউন্ট রিড করা
    brevo_logs = supabase.table("email_logs").select("id", count="exact").eq("provider", "Brevo").gte("sent_at", today_utc_start).execute()
    resend_logs = supabase.table("email_logs").select("id", count="exact").eq("provider", "Resend").gte("sent_at", today_utc_start).execute()

    brevo_count = brevo_logs.count if brevo_logs.count is not None else 0
    resend_count = resend_logs.count if resend_logs.count is not None else 0

    sent = False
    provider_used = ""

    # ওটিপি পাঠানোর লিমিট ভিত্তিক ফেইলওভার প্রসেস
    if brevo_count < 290:
        if send_via_brevo(req.email, req.otp):
            sent = True
            provider_used = "Brevo"
    elif resend_count < 98:
        if send_via_resend(req.email, req.otp):
            sent = True
            provider_used = "Resend"

    if sent:
        # সফল লগের এন্ট্রি সেভ
        supabase.table("email_logs").insert({"provider": provider_used, "recipient": req.email}).execute()
        return {"success": True, "message": f"OTP successfully sent via {provider_used}"}
    else:
        raise HTTPException(status_code=429, detail="আজকের ওটিপি পাঠানোর দৈনিক কোটা অতিক্রম হয়েছে।")


@app.get("/api/cron/verify")
def verify_referrals_cron(x_cron_secret: str = Header(None)):
    # সিকিউর ক্রন কি চেক
    if x_cron_secret != os.environ.get("CRON_SECRET"):
        raise HTTPException(status_code=401, detail="Unauthorized")

    twelve_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
    
    # পেন্ডিং বা 'Processing' রেফারেল যেগুলো ১২ ঘণ্টার বেশি পুরনো
    pending_res = supabase.table("referrals").select("*").eq("status", "Processing").lte("created_at", twelve_hours_ago).execute()
    pending_referrals = pending_res.data

    if not pending_referrals:
        return {"message": "প্রসেস করার মতো কোনো পেন্ডিং রেফারেল পাওয়া যায়নি।"}

    for referral in pending_referrals:
        referred_res = supabase.table("users").select("*").eq("id", referral["referred_id"]).execute()
        referrer_res = supabase.table("users").select("*").eq("id", referral["referrer_id"]).execute()
        
        if not referred_res.data or not referrer_res.data:
            supabase.table("referrals").update({"status": "Failed"}).eq("id", referral["id"]).execute()
            continue

        referred = referred_res.data[0]
        referrer = referrer_res.data[0]

        # ১. একই ডিভাইস কি না ডাবল চেক
        if referred["device_fingerprint"] == referrer["device_fingerprint"]:
            supabase.table("referrals").update({"status": "Failed"}).eq("id", referral["id"]).execute()
            continue

        # ২. প্রোফাইল ইনফো পূরণ এবং অন্তত ১টি গেম খেলা হয়েছে কি না
        profile_complete = bool(referred["dob"] and referred["country"] and referred["age"] and referred["gender"])
        played_game = referred.get("coin_balance", 0) > 0

        # ৩. ১২ ঘণ্টার ট্র্যাকিং সেশনে ১০ ঘণ্টা (১২০ টি হার্টবিট পিং) একটিভ ট্র্যাকিং চেক
        twelve_hours_after_creation = (datetime.fromisoformat(referral["created_at"]) + timedelta(hours=12)).isoformat()
        
        pings_res = supabase.table("activity_logs").select("id", count="exact").eq("user_id", referred["id"]).gte("pinged_at", referral["created_at"]).lte("pinged_at", twelve_hours_after_creation).execute()
        pings_count = pings_res.count if pings_res.count is not None else 0
        
        active_enough = pings_count >= 120 # ৫ মিনিট ইন্টারভাল অনুযায়ী ১২০ টি পিং = ১০ ঘণ্টা

        # ৪. চূড়ান্ত স্ট্যাটাস সেভ
        if profile_complete and played_game and active_enough:
            supabase.table("referrals").update({"status": "Success"}).eq("id", referral["id"]).execute()
            
            # রেফারারের ডায়মন্ড ব্যালেন্স ১০ বাড়িয়ে সেভ করা
            new_diamonds = referrer.get("diamond_balance", 0) + 10
            supabase.table("users").update({"diamond_balance": new_diamonds}).eq("id", referrer["id"]).execute()
        else:
            supabase.table("referrals").update({"status": "Failed"}).eq("id", referral["id"]).execute()

    return {"success": True, "message": f"{len(pending_referrals)} টি রেফারেল সফলভাবে ভেরিফাই করা হয়েছে।"}
