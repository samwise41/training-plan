import requests
import os
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
ACTIVITY_LIST = "activity_ids.txt"
CACHE_DIR = "running_cache"
OUTPUT_MD = "my_running_prs.md"
BATCH_SIZE = 20 

# Distances to track
DISTANCES = [
    "400m", "1/2 mile", "1k", "1 mile", "2 mile", 
    "5k", "10k", "15k", "10 mile", "20k", "Half-Marathon", "30k", "Marathon"
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

def format_time(seconds):
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h > 0: return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

def update_cache(token):
    # If no token, skip update but don't crash
    if not token:
        print("⚠️ No API Token. Skipping cache update.")
        return

    if not os.path.exists(CACHE_DIR): os.makedirs(CACHE_DIR)
    
    cached_ids = set([f.split('.')[0] for f in os.listdir(CACHE_DIR) if f.endswith('.json')])
    to_fetch = []
    
    if os.path.exists(ACTIVITY_LIST):
        with open(ACTIVITY_LIST, "r") as f:
            for line in f:
                parts = line.strip().split(',')
                if len(parts) < 3: continue
                aid, atype = parts[0], parts[1]
                if atype == "Run" and aid not in cached_ids:
                    to_fetch.append(aid)
    
    if not to_fetch:
        print("✅ Running Cache is up to date.")
        return

    print(f"🏃 Fetching {len(to_fetch)} new runs...")
    headers = {'Authorization': f"Bearer {token}"}
    
    for i, act_id in enumerate(to_fetch[:BATCH_SIZE]):
        print(f"   [{i+1}/{BATCH_SIZE}] Caching {act_id}...", end="\r")
        try:
            r = requests.get(f"https://www.strava.com/api/v3/activities/{act_id}", headers=headers)
            if r.status_code == 429:
                print(f"\n⚠️ Rate Limit Exceeded on {act_id}. Stopping early.")
                break # Stop fetching, but proceed to report generation
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
            
    print("\n💾 Cache update process finished.")

def generate_report():
    print("📊 Generating Running Report from Cache...")
    if not os.path.exists(CACHE_DIR):
        print("⚠️ No cache directory found. Skipping report.")
        return

    today = datetime.now()
    six_weeks_ago = today - timedelta(weeks=6)
    
    all_time = {}
    six_week = {}
    
    files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.json')]
    print(f"   (Analyzing {len(files)} cached runs)")
    
    for fname in files:
        with open(os.path.join(CACHE_DIR, fname), "r") as f:
            try:
                run = json.load(f)
            except json.JSONDecodeError:
                continue
            
        run_date = datetime.strptime(run['date'], "%Y-%m-%d")
        is_recent = run_date >= six_weeks_ago
        
        for effort in run.get('best_efforts', []):
            dist = effort['name']
            time = effort['elapsed_time']
            
            def update_best(best_dict):
                if dist not in best_dict or time < best_dict[dist]['time']:
                    best_dict[dist] = {'time': time, 'date': run['date'], 'id': run['id']}

            update_best(all_time)
            if is_recent: update_best(six_week)

    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("# 🏃 My Best Efforts (Running)\n\n")
        f.write("| Distance | All Time Best | Link | 6 Week Best | Link |\n")
        f.write("|---|---|---|---|---|\n")
        
        for dist in DISTANCES:
            at = all_time.get(dist)
            sw = six_week.get(dist)
            
            if at or sw:
                # All Time Column
                at_str = f"**{format_time(at['time'])}**" if at else "--"
                at_link = f"[View](https://www.strava.com/activities/{at['id']})" if at else "--"

                # 6 Week Column
                sw_str = f"{format_time(sw['time'])}" if sw else "--"
                sw_link = f"[View](https://www.strava.com/activities/{sw['id']})" if sw else "--"
                
                f.write(f"| {dist} | {at_str} | {at_link} | {sw_str} | {sw_link} |\n")
                
    print(f"✅ Updated {OUTPUT_MD}")

if __name__ == "__main__":
    # 1. Try to get Token
    token = get_access_token()
    
    # 2. Try to Update Cache (will skip gracefully if token failed)
    update_cache(token)
    
    # 3. Always Generate Report (using whatever exists in cache)
    generate_report()
