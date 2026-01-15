import requests
import os
import pandas as pd
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
BASELINE_IDS = [
    16776448314, 17046568553, 15671097940, 14554194008, 15704986795,
    15286860946, 15059068928, 15864321973, 14826696597, 16820057363,
    16270588110, 16517205913, 16758074733, 15785616381, 16923876221,
    14859845151, 15482056744, 15353424386, 14655181864
]

# Calculate every second up to 2 hours (7200s)
MAX_DURATION_SECONDS = 7200 

OUTPUT_GRAPH_FILE = "power_curve_graph.json"
OUTPUT_MD_FILE = "my_power_profile.md"

# Key intervals for the Markdown Summary Table
KEY_INTERVALS = [
    ("1s", 1), ("5s", 5), ("15s", 15), ("30s", 30),
    ("1min", 60), ("2min", 120), ("5min", 300),
    ("10min", 600), ("20min", 1200), ("30min", 1800), ("1hr", 3600), ("2hr", 7200)
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
    if res.status_code != 200:
        print("Auth failed.")
        exit(1)
    return res.json()['access_token']

def fetch_activity_data(act_id, headers):
    # 1. Get Details (Date/Name)
    url_det = f"https://www.strava.com/api/v3/activities/{act_id}"
    r_det = requests.get(url_det, headers=headers)
    if r_det.status_code != 200: return None
    details = r_det.json()

    # 2. Get Streams (Watts)
    url_str = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
    r_str = requests.get(url_str, headers=headers, params={'keys': 'watts', 'key_by_type': 'true'})
    if r_str.status_code != 200: return None
    streams = r_str.json()

    if 'watts' not in streams: return None

    return {
        'id': act_id,
        'name': details['name'],
        'date': details['start_date_local'][:10], # YYYY-MM-DD
        'watts': streams['watts']['data']
    }

def process_power():
    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    # Initialize arrays for every second (index 0 = 1s, index 1 = 2s...)
    # Storing tuples: (watts, activity_id, activity_date)
    all_time_curve = [0] * MAX_DURATION_SECONDS
    six_week_curve = [0] * MAX_DURATION_SECONDS
    
    # Calculate 6-week cutoff
    today = datetime.now()
    six_weeks_ago = today - timedelta(weeks=6)
    print(f"📅 6-Week Cutoff Date: {six_weeks_ago.strftime('%Y-%m-%d')}")

    print(f"🚴 Processing {len(BASELINE_IDS)} rides...")

    for act_id in BASELINE_IDS:
        data = fetch_activity_data(act_id, headers)
        if not data: 
            print(f"   ⚠️ Skipped {act_id} (No data/watts)")
            continue

        act_date_obj = datetime.strptime(data['date'], "%Y-%m-%d")
        is_recent = act_date_obj >= six_weeks_ago
        
        print(f"   ⚡ Calculating: {data['name']} ({data['date']}) {'[RECENT]' if is_recent else ''}")
        
        power_series = pd.Series(data['watts'])
        max_duration = min(len(power_series), MAX_DURATION_SECONDS)

        # THE HEAVY LIFTING: Loop 1s -> End of ride
        # Optimized: We pre-calculate rolling maxes for this ride
        for seconds in range(1, max_duration + 1):
            # Find best power for this specific duration in this specific ride
            peak = power_series.rolling(window=seconds).mean().max()
            
            if pd.notna(peak):
                peak = int(peak)
                idx = seconds - 1 # Array index is 0-based
                
                # Update All-Time
                if peak > all_time_curve[idx]:
                    all_time_curve[idx] = peak
                
                # Update 6-Week (if applicable)
                if is_recent and peak > six_week_curve[idx]:
                    six_week_curve[idx] = peak

    # --- OUTPUT 1: JSON FOR GRAPHING ---
    # Creates a clean list of objects: [{"seconds": 1, "all_time": 900, "6_week": 850}, ...]
    graph_data = []
    for i in range(MAX_DURATION_SECONDS):
        if all_time_curve[i] > 0:
            graph_data.append({
                "duration_sec": i + 1,
                "all_time_watts": all_time_curve[i],
                "six_week_watts": six_week_curve[i] if six_week_curve[i] > 0 else None
            })
    
    with open(OUTPUT_GRAPH_FILE, "w") as f:
        json.dump(graph_data, f)
    print(f"\n📈 Saved full resolution graph data to {OUTPUT_GRAPH_FILE}")

    # --- OUTPUT 2: MARKDOWN SUMMARY ---
    with open(OUTPUT_MD_FILE, "w", encoding="utf-8") as f:
        f.write("# ⚡ Power Profile (All Time vs 6 Weeks)\n\n")
        f.write("| Duration | All Time Best | 6 Week Best |\n")
        f.write("|---|---|---|\n")
        
        for label, seconds in KEY_INTERVALS:
            if seconds <= len(all_time_curve):
                at_val = all_time_curve[seconds-1]
                sw_val = six_week_curve[seconds-1]
                
                at_str = f"**{at_val}w**" if at_val > 0 else "--"
                sw_str = f"{sw_val}w" if sw_val > 0 else "--"
                
                f.write(f"| {label} | {at_str} | {sw_str} |\n")

    print(f"🏆 Saved summary table to {OUTPUT_MD_FILE}")

if __name__ == "__main__":
    process_power()
