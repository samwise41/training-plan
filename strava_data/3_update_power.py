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
BATCH_SIZE = 20 

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
        print(f"Auth Error: {e}")
        exit(1)

def format_duration(seconds):
    h, r = divmod(seconds, 3600)
    m, s = divmod(r, 60)
    parts = []
    if h > 0: parts.append(f"{h}h")
    if m > 0: parts.append(f"{m}m")
    if s > 0 or not parts: parts.append(f"{s}s")
    return " ".join(parts)

def update_cache(token):
    """Fetches new rides and saves them to power_cache/"""
    if not os.path.exists(CACHE_DIR): os.makedirs(CACHE_DIR)
    
    # Get list of already cached IDs
    cached_ids = set([f.split('.')[0] for f in os.listdir(CACHE_DIR) if f.endswith('.json')])
    
    to_process = []
    if os.path.exists(ACTIVITY_LIST):
        with open(ACTIVITY_LIST, "r") as f:
            for line in f:
                parts = line.strip().split(',')
                if len(parts) < 3: continue
                aid, atype = parts[0], parts[1]
                # Only cache Rides that aren't cached yet
                if atype == "Ride" and aid not in cached_ids:
                    to_process.append(aid)

    if not to_process:
        print("✅ Cache is up to date.")
        return

    print(f"⚡ Downloading {len(to_process)} new rides to cache...")
    headers = {'Authorization': f"Bearer {token}"}
    
    for i, act_id in enumerate(to_process[:BATCH_SIZE]):
        print(f"   [{i+1}/{BATCH_SIZE}] Fetching {act_id}...", end="\r")
        
        # 1. Get Streams
        url = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
        r = requests.get(url, headers=headers, params={'keys': 'watts', 'key_by_type': 'true'})
        if r.status_code != 200: continue
        streams = r.json()
        
        # 2. Handle missing power
        if 'watts' not in streams:
            # Save empty placeholder so we don't fetch again
            with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
                json.dump({'id': act_id, 'no_power': True}, f)
            continue

        # 3. Get Details (Name/Date)
        r2 = requests.get(f"https://www.strava.com/api/v3/activities/{act_id}", headers=headers)
        details = r2.json()

        # 4. Calculate Curve
        power_series = pd.Series(streams['watts']['data'])
        limit = min(len(power_series), MAX_DURATION_SECONDS)
        curve = []
        for seconds in range(1, limit + 1):
            peak = int(power_series.rolling(window=seconds).mean().max())
            curve.append(peak)

        # 5. Save to Cache
        data = {
            'id': act_id,
            'name': details['name'],
            'date': details['start_date_local'][:10],
            'power_curve': curve
        }
        with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
            json.dump(data, f)
            
    print("\n💾 Cache update complete.")

def generate_stats():
    """Reads ALL cache files and regenerates the MD/JSON output"""
    print("📊 Regenerating Power Profile from Cache...")
    
    files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.json')]
    if not files: return

    # Arrays for 1s to 21600s
    all_time_best = [None] * MAX_DURATION_SECONDS
    six_week_best = [None] * MAX_DURATION_SECONDS
    
    today = datetime.now()
    six_weeks_ago = today - timedelta(weeks=6)
    
    # Process every file in cache
    for fname in files:
        with open(os.path.join(CACHE_DIR, fname), "r") as f:
            ride = json.load(f)
            
        if 'power_curve' not in ride: continue
        
        ride_date = datetime.strptime(ride['date'], "%Y-%m-%d")
        is_recent = ride_date >= six_weeks_ago
        curve = ride['power_curve']
        
        # Merge into global bests
        for i, watts in enumerate(curve):
            if i >= MAX_DURATION_SECONDS: break
            
            # Update All Time
            if all_time_best[i] is None or watts > all_time_best[i]['watts']:
                all_time_best[i] = {'watts': watts, 'date': ride['date'], 'name': ride['name'], 'id': ride['id']}
            
            # Update 6 Week
            if is_recent:
                if six_week_best[i] is None or watts > six_week_best[i]['watts']:
                    six_week_best[i] = {'watts': watts, 'date': ride['date'], 'name': ride['name'], 'id': ride['id']}

    # WRITE MARKDOWN
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("# ⚡ Power Profile (1s - 6h)\n\n")
        f.write("| Duration | All Time Best | 6 Week Best | Activity Link |\n")
        f.write("|---|---|---|---|\n")
        
        for i in range(MAX_DURATION_SECONDS):
            at = all_time_best[i]
            sw = six_week_best[i]
            if at:
                label = format_duration(i + 1)
                at_str = f"**{at['watts']}w**"
                sw_str = f"{sw['watts']}w" if sw else "--"
                link = f"[View](https://www.strava.com/activities/{at['id']})"
                f.write(f"| {label} | {at_str} | {sw_str} | {link} |\n")

    # WRITE GRAPH JSON
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
    t = get_access_token()
    update_cache(t)
    generate_stats()
