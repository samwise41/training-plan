import requests
import os
import pandas as pd
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
ACTIVITY_LIST = "activity_ids.txt"
PROCESSED_LOG = "power_processed.txt"
BESTS_DB = "power_bests.json"
OUTPUT_GRAPH = "power_curve_graph.json"
OUTPUT_MD = "my_power_profile.md"

MAX_DURATION_SECONDS = 21600 # 6 Hours
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

def format_duration(seconds):
    h, r = divmod(seconds, 3600)
    m, s = divmod(r, 60)
    parts = []
    if h > 0: parts.append(f"{h}h")
    if m > 0: parts.append(f"{m}m")
    if s > 0 or not parts: parts.append(f"{s}s")
    return " ".join(parts)

def load_db():
    if os.path.exists(BESTS_DB):
        with open(BESTS_DB, "r") as f:
            data = json.load(f)
        return data
    return {}

def main():
    if not os.path.exists(ACTIVITY_LIST):
        print(f"❌ {ACTIVITY_LIST} not found.")
        return

    # 1. Load Data
    bests_db = load_db()
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
            
            if act_type == "Ride" and act_id not in processed_ids:
                to_scan.append({
                    'id': act_id,
                    'date': act_date,
                    'type': act_type
                })

    if not to_scan:
        print("✅ Power Curve is up to date.")
        return 

    print(f"⚡ Found {len(to_scan)} new rides. Processing batch of {BATCH_SIZE}...")
    
    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    # 6-Week Cutoff
    today = datetime.now()
    six_weeks_ago = today - timedelta(weeks=6)
    
    updated = False
    new_processed = []
    count = 0

    # 3. Process Batch
    for activity in to_scan[:BATCH_SIZE]:
        count += 1
        act_id = activity['id']
        act_date_str = activity['date']
        new_processed.append(act_id)
        
        print(f"   [{count}/{BATCH_SIZE}] Fetching {act_id} ({act_date_str})...", end="\r")
        
        # Fetch Name
        try:
            detail = requests.get(f"https://www.strava.com/api/v3/activities/{act_id}", headers=headers).json()
            act_name = detail.get('name', 'Unknown')
            
            # Fetch Streams
            url = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
            res = requests.get(url, headers=headers, params={'keys': 'watts', 'key_by_type': 'true'})
            
            if res.status_code != 200: continue
            data = res.json()
            if 'watts' not in data: continue

            # Calculate Curve (1s to 6h)
            power_series = pd.Series(data['watts']['data'])
            limit = min(len(power_series), MAX_DURATION_SECONDS)
            
            act_date_obj = datetime.strptime(act_date_str, "%Y-%m-%d")
            is_recent_ride = act_date_obj >= six_weeks_ago

            for seconds in range(1, limit + 1):
                peak = int(power_series.rolling(window=seconds).mean().max())
                key = str(seconds)
                
                if key not in bests_db: bests_db[key] = {'all_time': None, 'six_week': None}
                record = bests_db[key]
                
                # Template
                new_entry = {
                    'watts': peak,
                    'date': act_date_str,
                    'name': act_name,
                    'id': act_id
                }

                # A. Check All-Time
                if record['all_time'] is None or peak > record['all_time']['watts']:
                    record['all_time'] = new_entry
                    updated = True

                # B. Check 6-Week Logic
                current_6wk = record['six_week']
                should_update_6wk = False
                
                if current_6wk is None:
                    should_update_6wk = True
                else:
                    record_date = datetime.strptime(current_6wk['date'], "%Y-%m-%d")
                    if record_date < six_weeks_ago:
                        should_update_6wk = True # Expired
                    elif peak > current_6wk['watts']:
                        should_update_6wk = True # Better

                if should_update_6wk and is_recent_ride:
                    record['six_week'] = new_entry
                    updated = True
        except Exception as e:
            print(f"Error processing {act_id}: {e}")
            continue

    # 4. Save Changes
    print("\n💾 Saving updates...")
    
    with open(PROCESSED_LOG, "a") as f:
        for pid in new_processed:
            f.write(f"{pid}\n")

    if updated:
        # A. Save DB
        with open(BESTS_DB, "w") as f:
            json.dump(bests_db, f)
            
        # B. Save Graph Data
        graph_data = []
        for i in range(MAX_DURATION_SECONDS):
            key = str(i + 1)
            if key in bests_db:
                rec = bests_db[key]
                graph_data.append({
                    "seconds": i + 1,
                    "all_time_watts": rec['all_time']['watts'] if rec['all_time'] else 0,
                    "six_week_watts": rec['six_week']['watts'] if rec['six_week'] else 0
                })
        with open(OUTPUT_GRAPH, "w") as f:
            json.dump(graph_data, f)

        # C. Save Massive Markdown Table
        with open(OUTPUT_MD, "w", encoding="utf-8") as f:
            f.write("# ⚡ Power Profile (1s - 6h)\n\n")
            f.write("| Duration | All Time Best | 6 Week Best | Activity Link |\n")
            f.write("|---|---|---|---|\n")
            
            for i in range(MAX_DURATION_SECONDS):
                key = str(i + 1)
                if key in bests_db:
                    rec = bests_db[key]
                    at = rec['all_time']
                    sw = rec['six_week']
                    
                    if at:
                        label = format_duration(i + 1)
                        at_str = f"**{at['watts']}w**"
                        
                        sw_val = "--"
                        if sw:
                            sw_date = datetime.strptime(sw['date'], "%Y-%m-%d")
                            if sw_date >= six_weeks_ago:
                                sw_val = f"{sw['watts']}w"
                        
                        link = f"[View](https://www.strava.com/activities/{at['id']})"
                        f.write(f"| {label} | {at_str} | {sw_val} | {link} |\n")

        print(f"✅ Updated {OUTPUT_MD} and {OUTPUT_GRAPH}")

if __name__ == "__main__":
    main()
