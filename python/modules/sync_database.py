import json
import os
import sys
import subprocess
from datetime import datetime
import re

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

def bundle_activities(activities):
    """
    Groups multiple activities (e.g. Warmup + Race) into one composite entry.
    """
    if not activities: return None
    # Sort by duration descending (longest is primary)
    activities.sort(key=lambda x: x.get('duration', 0) or 0, reverse=True)
    main = activities[0].copy() # Base on the longest activity
    
    if len(activities) == 1:
        return main

    # 1. Sum Totals
    for key in ['duration', 'distance', 'calories', 'elevationGain']:
        main[key] = sum((a.get(key) or 0) for a in activities)

    # 2. Weighted Averages (Power, HR, Speed)
    total_dur = main['duration']
    if total_dur > 0:
        def weighted(k):
            val = sum((a.get(k) or 0) * (a.get('duration') or 0) for a in activities)
            return val / total_dur
        
        main['averageHR'] = weighted('averageHR')
        main['avgPower'] = weighted('avgPower')
        main['normPower'] = weighted('normPower')
        main['averageSpeed'] = weighted('averageSpeed')
        
    # 3. Maxima
    main['maxHR'] = max((a.get('maxHR') or 0) for a in activities)
    main['maxPower'] = max((a.get('maxPower') or 0) for a in activities)

    # 4. Combine IDs
    all_ids = sorted([str(a.get('activityId')) for a in activities])
    main['activityId'] = ",".join(all_ids)
    main['activityName'] = f"{main.get('activityName')} (+{len(activities)-1})"
    
    return main

