import requests
import os
from dotenv import load_dotenv

# Load .env only if it exists (for local testing)
load_dotenv()

# Config
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
        print(f"Response: {res.text}")
        exit(1)

def fetch_all_ids():
    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    page = 1
    all_activities = []
    
    print("🚀 Fetching Activity List...")
    
    while True:
        response = requests.get(ACTIVITIES_URL, headers=headers, params={'per_page': 200, 'page': page})
        data = response.json()
        
        if not data:
            break
            
        print(f"   - Page {page}: Found {len(data)} activities")
        
        for activity in data:
            summary = f"{activity['id']},{activity['type']},{activity['start_date_local'][:10]}"
            all_activities.append(summary)
            
        page += 1
        
    with open(OUTPUT_FILE, "w") as f:
        for line in all_activities:
            f.write(f"{line}\n")
            
    print(f"\n✅ Saved {len(all_activities)} activities to '{OUTPUT_FILE}'")

if __name__ == "__main__":
    fetch_all_ids()
