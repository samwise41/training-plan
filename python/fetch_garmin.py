import json
import os
import getpass
from garminconnect import Garmin

# --- CONFIGURATION ---
JSON_FILE = 'my_garmin_data_ALL.json'
FETCH_LIMIT = 50  # Number of recent activities to fetch

# --- CREDENTIALS ---
# Option A: Hardcode them (Not recommended if sharing code)
EMAIL = "YOUR_GARMIN_EMAIL@example.com"
PASSWORD = "YOUR_GARMIN_PASSWORD"

# Option B: Use Environment Variables (Safer)
# EMAIL = os.getenv("GARMIN_EMAIL")
# PASSWORD = os.getenv("GARMIN_PASSWORD")

def load_existing_data():
    if os.path.exists(JSON_FILE):
        try:
            with open(JSON_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []
    return []

def save_data(data):
    # Sort by date descending (newest first)
    data.sort(key=lambda x: x.get('startTimeLocal', ''), reverse=True)
    
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    print(f"💾 Saved {len(data)} total activities to {JSON_FILE}")

def main():
    # 1. Handle Login
    email = EMAIL
    password = PASSWORD
    
    # If not hardcoded, prompt user
    if "YOUR_GARMIN" in email:
        email = input("Enter Garmin Email: ")
        password = getpass.getpass("Enter Garmin Password: ")

    try:
        print("🔐 Authenticating with Garmin Connect...")
        client = Garmin(email, password)
        client.login()
    except Exception as e:
        print(f"❌ Login Failed: {e}")
        return

    # 2. Fetch Recent Activities
    print(f"📡 Fetching last {FETCH_LIMIT} activities...")
    try:
        new_activities = client.get_activities(0, FETCH_LIMIT)
        print(f"✅ Retrieved {len(new_activities)} activities from Garmin.")
    except Exception as e:
        print(f"❌ Fetch Failed: {e}")
        return

    # 3. Merge with History
    print("🔄 Merging with local archive...")
    existing_data = load_existing_data()
    
    # Create a dictionary of existing items by ID for fast updating
    # (activityId is unique)
    db = {str(item['activityId']): item for item in existing_data}
    
    new_count = 0
    update_count = 0
    
    for act in new_activities:
        aid = str(act['activityId'])
        if aid not in db:
            db[aid] = act
            new_count += 1
        else:
            # Optional: Update existing in case stats changed?
            # Let's update just to be safe
            db[aid] = act 
            update_count += 1

    # Convert back to list
    final_list = list(db.values())
    
    # 4. Save
    print(f"   - Added: {new_count}")
    print(f"   - Updated: {update_count}")
    save_data(final_list)

if __name__ == "__main__":
    main()