import json
import os
import re
import sys
from datetime import datetime, timedelta

# --- ROBUST IMPORT LOGIC ---
try:
    from . import config
except ImportError:
    import config

# --- CONFIGURATION ---
# Set to 10 years to ensure ALL history is re-processed with new fields
SYNC_WINDOW_DAYS = 3650  

# --- 1. HELPER FUNCTIONS ---

def normalize_sport(val, activity_type=None):
    val = str(val).upper() if val else ""
    act_type = str(activity_type).upper() if activity_type else ""
    
    if 'RIDE' in act_type or 'CYCL' in act_type or 'BIK' in act_type: return 'Bike'
    if 'RUN' in act_type: return 'Run'
    if 'SWIM' in act_type or 'POOL' in act_type: return 'Swim'

    if '[BIKE]' in val or 'ZWIFT' in val or 'CYCLING' in val: return 'Bike'
    if '[RUN]' in val or 'RUNNING' in val: return 'Run'
    if '[SWIM]' in val or 'SWIMMING' in val: return 'Swim'
    return None

def clean_numeric(val):
    if val is None or val == "": return None
    s_val = str(val).strip().lower()
    if s_val == 'nan': return None
    try: return float(s_val)
    except ValueError: return None

def get_current_ftp():
    if not os.path.exists(config.PLAN_FILE): return 241
    try:
        with open(config.PLAN_FILE, 'r', encoding='utf-8') as f: content = f.read()
        match = re.search(r"Cycling FTP[:\*]*\s*(\d+)", content, re.IGNORECASE)
        if match: return int(match.group(1))
    except: pass
    return 241

# --- 2. BUNDLING LOGIC ---

def bundle_activities(activities):
    if not activities: return None
    # Sort by duration to find the "Main" activity
    activities.sort(key=lambda x: x.get('duration', 0) or 0, reverse=True)
    main = activities[0]
    combined = main.copy()
    
    # --- METADATA PRESERVATION ---
    combined['trainingEffectLabel'] = main.get('trainingEffectLabel')
    combined['activityType'] = main.get('activityType')
    combined['sportTypeId'] = main.get('sportTypeId')
    combined['vO2MaxValue'] = main.get('vO2MaxValue')
    
    # --- SUMMATIONS ---
    combined['duration'] = sum((a.get('duration') or 0) for a in activities)
    combined['distance'] = sum((a.get('distance') or 0) for a in activities)
    combined['calories'] = sum((a.get('calories') or 0) for a in activities)
    combined['elevationGain'] = sum((a.get('elevationGain') or 0) for a in activities)
    
    # --- WEIGHTED AVERAGES ---
    total_dur = combined['duration']
    if total_dur > 0:
        def weighted(key):
            val = sum((a.get(key) or 0) * (a.get('duration') or 0) for a in activities)
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

    # --- MAXIMA ---
    combined['maxHR'] = max((a.get('maxHR') or 0) for a in activities)
    combined['maxPower'] = max((a.get('maxPower') or 0) for a in activities)
    combined['maxSpeed'] = max((a.get('maxSpeed') or 0) for a in activities)
    
    # --- IDS ---
    all_ids = [str(a.get('activityId')) for a in activities if a.get('activityId')]
    combined['activityId'] = ",".join(all_ids)
    
    if len(activities) > 1:
        base_name = main.get('activityName', 'Activity')
        combined['activityName'] = f"{base_name} (+{len(activities)-1})"
        
    return combined

# --- 3. CORE IO ---

def load_db():
    if not os.path.exists(config.MASTER_DB): return []
    try:
        with open(config.MASTER_DB, 'r', encoding='utf-8') as f: return json.load(f)
    except: return []

def save_db(data):
    data.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)
    with open(config.MASTER_DB, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"💾 Database saved ({len(data)} records).")

