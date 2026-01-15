import requests
import os
from dotenv import load_dotenv

load_dotenv()

AUTH_URL = "https://www.strava.com/oauth/token"
ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities"
OUTPUT_FILE = "activity_ids.txt"

def get_access_token():
    payload = {
        'client_id': os.getenv('STRAVA_CLIENT_ID'),
        'client_secret': os.getenv('STRAVA_CLIENT_SECRET'),
        'refresh_token': os.getenv('STRAVA_REFRESH_TOKEN'),
        'grant_type': 'refresh_token',
        'f': 'json'
    }
    try:
        res = requests.post(AUTH_URL, data=payload, verify=True)
        res.raise_for_status()
        return res.json()['access_token']
    except Exception as e:
        print(f"❌ Auth Error: {e}")
        exit(1)

def fetch_new_ids():
    # 1. Load existing IDs to know when to stop
    existing_activities = []
    existing_ids = set()
    
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r") as f:
            for line in f:
                existing_activities.append(line.strip())
                parts = line.split(',')
                if parts: existing_ids.add(parts[0])
    
    print(f"📂 Database contains {len(existing_ids)} activities.")

    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    new_activities = []
    page = 1
    keep_fetching = True
    
    print("🚀 Checking for new activities...")
    
    while keep_fetching:
        response = requests.get(ACTIVITIES_URL, headers=headers, params={'per_page': 50, 'page': page})
        data = response.json()
        
        if not data:
            break
            
        for activity in data:
            act_id = str(activity['id'])
            
            # STOP condition: We found an activity we already have
            if act_id in existing_ids:
                keep_fetching = False
                continue
                
            # If new, add to our temp list
            summary = f"{act_id},{activity['type']},{activity['start_date_local'][:10]}"
            new_activities.append(summary)
            
        page += 1
        
    if new_activities:
        print(f"✨ Found {len(new_activities)} new activities!")
        # Write NEW data followed by OLD data (Preserves newest-first order)
        with open(OUTPUT_FILE, "w") as f:
            for line in new_activities:
                f.write(f"{line}\n")
            for line in existing_activities:
                f.write(f"{line}\n")
        print(f"✅ Updated '{OUTPUT_FILE}'")
    else:
        print("💤 No new activities found.")

if __name__ == "__main__":
    fetch_new_ids()
