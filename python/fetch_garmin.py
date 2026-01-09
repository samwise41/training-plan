import json
import os
from garminconnect import Garmin

# --- CONFIGURATION ---
# This ensures the script always finds the JSON file relative to itself, 
# regardless of where GitHub Actions initiates the run.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')
FETCH_LIMIT = 50 

# --- CREDENTIALS ---
# GitHub Actions injects these from your Repository Secrets
EMAIL = os.environ.get('GARMIN_EMAIL')
PASSWORD = os.environ.get('GARMIN_PASSWORD')

def load_existing_data():
    if os.path.exists(JSON_FILE):
        try:
            with open(JSON_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Could not read existing JSON: {e}")
            return []
    return []

def save_data(data):
    # Sort by date descending
    data.sort(key=lambda x: x.get('startTimeLocal', ''), reverse=True)
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    print(f"💾 Saved {len(data)} total activities to {JSON_FILE}")

def main():
    # 1. Validation for Automation
    if not EMAIL or not PASSWORD:
        print("❌ Error: GARMIN_EMAIL or GARMIN_PASSWORD environment variables are missing.")
        print("Check your GitHub Repository Secrets and your YAML 'env' section.")
        return

    try:
        print("🔐 Authenticating with Garmin Connect...")
        client = Garmin(EMAIL, PASSWORD)
        client.login()
    except Exception as e:
        print(f"❌ Login Failed: {e}")
        return

    # 2. Fetch
    print(f"📡 Fetching last {FETCH_LIMIT} activities...")
    try:
        new_activities = client.get_activities(0, FETCH_LIMIT)
        print(f"✅ Retrieved {len(new_activities)} activities from Garmin.")
    except Exception as e:
        print(f"❌ Fetch Failed: {e}")
        return

    # 3. Merge
    print("🔄 Merging with local archive...")
    existing_data = load_existing_data()
    db = {str(item['activityId']): item for item in existing_data}
    
    new_count = 0
    update_count = 0
    for act in new_activities:
        aid = str(act['activityId'])
        if aid not in db:
            db[aid] = act
            new_count += 1
        else:
            db[aid] = act 
            update_count += 1

    print(f"   - Added: {new_count} | Updated: {update_count}")
    save_data(list(db.values()))

if __name__ == "__main__":
    main()