def extract_planned_workouts():
    if not os.path.exists(config.PLAN_FILE): return []
    with open(config.PLAN_FILE, 'r', encoding='utf-8') as f: lines = f.readlines()
    
    table_lines, found = [], False
    for line in lines:
        s = line.strip()
        if not found:
            if s.startswith('#') and 'weekly schedule' in s.lower(): found = True
            continue
        if (s.startswith('# ') or s.startswith('## ')) and len(table_lines) > 2: break
        if '|' in s: table_lines.append(s)
            
    if not table_lines: return []
    headers = [h.strip().lower() for h in table_lines[0].strip('|').split('|')]
    
    col_map = {}
    for i, h in enumerate(headers):
        if 'date' in h: col_map['date'] = i
        elif 'day' in h: col_map['day'] = i
        elif 'planned workout' in h: col_map['plannedWorkout'] = i
        elif 'duration' in h: col_map['plannedDuration'] = i
        elif 'notes' in h: col_map['notes'] = i

    data = []
    for line in table_lines[1:]:
        if '---' in line: continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        row = {}
        for k, idx in col_map.items():
            if idx < len(cells): row[k] = cells[idx]
        
        if 'date' in row and row['date']:
            try:
                dt = datetime.strptime(row['date'], '%Y-%m-%d')
                row['date'] = dt.strftime('%Y-%m-%d')
                if 'plannedDuration' in row:
                    row['plannedDuration'] = clean_numeric(re.sub(r"[^0-9\.]", "", row['plannedDuration']))
                row['plannedSport'] = normalize_sport(row.get('plannedWorkout', ''))
                data.append(row)
            except: continue
    return data

# --- 4. MAIN SYNC ---

