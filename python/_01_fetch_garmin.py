import json
import os
import sys
from garminconnect import Garmin

# --- ROBUST IMPORT LOGIC ---
# Ensure we can import 'modules.config' regardless of how this script is run
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(SCRIPT_DIR)

try:
    from modules import config
except ImportError:
    # If running from root, try adding python/ to path
    sys.path.append(os.path.join(os.getcwd(), 'python'))
    from modules import config

# --- CONFIGURATION ---
# Use the Single Source of Truth from config.py
JSON_FILE = config.GARMIN_JSON
FETCH_LIMIT = 40

# --- CREDENTIALS ---
EMAIL = os.environ.get('GARMIN_EMAIL')
PASSWORD = os.environ.get('GARMIN_PASSWORD')

def load_existing_data():
    if os.path.exists(JSON_FILE):
        try:
            with open(JSON_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []
    return []

def save_data(data):
    # DEFENSIVE: Ensure the 'garmin_data' folder exists before writing
    os.makedirs(os.path.dirname(JSON_FILE), exist_ok=True)
    
    data.sort(key=lambda x: x.get('startTimeLocal', ''), reverse=True)
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    print(f"💾 Saved {len(data)} activities to: {JSON_FILE}")

def main():
    if not EMAIL or not PASSWORD:
        print("❌ Error: Credentials missing (GARMIN_EMAIL / GARMIN_PASSWORD).")
        return

    try:
        print("🔐 Authenticating with Garmin...")
        client = Garmin(EMAIL, PASSWORD) 
        client.login()
    except Exception as e:
        print(f"❌ Login Failed: {e}")
        return

    print(f"📡 Fetching summaries for last {FETCH_LIMIT} activities...")
    try:
        new_activities = client.get_activities(0, FETCH_LIMIT)
    except Exception as e:
        print(f"❌ Fetch Failed: {e}")
        return

    print("🔄 performing Deep Fetch for RPE data...")
    existing_data = load_existing_data()
    db = {str(item['activityId']): item for item in existing_data}
    
    new_count = 0
    updated_count = 0

    for act in new_activities:
        aid = str(act['activityId'])
        is_new = aid not in db
        
        # Fetch if new OR if existing record is missing RPE
        should_fetch = is_new or (aid in db and 'perceivedEffort' not in db[aid])
        
        if should_fetch:
            try:
                # DEEP FETCH
                full = client.get_activity(aid)
                
                rpe = None
                feeling = None
                
                # --- LOCATION 1: summaryDTO ---
                if 'summaryDTO' in full:
                    raw_rpe = full['summaryDTO'].get('directWorkoutRpe')
                    raw_feel = full['summaryDTO'].get('directWorkoutFeel')
                    
                    if raw_rpe is not None:
                        rpe = int(raw_rpe / 10) 
                    
                    if raw_feel is not None:
                        feeling = int((raw_feel / 25) + 1) 

                # --- LOCATION 2: selfEvaluation ---
                elif 'selfEvaluation' in full:
                    rpe = full['selfEvaluation'].get('perceivedEffort')
                    feeling = full['selfEvaluation'].get('feeling')

                # --- LOCATION 3: metadataDTO ---
                elif 'metadataDTO' in full and 'selfEvaluation' in full['metadataDTO']:
                    rpe = full['metadataDTO']['selfEvaluation'].get('perceivedEffort')
                    feeling = full['metadataDTO']['selfEvaluation'].get('feeling')

                # UPDATE OBJECTS
                if rpe is not None:
                    act['perceivedEffort'] = rpe
                    if aid in db: db[aid]['perceivedEffort'] = rpe
                    updated_count += 1
                
                if feeling is not None:
                    act['feeling'] = feeling
                    if aid in db: db[aid]['feeling'] = feeling
                        
                if rpe or feeling:
                    print(f"   + Found RPE ({rpe}) / Feel ({feeling}) for {act['activityName']}")

            except Exception as e:
                pass

        if is_new:
            db[aid] = act
            new_count += 1
        elif aid in db:
            # Update existing record with fresh summary data (e.g. name changes)
            db[aid].update(act)

    print(f"   - Added: {new_count} | Updated RPE on: {updated_count}")
    save_data(list(db.values()))

if __name__ == "__main__":
    main()
