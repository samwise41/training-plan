import sys
import os
import json
import pandas as pd
from garminconnect import Garmin
from modules import config

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')

def get_credentials():
    email = os.environ.get('GARMIN_EMAIL')
    password = os.environ.get('GARMIN_PASSWORD')
    return email, password

def fetch_specific_activity(activity_id):
    """Fetches a single activity (deep fetch) from Garmin if missing from JSON."""
    print(f"🔎 Looking for Activity {activity_id} in JSON...")
    
    data = []
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    
    # Check if exists
    match = next((x for x in data if str(x.get('activityId')) == str(activity_id)), None)
    
    if match:
        print("   ✅ Found in local JSON.")
        return match, data
    
    # Not found, fetch from Garmin
    print("   ⚠️ Not found locally. Fetching from Garmin...")
    email, password = get_credentials()
    if not email or not password:
        print("   ❌ Error: Credentials missing. Cannot fetch.")
        return None, data
        
    try:
        client = Garmin(email, password)
        client.login()
        activity = client.get_activity(activity_id) # Deep fetch by default
        
        # Normalize RPE/Feeling from Deep Data
        if 'summaryDTO' in activity:
            raw_rpe = activity['summaryDTO'].get('directWorkoutRpe')
            raw_feel = activity['summaryDTO'].get('directWorkoutFeel')
            if raw_rpe: activity['perceivedEffort'] = int(raw_rpe / 10)
            if raw_feel: activity['feeling'] = int((raw_feel / 25) + 1)
        
        # Append and Save
        data.append(activity)
        # Sort desc
        data.sort(key=lambda x: x.get('startTimeLocal', ''), reverse=True)
        
        with open(JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
        print("   💾 Fetched and saved to JSON.")
        return activity, data
        
    except Exception as e:
        print(f"   ❌ Fetch Error: {e}")
        return None, data

def update_database(activity_id, garmin_data):
    print(f"📝 Updating Master Database for ID: {activity_id}...")
    
    if not os.path.exists(config.MASTER_DB):
        print("   ❌ Database not found.")
        return

    # Load DB
    with open(config.MASTER_DB, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    header = [h.strip() for h in lines[0].strip('|').split('|')]
    
    # Map columns indices
    col_map = {name: i for i, name in enumerate(header)}
    
    # Fields to update (Standard + RPE)
    cols_to_map = [
        'duration', 'distance', 'averageHR', 'maxHR', 
        'aerobicTrainingEffect', 'anaerobicTrainingEffect', 'trainingEffectLabel',
        'avgPower', 'maxPower', 'normPower', 'trainingStressScore', 'intensityFactor',
        'averageSpeed', 'maxSpeed', 'vO2MaxValue', 'calories', 'elevationGain',
        'activityName', 'sportTypeId',
        'averageBikingCadenceInRevPerMinute', 
        'averageRunningCadenceInStepsPerMinute',
        'avgStrideLength', 'avgVerticalOscillation', 'avgGroundContactTime'
    ]

    updated_rows = []
    found = False
    
    for line in lines:
        if '|' not in line or '---' in line or 'Status' in line:
            updated_rows.append(line)
            continue
            
        row = [c.strip() for c in line.strip('|').split('|')]
        
        # Check if this row matches the ID
        row_id = ""
        if 'activityId' in col_map and col_map['activityId'] < len(row):
            row_id = row[col_map['activityId']].strip()
            
        if row_id == str(activity_id):
            found = True
            print("   ✅ Found matching row in DB. Hydrating...")
            
            # 1. Update Name with [SPORT] prefix
            g_type = garmin_data.get('activityType', {}).get('typeKey', '').lower()
            prefix = "[RUN]" if 'run' in g_type else "[BIKE]" if 'cycl' in g_type or 'virt' in g_type else "[SWIM]" if 'swim' in g_type else ""
            raw_name = garmin_data.get('activityName', 'Activity')
            
            if prefix and prefix not in raw_name: 
                new_name = f"{prefix} {raw_name}"
            else: 
                new_name = raw_name
                
            if 'Actual Workout' in col_map:
                row[col_map['Actual Workout']] = new_name
                
            # 2. Update Duration (Min)
            if 'Actual Duration' in col_map:
                dur_sec = float(garmin_data.get('duration', 0))
                row[col_map['Actual Duration']] = f"{dur_sec/60:.1f}"
                
            # 3. Update Activity Type
            if 'activityType' in col_map:
                row[col_map['activityType']] = g_type

            # 4. Map Metrics
            for col in cols_to_map:
                if col in col_map and col in garmin_data:
                     val = garmin_data[col]
                     if val is not None:
                         row[col_map[col]] = str(val)

            # 5. Map RPE/Feeling
            if 'RPE' in col_map:
                rpe = garmin_data.get('perceivedEffort')
                if rpe: row[col_map['RPE']] = str(rpe)
                
            if 'Feeling' in col_map:
                feel = garmin_data.get('feeling')
                if feel: row[col_map['Feeling']] = str(feel)

            # Reconstruct Line
            new_line = "| " + " | ".join(row) + " |\n"
            updated_rows.append(new_line)
        else:
            updated_rows.append(line)

    if found:
        with open(config.MASTER_DB, 'w', encoding='utf-8') as f:
            f.writelines(updated_rows)
        print("   ✅ Database saved successfully.")
    else:
        print("   ❌ ID not found in database. Did you add it manually first?")

def main():
    # Parse ID from arguments
    if len(sys.argv) < 2:
        print("Usage: python hydrate_activity.py <ACTIVITY_ID>")
        sys.exit(1)
        
    act_id = sys.argv[1]
    
    # 1. Fetch/Find Data
    activity_data, _ = fetch_specific_activity(act_id)
    
    if activity_data:
        # 2. Update Database
        update_database(act_id, activity_data)
    else:
        print("   ❌ Could not retrieve activity data.")

if __name__ == "__main__":
    main()
