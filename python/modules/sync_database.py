import json
import os
import sys
import subprocess
from datetime import datetime

try:
    from . import config
except ImportError:
    import config

def clean_numeric(val):
    if val is None or val == "": return None
    try:
        f = float(val)
        if hasattr(f, 'is_integer') and f.is_integer(): return int(f)
        return f
    except: return None

def normalize_sport(val, activity_type=None):
    val = str(val).upper() if val else ""
    act_type = str(activity_type).upper() if activity_type else ""
    
    # 1. Garmin/Strava Types
    if 'RIDE' in act_type or 'CYCL' in act_type or 'BIK' in act_type: return 'Bike'
    if 'RUN' in act_type: return 'Run'
    if 'SWIM' in act_type or 'POOL' in act_type: return 'Swim'

    # 2. Text Matching
    if '[BIKE]' in val or 'ZWIFT' in val or 'CYCLING' in val: return 'Bike'
    if '[RUN]' in val or 'RUNNING' in val: return 'Run'
    if '[SWIM]' in val or 'SWIMMING' in val: return 'Swim'
    
    return 'Other'

def run_build_plan_script():
    """
    Executes _03_build_plan.py to refresh data/planned.json
    """
    # Assuming _03_build_plan.py is in the parent 'python/' directory relative to this module
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '_03_build_plan.py')
    
    if os.path.exists(script_path):
        print(f"🔨 Running Build Plan Script: {os.path.basename(script_path)}...")
        try:
            subprocess.run([sys.executable, script_path], check=True)
            print("   ✅ Plan built successfully.")
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Error building plan: {e}")
    else:
        print(f"   ⚠️ Build plan script not found at {script_path}")

