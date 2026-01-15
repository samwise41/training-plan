import requests
import os
import pandas as pd
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

# --- PATH CONFIGURATION (ADAPTED FOR NEW STRUCTURE) ---
# 1. Where does this script live? (.../strava_data/cycling)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. Where is the parent folder? (.../strava_data)
PARENT_DIR = os.path.dirname(BASE_DIR)

# 3. Load .env from the parent folder
load_dotenv(os.path.join(PARENT_DIR, '.env'))

# 4. Define paths relative to the parent
# activity_ids.txt is in the parent folder
ACTIVITY_LIST = os.path.join(PARENT_DIR, "activity_ids.txt")

# power_cache is a sibling folder (in parent)
CACHE_DIR = os.path.join(PARENT_DIR, "power_cache")

# The output files stay right here in the cycling/ folder
OUTPUT_GRAPH = os.path.join(BASE_DIR, "power_curve_graph.json")
OUTPUT_MD = os.path.join(BASE_DIR, "my_power_profile.md")

MAX_DURATION_SECONDS = 21600 # 6 Hours
BATCH_SIZE = 20 

# Key intervals for the Summary Table
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
    try:
        res = requests.post("https://www.strava.com/oauth/token", data=payload, verify=True)
        res.raise_for_status()
        return res.json()['access_token']
    except Exception as e:
        print(f"⚠️ Auth Failed: {e}")
        return None

def format_duration(seconds):
    h, r = divmod(seconds, 3600)
    m, s = divmod(r, 60)
    parts = []
    if h > 0: parts.append(f"{h}h")
    if m > 0: parts.append(f"{m}m")
    if s > 0 or not parts: parts.append(f"{s}s")
    return " ".join(parts)

def update_cache(token):
    # Check if the master list exists in the parent folder
    if not os.path.exists(ACTIVITY_LIST):
        print(f"❌ CRITICAL ERROR: Could not find master list at:")
        print(f"   {ACTIVITY_LIST}")
        return

    if not os.path.exists(CACHE_DIR): os.makedirs(CACHE_DIR)
    
    cached_ids = set([f.split('.')[0] for f in os.listdir(CACHE_DIR) if f.endswith('.json')])
    to_process = []
    
    # Identify new rides
    ride_count = 0
    with open(ACTIVITY_LIST, "r") as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) < 3: continue
            aid, atype = parts[0], parts[1]
            
            if atype == "Ride":
                ride_count += 1
                if aid not in cached_ids:
                    to_process.append(aid)

    print(f"📋 Master List: Found {ride_count} rides. Need to fetch {len(to_process)}.")

    if not to_process:
        print("✅ Power Cache is up to date.")
        return

    if not token:
        print("⚠️ No API Token. Cannot download missing rides.")
        return

    print(f"⚡ Caching {len(to_process)} new rides...")
    headers = {'Authorization': f"Bearer {token}"}
    
    for i, act_id in enumerate(to_process[:BATCH_SIZE]):
        print(f"   [{i+1}/{BATCH_SIZE}] Processing {act_id}...", end="\r")
        try:
            # 1. Get Streams
            url = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
            r = requests.get(url, headers=headers, params={'keys': 'watts', 'key_by_type': 'true'})
            
            if r.status_code == 429:
                print(f"\n⚠️ Rate Limit Exceeded on {act_id}. Stopping early.")
                break 
            if r.status_code != 200: continue
            
            streams = r.json()
            
            if 'watts' not in streams:
                with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
                    json.dump({'id': act_id, 'no_power': True}, f)
                continue

            # 2. Get Details
            r2 = requests.get(f"https://www.strava.com/api/v3/activities/{act_id}", headers=headers)
            details = r2.json()

            # 3. Calculate Curve
            power_series = pd.Series(streams['watts']['data'])
            limit = min(len(power_series), MAX_DURATION_SECONDS)
            curve = []
            for seconds in range(1, limit + 1):
                peak = int(power_series.rolling(window=seconds).mean().max())
                curve.append(peak)

            # 4. Save
            data = {
                'id': act_id,
                'name': details['name'],
                'date': details['start_date_local'][:10],
                'power_curve': curve
            }
            with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
                json.dump(data, f)
        
        except Exception as e:
            print(f"Error {act_id}: {e}")
            
    print("\n💾 Cache update process finished.")

def generate_stats():
    print("📊 Generating Power Profile from Cache...")
    if not os.path.exists(CACHE_DIR):
        print(f"⚠️ No cache directory found at {CACHE_DIR}")
        return

    files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.json')]
    print(f"   (Analyzing {len(files)} cached rides)")

    if len(files) == 0:
        print("⚠️ Warning: Cache is empty.")
    
    all_time_best = [None] * MAX_DURATION_SECONDS
    six_week_best = [None] * MAX_DURATION_SECONDS
    
    today = datetime.now()
    six_weeks_ago = today - timedelta(weeks=6)
    
    for fname in files:
        with open(os.path.join(CACHE_DIR, fname), "r") as f:
            try:
                ride = json.load(f)
            except json.JSONDecodeError:
                continue
            
        if 'power_curve' not in ride: continue
        
        ride_date = datetime.strptime(ride['date'], "%Y-%m-%d")
        is_recent = ride_date >= six_weeks_ago
        curve = ride['power_curve']
        
        for i, watts in enumerate(curve):
            if i >= MAX_DURATION_SECONDS: break
            
            # Update All Time
            if all_time_best[i] is None or watts > all_time_best[i]['watts']:
                all_time_best[i] = {'watts': watts, 'date': ride['date'], 'id': ride['id']}
            
            # Update 6 Week
            if is_recent:
                if six_week_best[i] is None or watts > six_week_best[i]['watts']:
                    six_week_best[i] = {'watts': watts, 'date': ride['date'], 'id': ride['id']}

    # MARKDOWN
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("# ⚡ Power Profile (1s - 6h)\n\n")
        f.write("| Duration | All Time Best | Link | 6 Week Best | Link |\n")
        f.write("|---|---|---|---|---|\n")
        
        for label, seconds in KEY_INTERVALS:
            idx = seconds - 1
            if idx < len(all_time_best):
                at = all_time_best[idx]
                sw = six_week_best[idx]
                
                # All Time
                at_str = f"**{at['watts']}w**" if at else "--"
                at_link = f"[View](https://www.strava.com/activities/{at['id']})" if at else "--"

                # 6 Week
                sw_str = f"{sw['watts']}w" if sw else "--"
                sw_link = f"[View](https://www.strava.com/activities/{sw['id']})" if sw else "--"
                
                f.write(f"| {label} | {at_str} | {at_link} | {sw_str} | {sw_link} |\n")

    # GRAPH JSON
    graph_data = []
    for i in range(MAX_DURATION_SECONDS):
        at = all_time_best[i]
        sw = six_week_best[i]
        if at:
            graph_data.append({
                "seconds": i + 1,
                "all_time_watts": at['watts'],
                "six_week_watts": sw['watts'] if sw else 0
            })
            
    with open(OUTPUT_GRAPH, "w") as f:
        json.dump(graph_data, f)
    
    print(f"✅ Updated {OUTPUT_MD} and {OUTPUT_GRAPH}")

if __name__ == "__main__":
    token = get_access_token()
    update_cache(token)
    generate_stats()
