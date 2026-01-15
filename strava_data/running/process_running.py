import requests
import os
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

# --- PATH CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(PARENT_DIR, '.env'))

ACTIVITY_LIST = os.path.join(PARENT_DIR, "activity_ids.txt")
CACHE_DIR = os.path.join(PARENT_DIR, "running_cache")
OUTPUT_MD = os.path.join(BASE_DIR, "my_running_prs.md")

BATCH_SIZE = 20 

DISTANCES = [
    "400m", "1/2 mile", "1k", "1 mile", "2 mile", 
    "5k", "10k", "15k", "10 mile", "20k", "Half-Marathon", "30k", "Marathon"
]

STRAVA_NAMES = {
    "400m": "400m",
    "1/2 mile": "1/2 mile",
    "1k": "1k", "1K": "1k",
    "1 mile": "1 mile", "1 Mile": "1 mile",
    "2 mile": "2 mile", "2 Mile": "2 mile",
    "5k": "5k", "5K": "5k",
    "10k": "10k", "10K": "10k",
    "15k": "15k", "15K": "15k",
    "10 mile": "10 mile", "10 Mile": "10 mile",
    "20k": "20k", "20K": "20k",
    "Half-Marathon": "Half-Marathon", "Half Marathon": "Half-Marathon",
    "30k": "30k", "30K": "30k",
    "Marathon": "Marathon"
}

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

def format_time(seconds):
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h > 0: return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

def update_cache(token):
    if not os.path.exists(ACTIVITY_LIST):
        print(f"❌ CRITICAL ERROR: Could not find master list at: {ACTIVITY_LIST}")
        return

    if not os.path.exists(CACHE_DIR): os.makedirs(CACHE_DIR)
    
    cached_ids = set([f.split('.')[0] for f in os.listdir(CACHE_DIR) if f.endswith('.json')])
    to_fetch = []
    
    with open(ACTIVITY_LIST, "r") as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) < 3: continue
            aid, atype = parts[0], parts[1]
            if atype == "Run" and aid not in cached_ids:
                to_fetch.append(aid)
    
    if not to_fetch:
        print("✅ Running Cache is up to date.")
    elif token:
        print(f"🏃 Fetching {len(to_fetch)} new runs...")
        headers = {'Authorization': f"Bearer {token}"}
        for i, act_id in enumerate(to_fetch[:BATCH_SIZE]):
            print(f"   [{i+1}/{BATCH_SIZE}] Caching {act_id}...", end="\r")
            try:
                r = requests.get(f"https://www.strava.com/api/v3/activities/{act_id}", headers=headers)
                if r.status_code == 429: break 
                if r.status_code != 200: continue
                data = r.json()
                
                cache_data = {
                    "id": data['id'],
                    "name": data.get('name', 'Unknown'),
                    "date": data.get('start_date_local', '')[:10],
                    "best_efforts": []
                }
                
                if 'best_efforts' in data:
                    for effort in data['best_efforts']:
                        cache_data['best_efforts'].append({
                            "name": effort['name'], 
                            "elapsed_time": effort['elapsed_time']
                        })
                
                with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
                    json.dump(cache_data, f)
            except Exception as e:
                print(f"Error {act_id}: {e}")
        print("\n💾 Cache update finished.")
    else:
        print("⚠️ No Token. Skipping Cache Update.")

def generate_report():
    print("📊 Generating Running Report from Cache...")
    if not os.path.exists(CACHE_DIR):
        print(f"⚠️ No cache directory found at {CACHE_DIR}")
        return

    files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.json')]
    if len(files) == 0: print("⚠️ Warning: Cache is empty.")
    
    today = datetime.now()
    six_weeks_ago = today - timedelta(weeks=6)
    
    all_time = {}
    six_week = {}
    
    for fname in files:
        with open(os.path.join(CACHE_DIR, fname), "r") as f:
            try: run = json.load(f)
            except: continue
        
        run_date = datetime.strptime(run['date'], "%Y-%m-%d")
        is_recent = run_date >= six_weeks_ago
        
        for effort in run.get('best_efforts', []):
            dist_key = STRAVA_NAMES.get(effort['name'])
            if not dist_key: continue
            
            entry = {'time': effort['elapsed_time'], 'date': run['date'], 'name': run.get('name', 'Run'), 'id': run['id']}

            if dist_key not in all_time or entry['time'] < all_time[dist_key]['time']:
                all_time[dist_key] = entry
            
            if is_recent:
                if dist_key not in six_week or entry['time'] < six_week[dist_key]['time']:
                    six_week[dist_key] = entry

    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("# 🏃 My Best Efforts (Running)\n\n")
        f.write("| Distance | All Time Best | Date | 6 Week Best | Date |\n")
        f.write("|---|---|---|---|---|\n")
        
        for dist in DISTANCES:
            at = all_time.get(dist)
            sw = six_week.get(dist)
            
            # Helper: Date is the Link
            def fmt_link(record):
                if not record: return "--"
                return f"[{record['date']}](https://www.strava.com/activities/{record['id']})"
            
            if at or sw:
                at_val = f"**{format_time(at['time'])}**" if at else "--"
                sw_val = f"{format_time(sw['time'])}" if sw else "--"
                
                f.write(f"| {dist} | {at_val} | {fmt_link(at)} | {sw_val} | {fmt_link(sw)} |\n")
                
    print(f"✅ Updated {OUTPUT_MD}")

if __name__ == "__main__":
    token = get_access_token()
    update_cache(token)
    generate_report()
