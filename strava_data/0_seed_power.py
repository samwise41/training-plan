import requests
import os
import pandas as pd
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
# Your specific list of PR rides
BASELINE_IDS = [
    16776448314, 17046568553, 15671097940, 14554194008, 15704986795,
    15286860946, 15059068928, 15864321973, 14826696597, 16820057363,
    16270588110, 16517205913, 16758074733, 15785616381, 16923876221,
    14859845151, 15482056744, 15353424386, 14655181864
]

MAX_DURATION_SECONDS = 21600 # 6 Hours

# Files
OUTPUT_GRAPH_FILE = "power_curve_graph.json"
OUTPUT_MD_FILE = "my_power_profile.md"
DB_FILE = "power_bests.json" # For the update script to use later

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
    """Formats 3665 -> '1h 1m 5s'"""
    h, r = divmod(seconds, 3600)
    m, s = divmod(r, 60)
    parts = []
    if h > 0: parts.append(f"{h}h")
    if m > 0: parts.append(f"{m}m")
    if s > 0 or not parts: parts.append(f"{s}s")
    return " ".join(parts)

def fetch_activity_data(act_id, headers):
    # 1. Details
    url_det = f"https://www.strava.com/api/v3/activities/{act_id}"
    r_det = requests.get(url_det, headers=headers)
    if r_det.status_code != 200: return None
    details = r_det.json()

    # 2. Streams (Power)
    url_str = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
    r_str = requests.get(url_str, headers=headers, params={'keys': 'watts', 'key_by_type': 'true'})
    if r_str.status_code != 200: return None
    streams = r_str.json()

    if 'watts' not in streams: return None

    return {
        'id': act_id,
        'name': details['name'],
        'date': details['start_date_local'][:10],
        'watts': streams['watts']['data']
    }

def process_power():
    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    # Storage for every second (0-based index corresponds to 1s..21600s)
    all_time_data = [None] * MAX_DURATION_SECONDS
    six_week_data = [None] * MAX_DURATION_SECONDS
    
    # 6-Week Cutoff
    today = datetime.now()
    six_weeks_ago = today - timedelta(weeks=6)
    print(f"📅 6-Week Cutoff: {six_weeks_ago.strftime('%Y-%m-%d')}")

    print(f"🚴 Processing {len(BASELINE_IDS)} baseline rides...")

    for act_id in BASELINE_IDS:
        data = fetch_activity_data(act_id, headers)
        if not data: 
            print(f"   ⚠️ Skipped {act_id}")
            continue

        act_date_obj = datetime.strptime(data['date'], "%Y-%m-%d")
        is_recent = act_date_obj >= six_weeks_ago
        
        print(f"   ⚡ Scanning: {data['name']} ({data['date']})")
        
        power_series = pd.Series(data['watts'])
        limit = min(len(power_series), MAX_DURATION_SECONDS)

        # --- CALCULATE EVERY SECOND ---
        for seconds in range(1, limit + 1):
            idx = seconds - 1
            
            # Find best power for this duration in this specific ride
            peak = power_series.rolling(window=seconds).mean().max()
            
            if pd.notna(peak):
                peak_w = int(peak)
                
                # Check All-Time
                if all_time_data[idx] is None or peak_w > all_time_data[idx]['watts']:
                    all_time_data[idx] = {
                        'watts': peak_w,
                        'date': data['date'],
                        'name': data['name'],
                        'id': data['id']
                    }
                
                # Check 6-Week
                if is_recent:
                    if six_week_data[idx] is None or peak_w > six_week_data[idx]['watts']:
                        six_week_data[idx] = {
                            'watts': peak_w,
                            'date': data['date'],
                            'name': data['name'],
                            'id': data['id']
                        }

    # --- SAVE 1: JSON DATABASE (For Graph & Future Updates) ---
    # We save a structure that the daily script can easily read
    # Format: {"1": {"watts": 500, ...}, "2": ...}
    db_export = {}
    for i in range(MAX_DURATION_SECONDS):
        sec = i + 1
        entry = all_time_data[i]
        if entry:
            db_export[str(sec)] = entry
            
    with open(DB_FILE, "w") as f:
        json.dump(db_export, f)
    print(f"\n💾 Saved DB to {DB_FILE}")

    # --- SAVE 2: GRAPH JSON (Simple Array) ---
    graph_data = []
    for i in range(MAX_DURATION_SECONDS):
        at = all_time_data[i]
        sw = six_week_data[i]
        if at:
            graph_data.append({
                "seconds": i + 1,
                "all_time_watts": at['watts'],
                "six_week_watts": sw['watts'] if sw else None
            })
    with open(OUTPUT_GRAPH_FILE, "w") as f:
        json.dump(graph_data, f)
    print(f"📈 Saved Graph Data to {OUTPUT_GRAPH_FILE}")

    # --- SAVE 3: MARKDOWN TABLE (The Huge Table) ---
    with open(OUTPUT_MD_FILE, "w", encoding="utf-8") as f:
        f.write("# ⚡ Complete Power Profile (1s - 6h)\n\n")
        f.write("| Duration | All Time Best | 6 Week Best | Activity Link |\n")
        f.write("|---|---|---|---|\n")
        
        for i in range(MAX_DURATION_SECONDS):
            sec = i + 1
            at = all_time_data[i]
            sw = six_week_data[i]
            
            if at:
                label = format_duration(sec)
                at_str = f"**{at['watts']}w**"
                sw_str = f"{sw['watts']}w" if sw else "--"
                link = f"[View](https://www.strava.com/activities/{at['id']})"
                
                f.write(f"| {label} | {at_str} | {sw_str} | {link} |\n")

    print(f"🏆 Saved Summary Table to {OUTPUT_MD_FILE}")

if __name__ == "__main__":
    process_power()
