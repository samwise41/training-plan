import requests
import os
import pandas as pd
import json
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
ACTIVITY_LIST = "activity_ids.txt"
PROCESSED_LOG = "power_processed.txt"
BESTS_DB = "power_bests.json"
OUTPUT_MD = "my_power_profile.md"

# Durations to track: (Label, Seconds)
DURATIONS = [
    ("1s", 1), ("5s", 5), ("15s", 15), ("30s", 30),
    ("1min", 60), ("2min", 120), ("5min", 300),
    ("10min", 600), ("20min", 1200), ("30min", 1800), ("1hr", 3600)
]

# Limit API calls per run to be safe
BATCH_SIZE = 20 

def get_access_token():
    payload = {
        'client_id': os.getenv('STRAVA_CLIENT_ID'),
        'client_secret': os.getenv('STRAVA_CLIENT_SECRET'),
        'refresh_token': os.getenv('STRAVA_REFRESH_TOKEN'),
        'grant_type': 'refresh_token',
        'f': 'json'
    }
    res = requests.post("https://www.strava.com/oauth/token", data=payload, verify=True)
    if res.status_code != 200:
        print(f"Auth Error: {res.text}")
        exit(1)
    return res.json()['access_token']

def load_json_db():
    if os.path.exists(BESTS_DB):
        with open(BESTS_DB, "r") as f:
            return json.load(f)
    # Default structure if new
    return {str(sec): {'watts': 0, 'date': '-', 'name': '-', 'id': ''} for _, sec in DURATIONS}

def format_duration(seconds):
    if seconds < 60: return f"{seconds}s"
    elif seconds < 3600: return f"{int(seconds/60)}m"
    else: return f"{int(seconds/3600)}h"

def main():
    if not os.path.exists(ACTIVITY_LIST):
        print(f"❌ {ACTIVITY_LIST} not found. Run Script 1 first.")
        return

    # 1. Load State
    bests = load_json_db()
    processed_ids = set()
    if os.path.exists(PROCESSED_LOG):
        with open(PROCESSED_LOG, "r") as f:
            processed_ids = set(line.strip() for line in f)

    # 2. Identify New Rides
    to_scan = []
    with open(ACTIVITY_LIST, "r") as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) < 3: continue
            
            act_id, act_type, act_date = parts[0], parts[1], parts[2]
            
            # Logic: Must be Ride, Must be New
            if act_type == "Ride" and act_id not in processed_ids:
                to_scan.append((act_id, act_date))

    if not to_scan:
        print("✅ Power Curve is up to date.")
        return

    print(f"⚡ Found {len(to_scan)} new rides. Processing batch of {BATCH_SIZE}...")
    
    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    count = 0
    updated = False
    new_processed = []

    for act_id, act_date in to_scan[:BATCH_SIZE]:
        count += 1
        new_processed.append(act_id)
        
        # A. Fetch Streams
        print(f"   [{count}/{BATCH_SIZE}] Fetching streams for {act_id}...", end="\r")
        url = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
        res = requests.get(url, headers=headers, params={'keys': 'watts', 'key_by_type': 'true'})
        
        if res.status_code != 200:
            print(f"\n      ⚠️ Error {res.status_code}. Skipping.")
            continue
            
        data = res.json()
        if 'watts' not in data:
            # No power meter data
            continue

        # B. Fetch Name (Extra call, only if we have watts)
        detail = requests.get(f"https://www.strava.com/api/v3/activities/{act_id}", headers=headers).json()
        act_name = detail.get('name', 'Unknown Ride')

        # C. Calculate Curve
        power_series = pd.Series(data['watts']['data'])
        
        for label, seconds in DURATIONS:
            if len(power_series) < seconds: continue
            
            # The Magic Math
            peak = int(power_series.rolling(window=seconds).mean().max())
            
            # Update Database if better
            key = str(seconds)
            current_best = bests[key]['watts']
            
            if peak > current_best:
                print(f"\n      🔥 NEW RECORD! {label}: {peak}w (was {current_best}w)")
                bests[key] = {
                    'watts': peak,
                    'date': act_date,
                    'name': act_name,
                    'id': act_id
                }
                updated = True

    # 3. Save Everything
    print("\n💾 Saving Data...")
    
    # Update Log
    with open(PROCESSED_LOG, "a") as f:
        for pid in new_processed:
            f.write(f"{pid}\n")
            
    # Update JSON DB
    if updated:
        with open(BESTS_DB, "w") as f:
            json.dump(bests, f, indent=2)
            
        # Update Markdown View
        with open(OUTPUT_MD, "w", encoding="utf-8") as f:
            f.write("# ⚡ My Power Profile\n\n")
            f.write("| Duration | Watts | Date | Activity |\n")
            f.write("|---|---|---|---|\n")
            
            # Sort by duration length
            for label, seconds in DURATIONS:
                row = bests[str(seconds)]
                w = row['watts']
                if w > 0:
                    link = f"[{row['name']}](https://www.strava.com/activities/{row['id']})"
                    f.write(f"| **{label}** | **{w}w** | {row['date']} | {link} |\n")
                else:
                    f.write(f"| {label} | -- | -- | -- |\n")
        print(f"✅ Updated {OUTPUT_MD}")

if __name__ == "__main__":
    main()
