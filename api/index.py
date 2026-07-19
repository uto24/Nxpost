import os
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

@app.get("/api/cron/verify")
def verify_referrals_cron(x_cron_secret: str = Header(None)):
    if x_cron_secret != os.environ.get("CRON_SECRET"):
        raise HTTPException(status_code=401, detail="Unauthorized")

    twelve_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()
    
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

        if referred["device_fingerprint"] == referrer["device_fingerprint"]:
            supabase.table("referrals").update({"status": "Failed"}).eq("id", referral["id"]).execute()
            continue

        profile_complete = bool(referred["dob"] and referred["country"] and referred["age"] and referred["gender"])
        played_game = referred.get("coin_balance", 0) > 0

        twelve_hours_after_creation = (datetime.fromisoformat(referral["created_at"]) + timedelta(hours=12)).isoformat()
        pings_res = supabase.table("activity_logs").select("id", count="exact").eq("user_id", referred["id"]).gte("pinged_at", referral["created_at"]).lte("pinged_at", twelve_hours_after_creation).execute()
        pings_count = pings_res.count if pings_res.count is not None else 0
        active_enough = pings_count >= 120

        if profile_complete and played_game and active_enough:
            supabase.table("referrals").update({"status": "Success"}).eq("id", referral["id"]).execute()
            new_diamonds = referrer.get("diamond_balance", 0) + 10
            supabase.table("users").update({"diamond_balance": new_diamonds}).eq("id", referrer["id"]).execute()
        else:
            supabase.table("referrals").update({"status": "Failed"}).eq("id", referral["id"]).execute()

    return {"success": True, "message": f"{len(pending_referrals)} টি রেফারেল সফলভাবে ভেরিফাই করা হয়েছে।"}
