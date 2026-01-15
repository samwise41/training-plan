import requests
import os
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
# The specific rides containing your PRs
BASELINE_IDS = [
    16776448314, 17046568553, 15671097940, 14554194008, 15704986795,
    15286860946, 15059068928, 15864321973, 14826696597, 16820057363,
    16270588110, 16517205913, 16758074733, 15785616381, 16923876221,
    14859845151, 15482056744, 15353424386, 14655181864
]

# Standard Power Durations to track
# Label, Seconds
DURATIONS = [
    ("1s", 1), ("5s", 5), ("15s", 15), ("30s", 30),
    ("1min", 60), ("2min", 120), ("5min", 300),
    ("10min", 600), ("20min", 1200), ("30min", 1800), ("1hr", 3600)
]

OUTPUT_FILE = "my_power_profile.md"

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

def fetch_activity_details(act_id, headers):
    """Get the summary to grab the Name and Date"""
    url = f"https://www.strava.com/api/v3/activities/{act_id}"
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        return r.json()
    return None

def fetch_streams(act_id, headers):
    """Get the raw second-by-second power data"""
    url = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
    params = {'keys': 'watts', 'key_by_type': 'true'}
    r = requests.get(url, headers=headers, params=params)
    if r.status_code == 200:
        return r.json()
    return None

def process_baseline():
    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    # Structure to hold the ALL-TIME BEST for each duration
    # { 5: {'watts': 400, 'date': '...', 'id': ...}, ... }
    all_time_bests = {sec: {'watts': 0} for _, sec in DURATIONS}
    
    print(f"🚴 Processing {len(BASELINE_IDS)} baseline rides for Peak Power...")

    for act_id in BASELINE_IDS:
        # 1. Get Details (for Name/Date)
        details = fetch_activity_details(act_id, headers)
        if not details: 
            print(f"   ⚠️ Could not fetch details for {act_id}")
            continue
            
        act_name = details['name']
        act_date = details['start_date_local'][:10]
        
        # 2. Get Streams (Power Data)
        streams = fetch_streams(act_id, headers)
        if not streams or 'watts' not in streams:
            print(f"   ⚠️ No power data for {act_id} ({act_name})")
            continue

        # 3. Calculate Curves using Pandas
        print(f"   ⚡ Calculating curve for: {act_name} ({act_date})...")
        power_series = pd.Series(streams['watts']['data'])
        
        for label, seconds in DURATIONS:
            # Skip if ride is shorter than the duration
            if len(power_series) < seconds:
                continue
                
            # Rolling Max Average
            peak = power_series.rolling(window=seconds).mean().max()
            
            if pd.notna(peak):
                peak_w = int(peak)
                # Check if this is a new All-Time PR
                if peak_w > all_time_bests[seconds]['watts']:
                    all_time_bests[seconds] = {
                        'watts': peak_w,
                        'date': act_date,
                        'name': act_name,
                        'id': act_id
                    }

    # 4. Generate Markdown Trophy Case
    print(f"\n🏆 Generating {OUTPUT_FILE}...")
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("# ⚡ My Best Power Efforts\n\n")
        f.write("| Duration | Watts | Date | Activity |\n")
        f.write("|---|---|---|---|\n")
        
        for label, seconds in DURATIONS:
            data = all_time_bests[seconds]
            if data['watts'] > 0:
                link = f"[{data['name']}](https://www.strava.com/activities/{data['id']})"
                f.write(f"| **{label}** | **{data['watts']}w** | {data['date']} | {link} |\n")
            else:
                f.write(f"| {label} | -- | -- | -- |\n")

    print("✅ Done! Your Power Profile is ready.")

if __name__ == "__main__":
    process_baseline()
