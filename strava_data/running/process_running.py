import requests
import os
import pandas as pd
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

# --- PATH CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(PARENT_DIR, '.env'))

ACTIVITY_LIST = os.path.join(PARENT_DIR, "activity_ids.txt")
CACHE_DIR = os.path.join(PARENT_DIR, "running_cache")
OUTPUT_GRAPH = os.path.join(BASE_DIR, "running_pace_curve.json")
OUTPUT_MD = os.path.join(BASE_DIR, "my_running_profile.md")

MAX_DURATION_SECONDS = 14400 # 4 Hours (Marathon-ish)
BATCH_SIZE = 20 

# Durations we want to see in the table
KEY_INTERVALS = [
    ("10s", 10), ("30s", 30),
    ("1min", 60), ("1 mile", 390), # Approx time, used for labeling only
    ("5min", 300), ("10min", 600), 
    ("20min", 1200), ("30min", 1800), 
    ("45min", 2700), ("1hr", 3600), 
    ("90min", 5400), ("2hr", 7200),
    ("3hr", 10800), ("Marathon", 14400) 
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

# Helper: Meters/Sec -> MM:SS/mi
def mps_to_pace(mps):
    if not mps or mps <= 0: return "--"
    # 1 m/s = 26.8224 min/mile
    mins_per_mile = 26.8224 / mps
    m = int(mins_per_mile)
    s = int((mins_per_mile - m) * 60)
    return f"{m}:{s:02d}/mi"

def update_cache(token):
    if not os.path.exists(ACTIVITY_LIST):
        print(f"❌ CRITICAL ERROR: Could not find master list at: {ACTIVITY_LIST}")
        return

    if not os.path.exists(CACHE_DIR): os.makedirs(CACHE_DIR)
    
    cached_ids = set([f.split('.')[0] for f in os.listdir(CACHE_DIR) if f.endswith('.json')])
    to_process = []
    
    with open(ACTIVITY_LIST, "r") as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) < 3: continue
            aid, atype = parts[0], parts[1]
            if atype == "Run" and aid not in cached_ids:
                to_process.append(aid)

    print(f"📋 Master List: Found {len(to_process) + len(cached_ids)} runs. Need to fetch {len(to_process)}.")

    if not to_process:
        print("✅ Running Cache is up to date.")
    elif token:
        print(f"🏃 Fetching {len(to_process)} new runs...")
        headers = {'Authorization': f"Bearer {token}"}
        
        for i, act_id in enumerate(to_process[:BATCH_SIZE]):
            print(f"   [{i+1}/{BATCH_SIZE}] Processing {act_id}...", end="\r")
            try:
                # 1. Get Streams (velocity_smooth)
                url = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
                r = requests.get(url, headers=headers, params={'keys': 'velocity_smooth', 'key_by_type': 'true'})
                if r.status_code == 429: break
                if r.status_code != 200: continue
                streams = r.json()

                if 'velocity_smooth' not in streams:
                    # Save empty placeholder if no speed data
                    with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
                        json.dump({'id': act_id, 'no_velocity': True}, f)
                    continue

                # 2. Get Details (Name, Date)
                r2 = requests.get(f"https://www.strava.com/api/v3/activities/{act_id}", headers=headers)
                details = r2.json()

                # 3. Calculate Pace Curve (Rolling Average Speed)
                # We work in Meters Per Second (Higher is better) for calculation
                velocity_series = pd.Series(streams['velocity_smooth']['data'])
                limit = min(len(velocity_series), MAX_DURATION_SECONDS)
                curve = []
                
                # Calculate max speed for every second
                for seconds in range(1, limit + 1):
                    # rolling window mean, then max of those means
                    peak_mps = velocity_series.rolling(window=seconds).mean().max()
                    curve.append(peak_mps)

                # 4. Save
                data = {
                    'id': act_id,
                    'name': details['name'],
                    'date': details['start_date_local'][:10],
                    'velocity_curve': curve # Storing m/s
                }
                with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
                    json.dump(data, f)

            except Exception as e:
                print(f"Error {act_id}: {e}")
        print("\n💾 Cache update finished.")
    else:
        print("⚠️ No Token. Skipping Cache Update.")

def generate_stats():
    print("📊 Generating Running Pace Profile...")
    if not os.path.exists(CACHE_DIR):
        print(f"⚠️ No cache directory found at {CACHE_DIR}")
        return

    files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.json')]
    if len(files) == 0: print("⚠️ Warning: Cache is empty.")
    
    # These arrays store BEST SPEED (m/s)
    all_time_best = [None] * MAX_DURATION_SECONDS
    six_week_best = [None] * MAX_DURATION_SECONDS
    
    today = datetime.now()
    six_weeks_ago = today - timedelta(weeks=6)
    
    for fname in files:
        with open(os.path.join(CACHE_DIR, fname), "r") as f:
            try: run = json.load(f)
            except: continue
        
        if 'velocity_curve' not in run: continue
        
        run_date = datetime.strptime(run['date'], "%Y-%m-%d")
        is_recent = run_date >= six_weeks_ago
        curve = run['velocity_curve']
        
        for i, mps in enumerate(curve):
            if i >= MAX_DURATION_SECONDS: break
            if mps is None: continue
            
            entry = {'mps': mps, 'date': run['date'], 'name': run.get('name', 'Run'), 'id': run['id']}
            
            # Update All Time (Higher m/s is better)
            if all_time_best[i] is None or mps > all_time_best[i]['mps']:
                all_time_best[i] = entry
            
            # Update 6 Week
            if is_recent:
                if six_week_best[i] is None or mps > six_week_best[i]['mps']:
                    six_week_best[i] = entry

    # MARKDOWN REPORT
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("# 🏃 Pace Profile (Duration based)\n\n")
        f.write("| Duration | All Time Best | Date | 6 Week Best | Date |\n")
        f.write("|---|---|---|---|---|\n")
        
        for label, seconds in KEY_INTERVALS:
            idx = seconds - 1
            if idx < len(all_time_best):
                at = all_time_best[idx]
                sw = six_week_best[idx]
                
                def fmt_link(record):
                    if not record: return "--"
                    return f"[{record['date']}](https://www.strava.com/activities/{record['id']})"

                at_pace = mps_to_pace(at['mps']) if at else "--"
                sw_pace = mps_to_pace(sw['mps']) if sw else "--"
                
                f.write(f"| {label} | {at_pace} | {fmt_link(at)} | {sw_pace} | {fmt_link(sw)} |\n")

    # JSON GRAPH OUTPUT
    graph_data = []
    for i in range(MAX_DURATION_SECONDS):
        at = all_time_best[i]
        sw = six_week_best[i]
        if at:
            # We save as m/s for the graph, frontend can convert to pace if needed
            # OR we can save pace (seconds per mile) for easier graphing?
            # Let's save m/s (speed) because graphs usually go UP for better performance.
            # Pace graphs go DOWN for better performance, which is confusing visually.
            graph_data.append({
                "seconds": i + 1,
                "all_time_mps": at['mps'],
                "six_week_mps": sw['mps'] if sw else 0
            })
            
    with open(OUTPUT_GRAPH, "w") as f:
        json.dump(graph_data, f)
    
    print(f"✅ Updated {OUTPUT_MD} and {OUTPUT_GRAPH}")

if __name__ == "__main__":
    token = get_access_token()
    update_cache(token)
    generate_stats()
