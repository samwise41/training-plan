import os
import json
import datetime
from garminconnect import Garmin
from dotenv import load_dotenv

# Load env variables from the parent directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(PARENT_DIR, '.env'))

EMAIL = os.getenv("GARMIN_EMAIL")
PASSWORD = os.getenv("GARMIN_PASSWORD")
DATA_FILE = os.path.join(PARENT_DIR, "garmin_data", "my_garmin_data_ALL.json")

def fetch_garmin_data():
    print("🔐 Authenticating with Garmin...")
    
    if not EMAIL or not PASSWORD:
        print("❌ Error: Missing GARMIN_EMAIL or GARMIN_PASSWORD in .env")
        return None

    try:
        # --- FIX: Removed the trailing comma here ---
        client = Garmin(EMAIL, PASSWORD) 
        # --------------------------------------------
        
        client.login()
        print("✅ Login Successful.")

        print("📡 Fetching Stats...")
        # Fetch stats for the last 7 days to keep it fast
        today = datetime.date.today()
        start_date = today - datetime.timedelta(days=7)
        
        # We need to loop because get_stats is daily
        all_stats = []
        # If we already have data, load it so we don't overwrite history
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r') as f:
                try:
                    all_stats = json.load(f)
                except:
                    all_stats = []

        # Fetch new data
        for i in range(8):
            d = start_date + datetime.timedelta(days=i)
            d_str = d.isoformat()
            try:
                stats = client.get_stats(d_str)
                # Add/Update list
                # (Simple dedupe logic: remove entry if date exists, then append new)
                all_stats = [x for x in all_stats if x.get('calendarDate') != d_str]
                all_stats.append(stats)
            except Exception as e:
                print(f"   ⚠️ No data for {d_str}: {e}")

        # Save
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, 'w') as f:
            json.dump(all_stats, f, indent=2)
            
        print(f"💾 Data Saved to {DATA_FILE}")
        return all_stats

    except Exception as e:
        print(f"❌ Login/Fetch Failed: {e}")
        return None

if __name__ == "__main__":
    fetch_garmin_data()