def sync():
    print(f"🚀 SYNC: Starting Database Sync...")
    
    # STEP 1: Refresh the Planned Data (Generate planned.json from MD)
    run_build_plan_script()
    
    # Define file paths
    PLANNED_JSON = os.path.join(config.DATA_DIR, 'planned.json')
    TRAINING_LOG = config.MASTER_DB # data/training_log.json
    GARMIN_JSON = config.GARMIN_JSON

    # Load Data
    planned_data = []
    if os.path.exists(PLANNED_JSON):
        with open(PLANNED_JSON, 'r', encoding='utf-8') as f:
            planned_data = json.load(f)
    
    existing_log = []
    if os.path.exists(TRAINING_LOG):
        with open(TRAINING_LOG, 'r', encoding='utf-8') as f:
            existing_log = json.load(f)

    garmin_data = []
    if os.path.exists(GARMIN_JSON):
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)

    print(f"   📊 Loaded: {len(planned_data)} Plans | {len(existing_log)} Logs | {len(garmin_data)} Garmin Activities")

    # STEP 2: Upsert Planned Workouts into Training Log
    # We match based on Date + ActivityType to avoid duplicates
    print("   🔄 Merging Planned Workouts into Log...")
    
    # Index existing log for fast lookup
    # Key: "YYYY-MM-DD|Type"
    log_map = {}
    for i, entry in enumerate(existing_log):
        date = entry.get('date')
        sport = normalize_sport(entry.get('plannedWorkout') or entry.get('activityType'))
        if date and sport:
            log_map[f"{date}|{sport}"] = i

    updates = 0
    inserts = 0
    today = datetime.now().strftime('%Y-%m-%d')

    for plan in planned_data:
        p_date = plan.get('date')
        p_sport = normalize_sport(plan.get('plannedWorkout'))
        
        # Skip if date is missing or sport is unknown
        if not p_date or p_sport == 'Other': continue

        # Only process past or today (as per user request: "not in the future")
        if p_date > today:
            continue

        key = f"{p_date}|{p_sport}"
        
        if key in log_map:
            # Update existing record with latest Plan details (in case markdown changed)
            idx = log_map[key]
            existing_log[idx]['plannedWorkout'] = plan.get('plannedWorkout')
            existing_log[idx]['plannedDuration'] = plan.get('plannedDuration')
            existing_log[idx]['notes'] = plan.get('notes')
            existing_log[idx]['Day'] = plan.get('day')
            # Ensure Status is pending if no actual workout linked yet
            if existing_log[idx]['Status'] == 'Pending' and p_date < today:
                 existing_log[idx]['Status'] = 'Missed' # Auto-mark past pending as missed
            
            updates += 1
        else:
            # Create New Record
            new_record = {
                "id": None, # No ID yet
                "date": p_date,
                "Day": plan.get('day'),
                "Status": "Pending", # Default
                "Match Status": "",
                
                # Plan Fields
                "plannedWorkout": plan.get('plannedWorkout'),
                "plannedDuration": plan.get('plannedDuration'),
                "notes": plan.get('notes'),
                
                # Activity Type for Matching
                "activityType": p_sport,
                
                # Empty Actuals
                "actualWorkout": "",
                "actualDuration": None,
                
                # Empty Metrics
                "duration": None, "distance": None, "averageHR": None, "maxHR": None,
                "aerobicTrainingEffect": None, "anaerobicTrainingEffect": None,
                "trainingEffectLabel": None, "avgPower": None, "maxPower": None,
                "normPower": None, "trainingStressScore": None, "intensityFactor": None,
                "averageSpeed": None, "maxSpeed": None, "averageBikingCadenceInRevPerMinute": None,
                "averageRunningCadenceInStepsPerMinute": None, "avgStrideLength": None,
                "avgVerticalOscillation": None, "avgGroundContactTime": None,
                "vO2MaxValue": None, "calories": None, "elevationGain": None,
                "RPE": None, "Feeling": None
            }
            # Auto-mark missed if date is in past
            if p_date < today:
                 new_record['Status'] = 'Missed'
                 new_record['Match Status'] = 'Missed'

            existing_log.append(new_record)
            log_map[key] = len(existing_log) - 1 # Add to map so we don't duplicate if list has dupes
            inserts += 1

    print(f"      - Added {inserts} new planned records, updated {updates}.")

    # STEP 3: Match Against Garmin Data
    print("   🔗 Matching Garmin Activities...")
    matches = 0
    garmin_inserts = 0
    
    # Group Garmin by Date|Type for lookup
    garmin_map = {}
    for g in garmin_data:
        g_date = g.get('startTimeLocal', '')[:10]
        g_sport = normalize_sport(g.get('activityName'), g.get('activityType', {}).get('typeKey', ''))
        g_key = f"{g_date}|{g_sport}"
        
        if g_key not in garmin_map:
            garmin_map[g_key] = []
        garmin_map[g_key].append(g)

    # 3a. Hydrate Existing Log Entries
    for entry in existing_log:
        e_date = entry.get('date')
        # Use existing activityType if set, otherwise derive from plannedWorkout
        e_sport = entry.get('activityType') or normalize_sport(entry.get('plannedWorkout'))
        
        if not e_date or not e_sport: continue
        
        key = f"{e_date}|{e_sport}"
        
        if key in garmin_map:
            # FOUND MATCH
            activities = garmin_map[key]
            
            # Sort by duration to get primary (longest activity)
            activities.sort(key=lambda x: x.get('duration', 0) or 0, reverse=True)
            main_act = activities[0]
            
            # Update Log Entry
            entry['id'] = str(main_act.get('activityId'))
            entry['Match Status'] = "Linked"
            entry['Status'] = "COMPLETED"
            
            # Actuals
            entry['actualWorkout'] = main_act.get('activityName')
            entry['actualDuration'] = round((main_act.get('duration', 0) or 0) / 60, 1) # Minutes
            
            # Metrics
            entry['duration'] = main_act.get('duration')
            entry['distance'] = main_act.get('distance')
            entry['calories'] = main_act.get('calories')
            entry['elevationGain'] = main_act.get('elevationGain')
            
            entry['averageHR'] = main_act.get('averageHR')
            entry['maxHR'] = main_act.get('maxHR')
            entry['avgPower'] = main_act.get('avgPower')
            entry['normPower'] = main_act.get('normPower')
            entry['maxPower'] = main_act.get('maxPower')
            entry['aerobicTrainingEffect'] = main_act.get('aerobicTrainingEffect')
            entry['anaerobicTrainingEffect'] = main_act.get('anaerobicTrainingEffect')
            entry['trainingEffectLabel'] = main_act.get('trainingEffectLabel')
            
            entry['averageSpeed'] = main_act.get('averageSpeed')
            entry['maxSpeed'] = main_act.get('maxSpeed')
            
            # Cadence / Running Dynamics
            entry['averageBikingCadenceInRevPerMinute'] = main_act.get('averageBikingCadenceInRevPerMinute')
            entry['averageRunningCadenceInStepsPerMinute'] = main_act.get('averageRunningCadenceInStepsPerMinute')
            entry['avgStrideLength'] = main_act.get('avgStrideLength')
            entry['avgVerticalOscillation'] = main_act.get('avgVerticalOscillation')
            entry['avgGroundContactTime'] = main_act.get('avgGroundContactTime')
            entry['vO2MaxValue'] = main_act.get('vO2MaxValue')

            # Zwift/Garmin specifics
            entry['RPE'] = main_act.get('perceivedEffort')
            entry['Feeling'] = main_act.get('feeling')
            
            # Calculate TSS/IF if missing
            if entry.get('normPower') and entry.get('duration') and not entry.get('trainingStressScore'):
                ftp = 241 # Default or fetch dynamically
                sec = entry['duration']
                np = entry['normPower']
                entry['intensityFactor'] = round(np / ftp, 2)
                entry['trainingStressScore'] = round((sec * np * entry['intensityFactor']) / (ftp * 3600) * 100, 1)

            matches += 1
            
            # Remove from map so we don't double add as unplanned
            garmin_map.pop(key) 

    # 3b. Add Unmatched Garmin Activities (Unplanned workouts)
    for key, activities in garmin_map.items():
        activities.sort(key=lambda x: x.get('duration', 0) or 0, reverse=True)
        main = activities[0]
        
        g_date = main.get('startTimeLocal', '')[:10]
        day_name = datetime.strptime(g_date, '%Y-%m-%d').strftime('%A')
        
        # Filter junk (e.g. manual entries with 0 duration)
        if (main.get('duration') or 0) < 60: continue 

        new_entry = {
            "id": str(main.get('activityId')),
            "date": g_date,
            "Day": day_name,
            "Status": "COMPLETED",
            "Match Status": "Unplanned",
            "activityType": normalize_sport(main.get('activityName'), main.get('activityType', {}).get('typeKey', '')),
            "sportTypeId": main.get('sportTypeId'),
            
            "plannedWorkout": "",
            "plannedDuration": None,
            "notes": "",
            
            "actualWorkout": main.get('activityName'),
            "actualDuration": round((main.get('duration') or 0) / 60, 1),
            
            "duration": main.get('duration'),
            "distance": main.get('distance'),
            "averageHR": main.get('averageHR'),
            "maxHR": main.get('maxHR'),
            "avgPower": main.get('avgPower'),
            "normPower": main.get('normPower'),
            "maxPower": main.get('maxPower'),
            "calories": main.get('calories'),
            "elevationGain": main.get('elevationGain'),
            "aerobicTrainingEffect": main.get('aerobicTrainingEffect'),
            "anaerobicTrainingEffect": main.get('anaerobicTrainingEffect'),
            "trainingEffectLabel": main.get('trainingEffectLabel'),
            "averageSpeed": main.get('averageSpeed'),
            "maxSpeed": main.get('maxSpeed'),
            "averageBikingCadenceInRevPerMinute": main.get('averageBikingCadenceInRevPerMinute'),
            "averageRunningCadenceInStepsPerMinute": main.get('averageRunningCadenceInStepsPerMinute'),
            "avgStrideLength": main.get('avgStrideLength'),
            "avgVerticalOscillation": main.get('avgVerticalOscillation'),
            "avgGroundContactTime": main.get('avgGroundContactTime'),
            "vO2MaxValue": main.get('vO2MaxValue'),
            
            "trainingStressScore": main.get('trainingStressScore'),
            "intensityFactor": main.get('intensityFactor'),
            
            "RPE": main.get('perceivedEffort'),
            "Feeling": main.get('feeling')
        }
        existing_log.append(new_entry)
        garmin_inserts += 1

    print(f"      - Matched {matches} existing records.")
    print(f"      - Added {garmin_inserts} unplanned/new Garmin activities.")

    # 4. Sort and Save
    existing_log.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)
    
    with open(TRAINING_LOG, 'w', encoding='utf-8') as f:
        json.dump(existing_log, f, indent=4)
        
    print(f"✅ DB Sync Complete. Total Records: {len(existing_log)}")
    return existing_log

if __name__ == "__main__":
    sync()
