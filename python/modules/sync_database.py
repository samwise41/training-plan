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
    
    if 'RIDE' in act_type or 'CYCL' in act_type or 'BIK' in act_type: return 'Bike'
    if 'RUN' in act_type: return 'Run'
    if 'SWIM' in act_type or 'POOL' in act_type: return 'Swim'

    if '[BIKE]' in val or 'ZWIFT' in val or 'CYCLING' in val: return 'Bike'
    if '[RUN]' in val or 'RUNNING' in val: return 'Run'
    if '[SWIM]' in val or 'SWIMMING' in val: return 'Swim'
    
    return 'Other'

def run_build_plan_script():
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '_03_build_plan.py')
    if os.path.exists(script_path):
        print(f"🔨 Running Build Plan Script...")
        try:
            subprocess.run([sys.executable, script_path], check=True)
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Error building plan: {e}")

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
    
    # 1. GENERATE PLAN
    run_build_plan_script()
    
    PLANNED_JSON = os.path.join(config.DATA_DIR, 'planned.json')
    TRAINING_LOG = config.MASTER_DB 
    GARMIN_JSON = config.GARMIN_JSON

    # Load Files
    if os.path.exists(PLANNED_JSON):
        with open(PLANNED_JSON, 'r', encoding='utf-8') as f: planned_data = json.load(f)
    else: planned_data = []
    
    if os.path.exists(TRAINING_LOG):
        with open(TRAINING_LOG, 'r', encoding='utf-8') as f: existing_log = json.load(f)
    else: existing_log = []

    if os.path.exists(GARMIN_JSON):
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f: garmin_raw = json.load(f)
    else: garmin_raw = []

    print(f"   📊 Loaded: {len(planned_data)} Plans | {len(existing_log)} Logs | {len(garmin_raw)} Garmin Activities")

    # --- PHASE 1: MERGE PLAN INTO LOG ---
    # Ensure every planned workout exists in the log
    print("   🔄 Phase 1: Merging Plan into Log...")
    log_lookup = {} # Key: "Date|Sport"
    for i, entry in enumerate(existing_log):
        d = entry.get('date')
        s = normalize_sport(entry.get('plannedWorkout') or entry.get('activityType'))
        if d and s:
            log_lookup[f"{d}|{s}"] = i

    today = datetime.now().strftime('%Y-%m-%d')
    
    for plan in planned_data:
        p_date = plan.get('date')
        p_name = plan.get('activityName')
        p_sport = normalize_sport(plan.get('activityType') or p_name)
        
        if not p_date or p_sport == 'Other': continue
        if p_date > today: continue # Ignore future plans

        key = f"{p_date}|{p_sport}"
        
        if key in log_lookup:
            # Update existing
            idx = log_lookup[key]
            existing_log[idx]['plannedWorkout'] = p_name
            existing_log[idx]['plannedDuration'] = plan.get('plannedDuration')
            existing_log[idx]['notes'] = plan.get('notes')
            if plan.get('day'): existing_log[idx]['Day'] = plan.get('day')
        else:
            # Add new
            new_rec = {
                "id": None,
                "date": p_date,
                "Day": plan.get('day') or datetime.strptime(p_date, '%Y-%m-%d').strftime('%A'),
                "Status": "Pending" if p_date >= today else "Missed",
                "Match Status": "",
                "plannedWorkout": p_name,
                "plannedDuration": plan.get('plannedDuration'),
                "notes": plan.get('notes'),
                "activityType": p_sport,
                # Initialize fields
                "actualWorkout": "", "actualDuration": None, "duration": None, "distance": None,
                "averageHR": None, "maxHR": None, "avgPower": None, "normPower": None,
                "RPE": None, "Feeling": None
            }
            existing_log.append(new_rec)
            log_lookup[key] = len(existing_log) - 1

    # --- PHASE 2: GROUP GARMIN DATA ---
    print("   📦 Phase 2: Grouping Garmin Data...")
    garmin_groups = {} # Key: "Date|Sport" -> [activities]
    
    for g in garmin_raw:
        # Date Processing: "2026-01-19 06:42:53" -> "2026-01-19"
        raw_date = g.get('startTimeLocal', '')
        if len(raw_date) >= 10:
            g_date = raw_date[:10]
        else:
            continue
            
        g_sport = normalize_sport(g.get('activityName'), g.get('activityType', {}).get('typeKey', ''))
        g_key = f"{g_date}|{g_sport}"
        
        if g_key not in garmin_groups:
            garmin_groups[g_key] = []
        garmin_groups[g_key].append(g)

    # --- PHASE 3: MATCH & HYDRATE ---
    print("   🔗 Phase 3: Matching & Hydrating...")
    matches = 0
    
    # Create ID Lookup to prevent re-adding matched activities later
    # We must look at the log AFTER Phase 1 updates
    matched_ids = set()
    for entry in existing_log:
        if entry.get('id'):
            # Handle comma-separated IDs in log
            for sub_id in str(entry['id']).split(','):
                matched_ids.add(sub_id.strip())

    for i, entry in enumerate(existing_log):
        e_date = entry.get('date')
        e_sport = normalize_sport(entry.get('activityType') or entry.get('plannedWorkout'))
        
        key = f"{e_date}|{e_sport}"
        
        # Is there Garmin data for this Date+Sport?
        if key in garmin_groups:
            group = garmin_groups[key]
            composite = bundle_activities(group)
            
            # UPDATE LOG ENTRY
            entry['id'] = str(composite.get('activityId'))
            entry['Status'] = "COMPLETED"
            entry['Match Status'] = "Linked"
            
            entry['actualWorkout'] = composite.get('activityName')
            entry['actualDuration'] = round((composite.get('duration', 0) or 0) / 60.0, 1)
            
            # Map Metrics
            entry['duration'] = composite.get('duration')
            entry['distance'] = composite.get('distance')
            entry['calories'] = composite.get('calories')
            entry['elevationGain'] = composite.get('elevationGain')
            entry['averageHR'] = composite.get('averageHR')
            entry['maxHR'] = composite.get('maxHR')
            entry['avgPower'] = composite.get('avgPower')
            entry['normPower'] = composite.get('normPower')
            entry['aerobicTrainingEffect'] = composite.get('aerobicTrainingEffect')
            entry['anaerobicTrainingEffect'] = composite.get('anaerobicTrainingEffect')
            entry['trainingEffectLabel'] = composite.get('trainingEffectLabel')
            entry['RPE'] = composite.get('perceivedEffort')
            entry['Feeling'] = composite.get('feeling')
            
            # Add these IDs to matched set so Phase 4 ignores them
            for sub_id in str(entry['id']).split(','):
                matched_ids.add(sub_id.strip())
                
            # Remove from groups so it's not available for other matches
            # (Though logic theoretically handles it via matched_ids, this is cleaner)
            del garmin_groups[key]
            matches += 1

    # --- PHASE 4: ADD UNPLANNED ---
    print("   ➕ Phase 4: Adding Unplanned Activities...")
    unplanned_count = 0
    
    # Iterate remaining groups
    for key, group in garmin_groups.items():
        composite = bundle_activities(group)
        comp_id = str(composite.get('activityId'))
        
        # CHECK: Have these IDs been matched already?
        # We split the composite ID (e.g. "123,456") and check if ANY part exists
        # If any part exists, we assume the group was handled.
        is_already_logged = False
        for sub_id in comp_id.split(','):
            if sub_id.strip() in matched_ids:
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
            
            "plannedWorkout": "",
            "plannedDuration": None,
            "notes": "",
            
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
            "aerobicTrainingEffect": composite.get('aerobicTrainingEffect'),
            "anaerobicTrainingEffect": composite.get('anaerobicTrainingEffect'),
            "trainingEffectLabel": composite.get('trainingEffectLabel'),
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
