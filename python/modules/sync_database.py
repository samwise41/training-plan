import json
import os
import sys
import subprocess
from datetime import datetime

# Attempt to import config, handling potential path issues
try:
    from . import config
except ImportError:
    import config

# --- HELPER FUNCTIONS ---

def normalize_sport(val, activity_type=None):
    """Normalizes sport types to standard categories: Bike, Run, Swim, Other."""
    val = str(val).upper() if val else ""
    act_type = str(activity_type).upper() if activity_type else ""
    
    # 1. Check Garmin/Strava Types
    if 'RIDE' in act_type or 'CYCL' in act_type or 'BIK' in act_type: return 'Bike'
    if 'RUN' in act_type: return 'Run'
    if 'SWIM' in act_type or 'POOL' in act_type: return 'Swim'

    # 2. Check Text Matching in Names
    if '[BIKE]' in val or 'ZWIFT' in val or 'CYCLING' in val: return 'Bike'
    if '[RUN]' in val or 'RUNNING' in val: return 'Run'
    if '[SWIM]' in val or 'SWIMMING' in val: return 'Swim'
    
    return 'Other'

def bundle_activities(activities):
    """Groups multiple activities (e.g. Warmup + Main) into one composite entry."""
    if not activities: return None
    # Sort by duration descending (longest is primary)
    activities.sort(key=lambda x: x.get('duration', 0) or 0, reverse=True)
    main = activities[0].copy() 
    
    if len(activities) == 1:
        return main

    # Sum Totals
    for key in ['duration', 'distance', 'calories', 'elevationGain']:
        main[key] = sum((a.get(key) or 0) for a in activities)

    # Weighted Averages
    total_dur = main['duration']
    if total_dur > 0:
        def weighted(k):
            val = sum((a.get(k) or 0) * (a.get('duration') or 0) for a in activities)
            return val / total_dur
        
        main['averageHR'] = weighted('averageHR')
        main['avgPower'] = weighted('avgPower')
        main['normPower'] = weighted('normPower')
        
    # Maxima
    main['maxHR'] = max((a.get('maxHR') or 0) for a in activities)
    main['maxPower'] = max((a.get('maxPower') or 0) for a in activities)

    # Combine IDs and Names
    all_ids = sorted([str(a.get('activityId')) for a in activities])
    main['activityId'] = ",".join(all_ids)
    main['activityName'] = f"{main.get('activityName')} (+{len(activities)-1})"
    
    return main

def run_build_plan_script():
    """Executes _03_build_plan.py to refresh data/planned.json."""
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '_03_build_plan.py')
    if os.path.exists(script_path):
        print(f"🔨 Running Build Plan Script...")
        try:
            subprocess.run([sys.executable, script_path], check=True)
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Error building plan: {e}")

# --- MAIN SYNC FUNCTION ---

