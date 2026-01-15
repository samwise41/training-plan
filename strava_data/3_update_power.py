import requests
import os
import pandas as pd
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
ACTIVITY_LIST = "activity_ids.txt"
CACHE_DIR = "power_cache"
OUTPUT_GRAPH = "power_curve_graph.json"
OUTPUT_MD = "my_power_profile.md"

MAX_DURATION_SECONDS = 21600 # 6 Hours
BATCH_SIZE = 20 # Only fetch 20 new rides at a time

# Intervals for Summary Table
KEY_INTERVALS = [
    ("1s", 1), ("5s", 5), ("15s", 15), ("30s", 30),
    ("1min", 60), ("2min", 120), ("5min", 300),
    ("10min", 600), ("20min", 1200), ("30min", 1800), 
    ("1hr", 3600), ("2hr", 7200), ("3hr", 10800), 
    ("4hr", 14400), ("5hr", 18000), ("6hr", 21600)
]

def get_access_token():
    payload = {
        'client_id': os.getenv('STRAVA_CLIENT_ID'),
        'client_secret': os.getenv('STRAVA_CLIENT_SECRET'),
        'refresh_token': os.getenv('STRAVA_REFRESH_TOKEN'),
        'grant_type': 'refresh_token',
        'f': 'json'
    }
    res = requests.post("https://www.strava.com/oauth/token", data=payload, verify=True)
    return res.json()['access_token']

def format_duration(seconds):
    h, r = divmod(seconds, 3600)
    m, s = divmod(r, 60)
    parts = []
    if h > 0: parts.append(f"{h}h")
    if m > 0: parts.append(f"{m}m")
    if s > 0 or not parts: parts.append(f"{s}s")
    return " ".join(parts)

def process_new_rides(token):
    if not os.path.exists(CACHE_DIR): os.makedirs(CACHE_DIR)
    
    # 1. Identify Missing Rides
    cached_ids = set([f.split('.')[0] for f in os.listdir(CACHE_DIR) if f.endswith('.json')])
    to_process = []
    
    if os.path.exists(ACTIVITY_LIST):
        with open(ACTIVITY_LIST, "r") as f:
            for line in f:
                parts = line.strip().split(',')
                if len(parts) < 3: continue
                aid, atype = parts[0], parts[1]
                
                # Logic: Must be Ride, Must NOT be in cache
                if atype == "Ride" and aid not in cached_ids:
                    to_process.append(aid)

    if not to_process:
        print("✅ Cache is up to date.")
        return False

    print(f"⚡ Processing {len(to_process)} new rides (Batch: {BATCH_SIZE})...")
    headers = {'Authorization': f"Bearer {token}"}
    
    processed_count = 0
    
    for act_id in to_process[:BATCH_SIZE]:
        # A. Fetch Streams
        print(f"   Fetching {act_id}...", end="\r")
        url = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
        r = requests.get(url, headers=headers, params={'keys': 'watts', 'key_by_type': 'true'})
        if r.status_code != 200: continue
        streams = r.json()
        
        if 'watts' not in streams:
            # Create empty file so we don't check again
            with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
                json.dump({'id': act_id, 'no_power': True}, f)
            continue

        # B. Fetch Details
        r2 = requests.get(f"https://www.strava.com/api/v3/activities/{act_id}", headers=headers)
        details = r2.json()

        # C. Calculate Curve (The Math)
        power_series = pd.Series(streams['watts']['data'])
        limit = min(len(power_series), MAX_DURATION_SECONDS)
        curve = []
        for seconds in range(1, limit + 1):
            peak = int(power_series.rolling(window=seconds).mean().max())
            curve.append(peak)

        # D. Save to Cache
        data = {
            'id': act_id,
            'name': details['name'],
            'date': details['start_date_local'][:10],
            'power_curve': curve
        }
        with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
            json.dump(data, f)
        
        processed_count += 1

    print(f"\n💾 Cached {processed_count} new rides.")
    return True

def generate_outputs():
    print("📊 Generating Global Power Profile...")
    
    # Initialize Global Arrays [1s..21600s]
    all_time_best = [None] * MAX_DURATION_SECONDS
    six_week_best = [None] * MAX_DURATION_SECONDS
    
    today = datetime.now()
    six_weeks_ago = today - timedelta(weeks=6)
    
    # 1. Load All Cached Files
    files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.json')]
    
    for fname in files:
        with open(os.path.join(CACHE_DIR, fname), "r") as f:
            ride = json.load(f)
            
        if 'power_curve' not in ride: continue # Skip rides without power
        
        ride_date = datetime.strptime(ride['date'], "%Y-%m-%d")
        is_recent = ride_date >= six_weeks_ago
        curve = ride['power_curve']
        
        # 2. Merge into Global Bests
        for i, watts in enumerate(curve):
            # i=0 is 1s, i=1 is 2s...
            if i >= MAX_DURATION_SECONDS: break
            
            # Check All Time
            if all_time_best[i] is None or watts > all_time_best[i]['watts']:
                all_time_best[i] = {'watts': watts, 'date': ride['date'], 'id': ride['id'], 'name': ride['name']}
            
            # Check 6 Week
            if is_recent:
                if six_week_best[i] is None or watts > six_week_best[i]['watts']:
                    six_week_best[i] = {'watts': watts, 'date': ride['date'], 'id': ride['id'], 'name': ride['name']}

    # 3. Save Markdown
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("# ⚡ Power Profile (All Time vs 6 Weeks)\n\n")
        f.write("| Duration | All Time Best | 6 Week Best | Activity Link |\n")
        f.write("|---|---|---|---|\n")
        
        for label, seconds in KEY_INTERVALS:
            idx = seconds - 1
            if idx < len(all_time_best):
                at = all_time_best[idx]
                sw = six_week_best[idx]
                
                at_str = f"**{at['watts']}w**" if at else "--"
                sw_str = f"{sw['watts']}w" if sw else "--"
                link = f"[View](https://www.strava.com/activities/{at['id']})" if at else ""
                
                f.write(f"| {label} | {at_str} | {sw_str} | {link} |\n")
                
    print(f"✅ Updated {OUTPUT_MD}")

    # 4. Save Graph JSON
    graph_data = []
    for i in range(MAX_DURATION_SECONDS):
        at = all_time_best[i]
        sw = six_week_best[i]
        if at:
            graph_data.append({
                "seconds": i + 1,
                "all_time_watts": at['watts'],
                "six_week_watts": sw['watts'] if sw else None
            })
            
    with open(OUTPUT_GRAPH, "w") as f:
        json.dump(graph_data, f)
    print(f"✅ Updated {OUTPUT_GRAPH}")

if __name__ == "__main__":
    token = get_access_token()
    # 1. Fetch new data (if any)
    has_updates = process_new_rides(token)
    # 2. Always regenerate table (in case 6-week window shifted)
    generate_outputs()