def sync():
    print(f"🚀 SYNC: Starting Database Sync...")
    
    # STEP 1: Refresh the Planned Data
    run_build_plan_script()
    
    PLANNED_JSON = os.path.join(config.DATA_DIR, 'planned.json')
    TRAINING_LOG = config.MASTER_DB 
    GARMIN_JSON = config.GARMIN_JSON

    # Load Data
    planned_data = []
    if os.path.exists(PLANNED_JSON):
        with open(PLANNED_JSON, 'r', encoding='utf-8') as f: planned_data = json.load(f)
    
    existing_log = []
    if os.path.exists(TRAINING_LOG):
        with open(TRAINING_LOG, 'r', encoding='utf-8') as f: existing_log = json.load(f)

    garmin_data = []
    if os.path.exists(GARMIN_JSON):
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f: garmin_data = json.load(f)

    print(f"   📊 Loaded: {len(planned_data)} Plans | {len(existing_log)} Logs | {len(garmin_data)} Garmin Activities")

    # --- 1. INDEXING EXISTING DATA ---
    log_by_id = {}
    log_by_key = {}
    
    for i, entry in enumerate(existing_log):
        entry['activityType'] = normalize_sport(entry.get('activityType') or entry.get('plannedWorkout'))
        
        eid = str(entry.get('id', '')).strip()
        if eid and eid != 'None' and eid != 'null':
            log_by_id[eid] = entry
        
        date = entry.get('date')
        sport = entry.get('activityType')
        if date and sport:
            log_by_key[f"{date}|{sport}"] = entry

    # --- 2. MERGE PLANNED WORKOUTS ---
    print("   🔄 Phase 1: Merging Plan into Log...")
    updates = 0
    inserts = 0
    today = datetime.now().strftime('%Y-%m-%d')

    for plan in planned_data:
        p_date = plan.get('date')
        p_name = plan.get('activityName') or plan.get('plannedWorkout')
        p_sport = normalize_sport(plan.get('activityType') or p_name)
        
        if not p_date or p_sport == 'Other': continue
        if p_date > today: continue

        key = f"{p_date}|{p_sport}"
        
        if key in log_by_key:
            rec = log_by_key[key]
            rec['plannedWorkout'] = p_name
            rec['plannedDuration'] = plan.get('plannedDuration')
            rec['notes'] = plan.get('notes')
            if plan.get('day'): rec['Day'] = plan.get('day')
            updates += 1
        else:
            new_rec = {
                "id": None,
                "date": p_date,
                "Day": plan.get('day') or datetime.strptime(p_date, '%Y-%m-%d').strftime('%A'),
                "Status": "Pending",
                "Match Status": "",
                "plannedWorkout": p_name,
                "plannedDuration": plan.get('plannedDuration'),
                "notes": plan.get('notes'),
                "activityType": p_sport,
                "actualWorkout": "", "actualDuration": None,
                "duration": None, "distance": None, "calories": None, "elevationGain": None,
                "averageHR": None, "maxHR": None, "avgPower": None, "maxPower": None, "normPower": None,
                "RPE": None, "Feeling": None
            }
            if p_date < today: new_rec['Status'] = 'Missed'
            
            existing_log.append(new_rec)
            log_by_key[key] = new_rec
            inserts += 1

    print(f"      - Plan Updates: {updates} | New Plans Added: {inserts}")

    # --- 3. MERGE GARMIN ACTIVITIES ---
    print("   🔗 Phase 2: Matching Garmin Activities...")
    
    # Group Garmin by Date|Sport
    garmin_groups = {}
    for g in garmin_data:
        raw_date = g.get('startTimeLocal', '')
        if len(raw_date) < 10: continue
        g_date = raw_date[:10]
        g_sport = normalize_sport(g.get('activityName'), g.get('activityType', {}).get('typeKey', ''))
        g_key = f"{g_date}|{g_sport}"
        
        if g_key not in garmin_groups: garmin_groups[g_key] = []
        garmin_groups[g_key].append(g)

    matches = 0
    matched_ids = set() # Track matched Garmin IDs
    
    # 3a. Hydrate Matches
    for key, group in garmin_groups.items():
        if key in log_by_key:
            target = log_by_key[key]
            composite = bundle_activities(group)
            
            # Map fields
            target['id'] = str(composite.get('activityId'))
            target['Status'] = "COMPLETED"
            target['Match Status'] = "Linked"
            target['actualWorkout'] = composite.get('activityName')
            target['actualDuration'] = round((composite.get('duration', 0) or 0) / 60.0, 1)
            target['duration'] = composite.get('duration')
            target['distance'] = composite.get('distance')
            target['calories'] = composite.get('calories')
            target['elevationGain'] = composite.get('elevationGain')
            target['averageHR'] = composite.get('averageHR')
            target['maxHR'] = composite.get('maxHR')
            target['avgPower'] = composite.get('avgPower')
            target['maxPower'] = composite.get('maxPower')
            target['normPower'] = composite.get('normPower')
            target['RPE'] = composite.get('perceivedEffort')
            target['Feeling'] = composite.get('feeling')
            
            # Record matched IDs so we don't add them again
            for sub_id in target['id'].split(','):
                matched_ids.add(sub_id.strip())
            
            matches += 1

    # --- 4. ADD UNPLANNED ---
    print("   ➕ Phase 3: Adding Unplanned Activities...")
    unplanned_count = 0
    
    for key, group in garmin_groups.items():
        if key in log_by_key: continue # Already handled in match phase

        composite = bundle_activities(group)
        comp_id = str(composite.get('activityId'))
        
        # Check if ID was already handled (e.g. by direct ID match in a previous run)
        # Or if it was just linked above.
        is_already_logged = False
        for sub_id in comp_id.split(','):
            if sub_id.strip() in matched_ids:
                is_already_logged = True
                break
        
        # Check if ID exists in the log under a different date/key
        if not is_already_logged:
            for sub_id in comp_id.split(','):
                if sub_id.strip() in log_by_id:
                    is_already_logged = True
                    break

        if is_already_logged:
            continue
            
        # Add New Record
        g_date = key.split('|')[0]
        new_entry = {
            "id": comp_id,
            "date": g_date,
            "Day": datetime.strptime(g_date, '%Y-%m-%d').strftime('%A'),
            "Status": "COMPLETED",
            "Match Status": "Unplanned",
            "activityType": normalize_sport(composite.get('activityName')),
            "plannedWorkout": "", "plannedDuration": None, "notes": "",
            "actualWorkout": composite.get('activityName'),
            "actualDuration": round((composite.get('duration', 0) or 0) / 60.0, 1),
            "duration": composite.get('duration'),
            "distance": composite.get('distance'),
            "calories": composite.get('calories'),
            "elevationGain": composite.get('elevationGain'),
            "averageHR": composite.get('averageHR'),
            "maxHR": composite.get('maxHR'),
            "avgPower": composite.get('avgPower'),
            "normPower": composite.get('normPower'),
            "RPE": composite.get('perceivedEffort'),
            "Feeling": composite.get('feeling')
        }
        existing_log.append(new_entry)
        unplanned_count += 1

    # Final Sort and Save
    existing_log.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)
    
    with open(TRAINING_LOG, 'w', encoding='utf-8') as f:
        json.dump(existing_log, f, indent=4)
        
    print(f"✅ Sync Complete. Records: {len(existing_log)} (Matched: {matches}, Unplanned Added: {unplanned_count})")
    return existing_log

if __name__ == "__main__":
    sync()
