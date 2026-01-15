import requests
import os
import pandas as pd
import json
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
BASELINE_IDS = [
    16776448314, 17046568553, 15671097940, 14554194008, 15704986795,
    15286860946, 15059068928, 15864321973, 14826696597, 16820057363,
    16270588110, 16517205913, 16758074733, 15785616381, 16923876221,
    14859845151, 15482056744, 15353424386, 14655181864
]

MAX_DURATION_SECONDS = 21600 # 6 Hours
CACHE_DIR = "power_cache"

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

def process_ride(act_id, token):
    headers = {'Authorization': f"Bearer {token}"}
    
    # 1. Details
    url_det = f"https://www.strava.com/api/v3/activities/{act_id}"
    r1 = requests.get(url_det, headers=headers)
    if r1.status_code != 200: return None
    details = r1.json()
    
    # 2. Streams
    url_str = f"https://www.strava.com/api/v3/activities/{act_id}/streams"
    r2 = requests.get(url_str, headers=headers, params={'keys': 'watts', 'key_by_type': 'true'})
    if r2.status_code != 200: return None
    streams = r2.json()
    
    if 'watts' not in streams: return None
    
    # 3. Calculate Curve (This is the heavy math, done once!)
    print(f"   ⚡ Calculating curve for {act_id}...")
    power_series = pd.Series(streams['watts']['data'])
    limit = min(len(power_series), MAX_DURATION_SECONDS)
    
    # Create array [1s_max, 2s_max, 3s_max...]
    curve = []
    for seconds in range(1, limit + 1):
        peak = int(power_series.rolling(window=seconds).mean().max())
        curve.append(peak)
        
    return {
        'id': act_id,
        'name': details['name'],
        'date': details['start_date_local'][:10],
        'power_curve': curve
    }

def main():
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
        
    token = get_access_token()
    print(f"🚀 Seeding Cache with {len(BASELINE_IDS)} rides...")
    
    for act_id in BASELINE_IDS:
        file_path = os.path.join(CACHE_DIR, f"{act_id}.json")
        if os.path.exists(file_path):
            print(f"   ✅ {act_id} already cached.")
            continue
            
        data = process_ride(act_id, token)
        if data:
            with open(file_path, "w") as f:
                json.dump(data, f)
            print(f"   💾 Saved {act_id} ({data['name']})")
        else:
            print(f"   ⚠️ Skipped {act_id} (No power data)")

    print("\n✅ Seed Complete. You can now run the Maintenance Script.")

if __name__ == "__main__":
    main()
