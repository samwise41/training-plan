import json
import os
import re
import sys
from datetime import datetime, timedelta

try:
    from . import config
except ImportError:
    import config

# --- CONFIGURATION ---
# We use a massive window to ensure ALL history is rebuilt
SYNC_WINDOW_DAYS = 3650 

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

def get_current_ftp():
    if not os.path.exists(config.PLAN_FILE): return 241
    try:
        with open(config.PLAN_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
            match = re.search(r"Cycling FTP[:\*]*\s*(\d+)", content, re.IGNORECASE)
            if match: return int(match.group(1))
    except: pass
    return 241

def bundle_activities(activities):
    if not activities: return None
    # Primary activity is the one with the longest duration
    activities.sort(key=lambda x: x.get('duration', 0) or 0, reverse=True)
    main = activities[0]
    combined = main.copy()
    
    # 1. Summations
    for key in ['duration', 'distance', 'calories', 'elevationGain']:
        combined[key] = sum((a.get(key) or 0) for a in activities)

    # 2. Weighted Averages
    total_dur = combined['duration']
    if total_dur > 0:
        def weighted(k):
            val = sum((a.get(k) or 0) * (a.get('duration') or 0) for a in activities)
            return val / total_dur
        
        combined['averageHR'] = weighted('averageHR')
        combined['avgPower'] = weighted('avgPower')
        combined['normPower'] = weighted('normPower')
        combined['averageSpeed'] = weighted('averageSpeed')
        combined['averageBikingCadenceInRevPerMinute'] = weighted('averageBikingCadenceInRevPerMinute')
        combined['averageRunningCadenceInStepsPerMinute'] = weighted('averageRunningCadenceInStepsPerMinute')
        combined['avgStrideLength'] = weighted('avgStrideLength')
        combined['avgVerticalOscillation'] = weighted('avgVerticalOscillation')
        combined['avgGroundContactTime'] = weighted('avgGroundContactTime')

    # 3. Maxima
    combined['maxHR'] = max((a.get('maxHR') or 0) for a in activities)
    combined['maxPower'] = max((a.get('maxPower') or 0) for a in activities)
    combined['maxSpeed'] = max((a.get('maxSpeed') or 0) for a in activities)
    
    # 4. Concatenate IDs
    all_ids = [str(a.get('activityId')) for a in activities if a.get('activityId')]
    combined['activityId'] = ",".join(all_ids)
    
    if len(activities) > 1:
        base_name = main.get('activityName', 'Activity')
        combined['activityName'] = f"{base_name} (+{len(activities)-1})"
        
    return combined

def extract_planned_workouts():
    if not os.path.exists(config.PLAN_FILE): return []
    with open(config.PLAN_FILE, 'r', encoding='utf-8') as f: lines = f.readlines()
    
    data = []
    # Simple parser assuming table structure
    # | Date | Day | Planned Workout | Duration | Notes |
    for line in lines:
        if '|' in line and not '---' in line and not 'Date' in line:
            parts = [p.strip() for p in line.split('|')]
            if len(parts) > 5:
                try:
                    p_date = parts[1]
                    datetime.strptime(p_date, '%Y-%m-%d') # Validate format
                    data.append({
                        'date': p_date,
                        'day': parts[2],
                        'plannedWorkout': parts[3],
                        'plannedDuration': clean_numeric(re.sub(r"[^0-9\.]", "", parts[4])),
                        'notes': parts[5]
                    })
                except: continue
    return data

def sync():
    print(f"🔄 SYNC: REBUILDING DATABASE from Garmin Data...")
    
    if not os.path.exists(config.GARMIN_JSON):
        print("❌ Garmin JSON not found.")
        return []
    
    with open(config.GARMIN_JSON, 'r', encoding='utf-8') as f: 
        garmin_list = json.load(f)

    plan_list = extract_planned_workouts()
    current_ftp = get_current_ftp()
    
    # 1. Group Garmin Activities by Date + Sport
    grouped = {}
    for g in garmin_list:
        g_date = g.get('startTimeLocal', '')[:10]
        g_sport = normalize_sport(g.get('activityName'), g.get('activityType', {}).get('typeKey', ''))
        key = f"{g_date}|{g_sport}"
        if key not in grouped: grouped[key] = []
        grouped[key].append(g)

    # 2. Build Master List
    master_db = []
    
    # Map Planned Items First (Lookup Dict)
    plan_map = {f"{p['date']}|{normalize_sport(p['plannedWorkout'])}": p for p in plan_list}

    # Process Completed Activities
    for key, activities in grouped.items():
        g_date, g_sport = key.split('|')
        
        # Calculate Day of Week
        try:
            day_name = datetime.strptime(g_date, '%Y-%m-%d').strftime('%A')
        except: day_name = "Unknown"

        composite = bundle_activities(activities)
        
        # Link to Plan if exists
        plan_data = plan_map.get(key, {})
        
        # --- FINAL SCHEMA MAPPING ---
        record = {
            # Identity
            "id": str(composite.get('activityId')),
            "date": g_date,
            "Day": day_name, # Critical for UI
            "Status": "COMPLETED",
            "Match Status": "Matched" if plan_data else "Unplanned",
            
            # Plan Data
            "plannedWorkout": plan_data.get('plannedWorkout', ""),
            "plannedDuration": plan_data.get('plannedDuration', 0),
            "notes": plan_data.get('notes', ""),
            
            # Actual Data
            "actualSport": g_sport,
            "actualWorkout": composite.get('activityName'),
            "actualDuration": clean_numeric(composite.get('duration', 0)) / 60.0,
            
            # All Requested Metrics
            "activityType": composite.get('activityType'),
            "sportTypeId": composite.get('sportTypeId'),
            "duration": clean_numeric(composite.get('duration')),
            "distance": clean_numeric(composite.get('distance')),
            "averageHR": clean_numeric(composite.get('averageHR')),
            "maxHR": clean_numeric(composite.get('maxHR')),
            "aerobicTrainingEffect": clean_numeric(composite.get('aerobicTrainingEffect')),
            "anaerobicTrainingEffect": clean_numeric(composite.get('anaerobicTrainingEffect')),
            "trainingEffectLabel": composite.get('trainingEffectLabel'),
            "avgPower": clean_numeric(composite.get('avgPower')),
            "maxPower": clean_numeric(composite.get('maxPower')),
            "normPower": clean_numeric(composite.get('normPower')),
            "averageSpeed": clean_numeric(composite.get('averageSpeed')),
            "maxSpeed": clean_numeric(composite.get('maxSpeed')),
            "averageBikingCadenceInRevPerMinute": clean_numeric(composite.get('averageBikingCadenceInRevPerMinute')),
            "averageRunningCadenceInStepsPerMinute": clean_numeric(composite.get('averageRunningCadenceInStepsPerMinute')),
            "avgStrideLength": clean_numeric(composite.get('avgStrideLength')),
            "avgVerticalOscillation": clean_numeric(composite.get('avgVerticalOscillation')),
            "avgGroundContactTime": clean_numeric(composite.get('avgGroundContactTime')),
            "vO2MaxValue": clean_numeric(composite.get('vO2MaxValue')),
            "calories": clean_numeric(composite.get('calories')),
            "elevationGain": clean_numeric(composite.get('elevationGain')),
            "RPE": clean_numeric(composite.get('perceivedEffort')),
            "Feeling": clean_numeric(composite.get('feeling'))
        }
        
        # Calc TSS/IF
        if record['normPower'] and record['duration']:
            sec = record['duration']
            np = record['normPower']
            record['intensityFactor'] = round(np / current_ftp, 2)
            record['trainingStressScore'] = round((sec * np * record['intensityFactor']) / (current_ftp * 3600) * 100, 1)
        else:
            record['intensityFactor'] = 0
            record['trainingStressScore'] = 0

        master_db.append(record)

    # 3. Add Future/Missed Plans
    for p in plan_list:
        p_sport = normalize_sport(p['plannedWorkout'])
        key = f"{p['date']}|{p_sport}"
        
        # If this plan wasn't matched to a Garmin activity
        is_matched = False
        for rec in master_db:
            if rec['date'] == p['date'] and rec['actualSport'] == p_sport:
                is_matched = True
                break
        
        if not is_matched:
            # Determine if Missed or Pending
            status = "Pending"
            if p['date'] < datetime.now().strftime('%Y-%m-%d'):
                status = "Missed"
                
            master_db.append({
                "date": p['date'],
                "Day": p['day'],
                "Status": status,
                "plannedWorkout": p['plannedWorkout'],
                "plannedDuration": p['plannedDuration'],
                "notes": p['notes'],
                "actualSport": p_sport, # Placeholder for UI logic
                "Match Status": "Planned"
            })

    # Sort and Save
    master_db.sort(key=lambda x: x['date'], reverse=True)
    
    with open(config.MASTER_DB, 'w', encoding='utf-8') as f:
        json.dump(master_db, f, indent=2)
        
    print(f"✅ REBUILD COMPLETE: {len(master_db)} records saved.")
    return master_db

if __name__ == "__main__":
    sync()
