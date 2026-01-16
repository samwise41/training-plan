import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
ACTIVITY_LIST = "activity_ids.txt"
CACHE_DIR = "running_cache"

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

def main():
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)

    if not os.path.exists(ACTIVITY_LIST):
        print(f"❌ {ACTIVITY_LIST} not found. Run Script 1 first.")
        return

    # 1. Identify Runs to Cache
    runs_to_process = []
    with open(ACTIVITY_LIST, "r") as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) < 3: continue
            
            act_id, act_type, act_date = parts[0], parts[1], parts[2]
            
            # Logic: Must be Run, Must NOT be in cache
            cache_path = os.path.join(CACHE_DIR, f"{act_id}.json")
            if act_type == "Run" and not os.path.exists(cache_path):
                runs_to_process.append(act_id)

    if not runs_to_process:
        print("✅ Running Cache is up to date.")
        return

    print(f"🏃 Seeding Running Cache with {len(runs_to_process)} activities...")
    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    count = 0
    for act_id in runs_to_process:
        count += 1
        print(f"   [{count}/{len(runs_to_process)}] Fetching {act_id}...", end="\r")
        
        try:
            # Fetch Activity Details
            url = f"https://www.strava.com/api/v3/activities/{act_id}"
            res = requests.get(url, headers=headers)
            
            if res.status_code == 429:
                print("\n⚠️ Rate Limit Exceeded. Try again later.")
                break
            if res.status_code != 200: 
                print(f"\n⚠️ Error {res.status_code} on {act_id}")
                continue
                
            data = res.json()
            
            # Extract only what we need
            cache_data = {
                "id": data['id'],
                "name": data.get('name', 'Unknown Run'),
                "date": data.get('start_date_local', '')[:10],
                "best_efforts": []
            }
            
            # Standardize Best Efforts
            if 'best_efforts' in data:
                for effort in data['best_efforts']:
                    cache_data['best_efforts'].append({
                        "name": effort['name'], # e.g. "5k"
                        "elapsed_time": effort['elapsed_time'],
                        "moving_time": effort['moving_time']
                    })
            
            # Save to Cache
            with open(os.path.join(CACHE_DIR, f"{act_id}.json"), "w") as f:
                json.dump(cache_data, f)
                
        except Exception as e:
            print(f"\n❌ Exception on {act_id}: {e}")

    print("\n✅ Seeding complete.")

if __name__ == "__main__":
    main()