def sync():
    print(f"🚀 SYNC: Starting Database Sync...")
    
    # 0. Refresh Planned Data
    run_build_plan_script()
    
    # Paths
    PLANNED_JSON = os.path.join(config.DATA_DIR, 'planned.json')
    TRAINING_LOG = config.MASTER_DB 
    GARMIN_JSON = config.GARMIN_JSON

    # 1. Load Data
    planned_data = []
    if os.path.exists(PLANNED_JSON):
        with open(PLANNED_JSON, 'r', encoding='utf-8') as f: planned_data = json.load(f)
    
    existing_log = []
    if os.path.exists(TRAINING_LOG):
        with open(TRAINING_LOG, 'r', encoding='utf-8') as f: existing_log = json.load(f)

    garmin_data = []
    if os.path.exists(GARMIN_JSON):
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f: garmin_data = json.load(f)

    print(f"   📊 Loaded: {len(planned_data)} Plans | {len(existing_log)} Logs | {len(garmin_data)} Activities")

    # 2. Index Existing Log by "Date|Type"
    log_map = {}
    for entry in existing_log:
        # Ensure activityType is normalized
        entry['activityType'] = normalize_sport(entry.get('activityType') or entry.get('plannedWorkout'))
        
        date = entry.get('date')
        sport = entry.get('activityType')
        if date and sport:
            key = f"{date}|{sport}"
            log_map[key] = entry

    today_str = datetime.now().strftime('%Y-%m-%d')

    # --- PHASE 1: MERGE PLANNED WORKOUTS ---
    print("   🔄 Phase 1: Merging Plan...")
    for plan in planned_data:
        p_date = plan.get('date')
        if not p_date: continue
        
        # Determine Sport Type
        p_name = plan.get('activityName') or plan.get('plannedWorkout', '')
        p_sport = normalize_sport(plan.get('activityType') or p_name)
        if p_sport == 'Other': continue

        key = f"{p_date}|{p_sport}"

        # Create entry if it doesn't exist
        if key not in log_map:
            new_entry = {
                "id": None,
                "date": p_date,
                "Day": plan.get('day') or datetime.strptime(p_date, '%Y-%m-%d').strftime('%A'),
                "Status": "Pending",
                "activityType": p_sport,
                "actualDuration": 0
            }
            existing_log.append(new_entry)
            log_map[key] = new_entry

        # Update Fields (Map activityName -> plannedWorkout)
        rec = log_map[key]
        rec['plannedWorkout'] = p_name
        rec['plannedDuration'] = plan.get('plannedDuration')
        rec['notes'] = plan.get('notes') # Maps "notes" from planned to log

    # --- PHASE 2: MERGE GARMIN ACTUALS ---
    print("   🔗 Phase 2: Matching Actuals...")
    
    # Group Garmin activities by Key
    garmin_groups = {}
    for g in garmin_data:
        raw_date = g.get('startTimeLocal', '')
        if len(raw_date) < 10: continue
        g_date = raw_date[:10]
        g_sport = normalize_sport(g.get('activityName'), g.get('activityType', {}).get('typeKey', ''))
        g_key = f"{g_date}|{g_sport}"
        
        if g_key not in garmin_groups: garmin_groups[g_key] = []
        garmin_groups[g_key].append(g)

    matched_ids = set()

    for key, group in garmin_groups.items():
        composite = bundle_activities(group)
        comp_id = str(composite.get('activityId'))
        
        # Calculate duration in minutes
        dur_mins = round((composite.get('duration', 0) or 0) / 60.0, 1)

        # 3a. Hydrate Existing Entry (Matched)
        if key in log_map:
            rec = log_map[key]
            rec['id'] = comp_id
            rec['actualWorkout'] = composite.get('activityName')
            rec['actualDuration'] = dur_mins
            
            # Fill raw stats
            rec['distance'] = composite.get('distance')
            rec['calories'] = composite.get('calories')
            rec['averageHR'] = composite.get('averageHR')
            rec['maxHR'] = composite.get('maxHR')
            rec['avgPower'] = composite.get('avgPower')
            rec['normPower'] = composite.get('normPower')
            rec['RPE'] = composite.get('perceivedEffort')
            rec['Feeling'] = composite.get('feeling')
            
            rec['Match Status'] = "Linked"
            for sub_id in comp_id.split(','): matched_ids.add(sub_id.strip())

        # 3b. Add New Entry (Unplanned)
        else:
            # Check if IDs used elsewhere
            if any(sid.strip() in matched_ids for sid in comp_id.split(',')): continue
            
            g_date = key.split('|')[0]
            g_sport = key.split('|')[1]
            
            new_rec = {
                "id": comp_id,
                "date": g_date,
                "Day": datetime.strptime(g_date, '%Y-%m-%d').strftime('%A'),
                "activityType": g_sport,
                "plannedWorkout": "",
                "plannedDuration": 0,
                "notes": "",
                "actualWorkout": composite.get('activityName'),
                "actualDuration": dur_mins,
                "distance": composite.get('distance'),
                "calories": composite.get('calories'),
                "averageHR": composite.get('averageHR'),
                "avgPower": composite.get('avgPower'),
                "Match Status": "Unplanned"
            }
            existing_log.append(new_rec)
            # Mark IDs as used
            for sub_id in comp_id.split(','): matched_ids.add(sub_id.strip())

    # --- PHASE 4: UPDATE STATUS LOGIC ---
    print("   🚦 Phase 3: Updating Status...")
    for entry in existing_log:
        p_dur = float(entry.get('plannedDuration') or 0)
        a_dur = float(entry.get('actualDuration') or 0)
        e_date = entry.get('date', '0000-00-00')

        # Logic requested by user:
        # 1. Planned > 0 AND Actual > 0 -> COMPLETED
        if p_dur > 0 and a_dur > 0:
            entry['Status'] = "COMPLETED"
        
        # 2. Planned > 0 AND Actual = 0 -> MISSED
        # (Only if the date is in the past, otherwise it stays Pending)
        elif p_dur > 0 and a_dur == 0:
            if e_date < today_str:
                entry['Status'] = "MISSED"
                entry['Match Status'] = "Missed"
            else:
                entry['Status'] = "PLANNED" # Keep as future plan

        # 3. Planned = 0 AND Actual > 0 -> UNPLANNED
        elif p_dur == 0 and a_dur > 0:
            entry['Status'] = "COMPLETED" # Technically completed, just unplanned
            entry['Match Status'] = "Unplanned"
            
        # Optional: Handle Rest Days (0 and 0)
        elif p_dur == 0 and a_dur == 0:
            # If it explicitly says "Rest" in plannedWorkout, keep it
            if "Rest" in str(entry.get('plannedWorkout', '')):
                entry['Status'] = "REST"

    # Sort and Save
    existing_log.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)
    
    with open(TRAINING_LOG, 'w', encoding='utf-8') as f:
        json.dump(existing_log, f, indent=4)
        
    print(f"✅ Sync Complete. Total Records: {len(existing_log)}")
    return existing_log

if __name__ == "__main__":
    sync()