def sync():
    print(f"🔄 SYNC: JSON Architecture (Window: {SYNC_WINDOW_DAYS} days)")
    
    db_data = load_db()
    planned_items = extract_planned_workouts()
    current_ftp = get_current_ftp()
    
    if not os.path.exists(config.GARMIN_JSON): return
    with open(config.GARMIN_JSON, 'r', encoding='utf-8') as f: garmin_list = json.load(f)

    existing_ids = {}
    for item in db_data:
        id_val = str(item.get('id', ''))
        if id_val:
            for sub_id in id_val.split(','):
                clean_id = sub_id.strip()
                if clean_id: existing_ids[clean_id] = item

    today = datetime.now()
    today_str = today.strftime('%Y-%m-%d')
    cutoff_date = (today - timedelta(days=SYNC_WINDOW_DAYS)).strftime('%Y-%m-%d')

    count_new_plan = 0
    for plan in planned_items:
        p_date = plan['date']
        p_name = plan.get('plannedWorkout', '')
        
        if p_date < cutoff_date or p_date > today_str: continue 
        if not p_name or "rest day" in p_name.lower(): continue
        
        # Skip Sundays unless explicitly planned
        if plan.get('day') == 'Sunday' and not plan.get('plannedSport'):
            continue
        
        exists = False
        for rec in db_data:
            if rec.get('date') == p_date and rec.get('plannedWorkout') == p_name:
                exists = True; break
        
        if not exists:
            new_rec = {
                "id": "", "date": p_date, "status": "Pending",
                "day": plan.get('day', ''), "plannedSport": plan.get('plannedSport'),
                "actualSport": None, "plannedWorkout": p_name,
                "plannedDuration": plan.get('plannedDuration'), "actualWorkout": "",
                "actualDuration": None, "notes": plan.get('notes', ''),
                
                # Default Fields to None
                "distance": None, "movingTime": None, "avgPower": None, "normPower": None,
                "avgHr": None, "tss": None, "if": None, "Match Status": "Planned"
            }
            db_data.append(new_rec)
            count_new_plan += 1
    print(f"   + Added {count_new_plan} new planned items.")

    grouped_garmin = {} 
    for g in garmin_list:
        g_date = g.get('startTimeLocal', '')[:10]
        # Allow FULL history re-process
        # if g_date < cutoff_date or g_date > today_str: continue
        g_type_key = g.get('activityType', {}).get('typeKey', '')
        sport = normalize_sport(g.get('activityName'), g_type_key)
        if not sport: continue 
        key = f"{g_date}|{sport}"
        if key not in grouped_garmin: grouped_garmin[key] = []
        grouped_garmin[key].append(g)

    count_linked = 0
    count_unplanned = 0

    for key, group in grouped_garmin.items():
        composite = bundle_activities(group)
        if not composite: continue
        
        g_date, sport = key.split('|')
        comp_id_str = str(composite.get('activityId'))
        comp_ids = comp_id_str.split(',')
        
        # Calculate Day Name
        try:
            dt_obj = datetime.strptime(g_date, '%Y-%m-%d')
            day_name = dt_obj.strftime('%A')
        except:
            day_name = "Unknown"

        # --- FULL METRICS EXTRACTION (Strictly as requested) ---
        metrics = {
            # Identity
            "id": comp_id_str,
            "Date": g_date,
            "date": g_date, # Duplicate for app compatibility
            "Status": "COMPLETED",
            "status": "COMPLETED", # Duplicate for app compatibility
            "Day": day_name,
            "day": day_name, # Duplicate for app compatibility
            
            # Types
            "actualSport": sport,
            "activityId": comp_id_str,
            "activityName": composite.get('activityName'),
            "actualWorkout": composite.get('activityName'), 
            "activityType": composite.get('activityType'),
            "sportTypeId": composite.get('sportTypeId'),

            # Core Stats
            "duration": clean_numeric(composite.get('duration')), 
            "actualDuration": clean_numeric(composite.get('duration', 0)) / 60.0, 
            "movingTime": clean_numeric(composite.get('movingDuration')),
            "distance": clean_numeric(composite.get('distance')),
            "calories": clean_numeric(composite.get('calories')),
            "elevationGain": clean_numeric(composite.get('elevationGain')),

            # Heart Rate
            "averageHR": clean_numeric(composite.get('averageHR')),
            "maxHR": clean_numeric(composite.get('maxHR')),
            
            # Power
            "avgPower": clean_numeric(composite.get('avgPower')),
            "maxPower": clean_numeric(composite.get('maxPower')),
            "normPower": clean_numeric(composite.get('normPower')),
            
            # Speed & Cadence
            "averageSpeed": clean_numeric(composite.get('averageSpeed')),
            "maxSpeed": clean_numeric(composite.get('maxSpeed')),
            "averageBikingCadenceInRevPerMinute": clean_numeric(composite.get('averageBikingCadenceInRevPerMinute')),
            "averageRunningCadenceInStepsPerMinute": clean_numeric(composite.get('averageRunningCadenceInStepsPerMinute')),

            # Running Dynamics
            "avgStrideLength": clean_numeric(composite.get('avgStrideLength')),
            "avgVerticalOscillation": clean_numeric(composite.get('avgVerticalOscillation')),
            "avgGroundContactTime": clean_numeric(composite.get('avgGroundContactTime')),
            
            # Physiology
            "aerobicTrainingEffect": clean_numeric(composite.get('aerobicTrainingEffect')),
            "anaerobicTrainingEffect": clean_numeric(composite.get('anaerobicTrainingEffect')),
            "trainingEffectLabel": composite.get('trainingEffectLabel'),
            "vO2MaxValue": clean_numeric(composite.get('vO2MaxValue')),
            
            # Subjective
            "RPE": clean_numeric(composite.get('perceivedEffort')),
            "Feeling": clean_numeric(composite.get('feeling')),
            
            # Default Status
            "Match Status": "Matched"
        }
        
        # Calculations
        if metrics['normPower'] and metrics['movingTime']:
            i_factor = metrics['normPower'] / current_ftp
            metrics['intensityFactor'] = round(i_factor, 2)
            metrics['trainingStressScore'] = round((metrics['movingTime'] * metrics['normPower'] * i_factor) / (current_ftp * 3600) * 100, 1)

        # Logic: Link to Existing or Create New
        found_existing = False
        for cid in comp_ids:
            if cid in existing_ids:
                rec = existing_ids[cid]
                rec.update(metrics)
                rec['Day'] = day_name # Ensure day is updated
                found_existing = True
                break
        
        if found_existing: continue 

        matched = False
        for rec in db_data:
            rec_status = str(rec.get('status', '')).upper()
            if rec.get('date') == g_date and (rec_status == 'PENDING' or rec_status == 'PLANNED'):
                if rec.get('plannedSport') == sport:
                    rec.update(metrics)
                    for cid in comp_ids: existing_ids[cid] = rec
                    count_linked += 1
                    matched = True
                    break
        
        if not matched:
            new_unp = {
                "date": g_date, 
                "plannedWorkout": "", 
                "plannedDuration": None,
                "plannedSport": None, 
                "notes": "Unplanned Session",
                "Match Status": "Unplanned"
            }
            new_unp.update(metrics)
            db_data.append(new_unp)
            for cid in comp_ids: existing_ids[cid] = new_unp
            count_unplanned += 1

    print(f"   + Linked {count_linked} new bundles.")
    print(f"   + Added {count_unplanned} new unplanned bundles.")
    save_db(db_data)
    
    return db_data 

if __name__ == "__main__":
    sync()
