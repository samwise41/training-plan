import json
import os
import sys

# --- 1. ROBUST PATH SETUP ---
# Get the directory of this script (python/)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Go up one level to the Project Root (training-plan/)
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Construct Absolute Paths
GARMIN_FILE = os.path.join(PROJECT_ROOT, "garmin_data", "my_garmin_data_ALL.json")
DB_FILE = os.path.join(PROJECT_ROOT, "data", "training_log.json")

# Target Date to Check
TARGET_DATE = "2026-01-17"

def load_json(path):
    print(f"   📂 Reading: {path}")
    if not os.path.exists(path):
        print(f"   ❌ FILE NOT FOUND AT THIS PATH")
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print(f"   ✅ Loaded {len(data)} records.")
            return data
    except Exception as e:
        print(f"   ❌ JSON ERROR: {e}")
        return []

def check_field(record, key, label):
    val = record.get(key)
    # Check for None explicitly, or empty string if that's invalid for the field
    if val is None:
        status = "❌ NULL"
    elif val == "":
        status = "⚠️ EMPTY"
    elif val == 0:
        status = "⚠️ ZERO"
    else:
        status = f"✅ {val}"
    
    print(f"      {label:<20} | {key:<35} : {status}")

def main():
    print("\n🔍 --- DATA PIPELINE DIAGNOSTIC ---")
    print(f"   Root: {PROJECT_ROOT}\n")

    # --- STEP 1: CHECK SOURCE (GARMIN) ---
    print("1️⃣  CHECKING SOURCE (Garmin JSON)")
    garmin_data = load_json(GARMIN_FILE)
    
    # Find specific record by date string match
    garmin_rec = next((x for x in garmin_data if x.get('startTimeLocal', '').startswith(TARGET_DATE)), None)
    
    if not garmin_rec:
        print(f"   ❌ NO RECORD FOUND in Garmin Source for {TARGET_DATE}")
        print("   (Check if 'startTimeLocal' in your JSON matches YYYY-MM-DD)")
    else:
        print(f"   ✅ Found Source Activity: {garmin_rec.get('activityName')}")
        print("   --- Critical Metrics in Source ---")
        # Check raw Garmin keys
        check_field(garmin_rec, 'averageHR', 'Heart Rate')
        check_field(garmin_rec, 'avgPower', 'Power')
        check_field(garmin_rec, 'averageSpeed', 'Speed')
        check_field(garmin_rec, 'averageBikingCadenceInRevPerMinute', 'Bike Cadence')
        check_field(garmin_rec, 'averageRunningCadenceInStepsPerMinute', 'Run Cadence')
        check_field(garmin_rec, 'trainingEffectLabel', 'TE Label')

    print("-" * 60)

    # --- STEP 2: CHECK DESTINATION (DB) ---
    print("2️⃣  CHECKING DESTINATION (Training Log)")
    db_data = load_json(DB_FILE)
    
    # Find record in DB
    db_rec = next((x for x in db_data if x.get('date') == TARGET_DATE), None)
    
    if not db_rec:
        print(f"   ❌ NO RECORD FOUND in Database for {TARGET_DATE}")
        print("   -> The Sync Script skipped this date or failed to save it.")
    else:
        print(f"   ✅ Found DB Record: {db_rec.get('actualWorkout')}")
        print("   --- Mapped Metrics in DB ---")
        # Check mapped keys expected by app.js
        check_field(db_rec, 'avgHR', 'Heart Rate')
        check_field(db_rec, 'avgPower', 'Power')
        check_field(db_rec, 'avgSpeed', 'Speed')
        check_field(db_rec, 'avgCadence', 'Cadence')
        check_field(db_rec, 'trainingEffectLabel', 'TE Label')
        check_field(db_rec, 'Match Status', 'Status')

    print("\n==================================================")

if __name__ == "__main__":
    main()