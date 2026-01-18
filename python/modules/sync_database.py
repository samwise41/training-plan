import json
import os
import re
import ast
import sys
from datetime import datetime, timedelta

# --- ROBUST IMPORT LOGIC ---
try:
    from . import config
except ImportError:
    import config

# --- CONFIGURATION ---
SYNC_WINDOW_DAYS = 60  

# --- 1. HELPER FUNCTIONS ---

def normalize_sport(val, activity_type=None):
    val = str(val).upper() if val else ""
    act_type = str(activity_type).upper() if activity_type else ""
    
    # 1. Check strict Activity Types (Garmin/Strava)
    if 'RIDE' in act_type or 'CYCL' in act_type or 'BIK' in act_type: return 'Bike'
    if 'RUN' in act_type: return 'Run'
    if 'SWIM' in act_type or 'POOL' in act_type: return 'Swim'

    # 2. Check text tags
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

# --- 2. BUNDLING LOGIC (The Fix) ---

def bundle_activities(activities):
    """Combines multiple partial recordings into one workout."""
    if not activities: return None
    
    # Sort by duration (longest is usually the 'main' file)
    activities.sort(key=lambda x: x.get('duration', 0) or 0, reverse=True)
    main = activities[0]
    
    # Base data from main file
    combined = main.copy()
    
    # Sum totals
    combined['duration'] = sum((a.get('duration') or 0) for a in activities)
    combined['distance'] = sum((a.get('distance') or 0) for a in activities)
    combined['calories'] = sum((a.get('calories') or 0) for a in activities)
    combined['elevationGain'] = sum((a.get('elevationGain') or 0) for a in activities)
    
    # Weighted Averages (Power, HR)
    total_dur = combined['duration']
    if total_dur > 0:
        def weighted(key):
            val = sum((a.get(key) or 0) * (a.get('duration') or 0) for a in activities)
            return val / total_dur

        combined['averageHR'] = weighted('averageHR')
        combined['avgPower'] = weighted('avgPower')
        combined['normPower'] = weighted('normPower') # Approximation
    
    # Max values
    combined['maxHR'] = max((a.get('maxHR') or 0) for a in activities)
    combined['maxPower'] = max((a.get('maxPower') or 0) for a in activities)
    
    # Join IDs
    all_ids = [str(a.get('activityId')) for a in activities if a.get('activityId')]
    combined['activityId'] = ",".join(all_ids)
    
    # Formatting Name: If multiple, append (+)
    if len(activities) > 1:
        base_name = main.get('activityName', 'Activity')
        # Check if [TAG] is present, if not add it based on normalized sport
        sport = normalize_sport(base_name, main.get('activityType', {}).get('typeKey'))
        if sport and f"[{sport.upper()}]" not in base_name:
             # Don't double add if it's "Run" and "[RUN]"
             pass 
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

    # A. Index Existing IDs (Handle Comma-Separated Bundles)
    existing_ids = {}
    for item in db_data:
        id_val = str(item.get('id', ''))
        if id_val:
            for sub_id in id_val.split(','):
                clean_id = sub_id.strip()
                if clean_id: existing_ids[clean_id] = item

    # B. Time Gates
    today = datetime.now()
    today_str = today.strftime('%Y-%m-%d')
    cutoff_date = (today - timedelta(days=SYNC_WINDOW_DAYS)).strftime('%Y-%m-%d')

    # C. Add New Planned Workouts
    count_new_plan = 0
    for plan in planned_items:
        p_date = plan['date']
        p_name = plan.get('plannedWorkout', '')
        if p_date < cutoff_date or p_date > today_str: continue 
        if not p_name or "rest day" in p_name.lower(): continue
        
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
                "distance": None, "movingTime": None, "avgPower": None, "normPower": None,
                "avgHr": None, "tss": None, "if": None
            }
            db_data.append(new_rec)
            count_new_plan += 1
    print(f"   + Added {count_new_plan} new planned items.")

    # D. Group Garmin Data (The Fix for Duplicates)
    grouped_garmin = {} 
    
    for g in garmin_list:
        g_date = g.get('startTimeLocal', '')[:10]
        if g_date < cutoff_date or g_date > today_str: continue
        
        # Determine Sport
        g_type_key = g.get('activityType', {}).get('typeKey', '')
        sport = normalize_sport(g.get('activityName'), g_type_key)
        if not sport: continue 
        
        # Group Key: "2026-01-14|Bike"
        key = f"{g_date}|{sport}"
        if key not in grouped_garmin: grouped_garmin[key] = []
        grouped_garmin[key].append(g)

    # E. Process Groups
    count_linked = 0
    count_unplanned = 0

    for key, group in grouped_garmin.items():
        # Bundle 3 files -> 1 composite
        composite = bundle_activities(group)
        if not composite: continue
        
        g_date, sport = key.split('|')
        comp_id_str = str(composite.get('activityId')) # "ID1,ID2,ID3"
        comp_ids = comp_id_str.split(',')
        
        # Prepare Metrics
        metrics = {
            "id": comp_id_str,
            "actualSport": sport,
            "actualWorkout": composite.get('activityName'),
            "actualDuration": clean_numeric(composite.get('duration', 0)) / 60.0,
            "movingTime": clean_numeric(composite.get('duration')),
            "distance": clean_numeric(composite.get('distance')),
            "avgHr": clean_numeric(composite.get('averageHR')),
            "maxHr": clean_numeric(composite.get('maxHR')),
            "avgPower": clean_numeric(composite.get('avgPower')),
            "normPower": clean_numeric(composite.get('normPower')),
            "calories": clean_numeric(composite.get('calories')),
            "elevation": clean_numeric(composite.get('elevationGain')),
            "rpe": clean_numeric(composite.get('perceivedEffort')),
            "feeling": clean_numeric(composite.get('feeling'))
        }
        if metrics['normPower'] and metrics['movingTime']:
            i_factor = metrics['normPower'] / current_ftp
            metrics['if'] = round(i_factor, 2)
            metrics['tss'] = round((metrics['movingTime'] * metrics['normPower'] * i_factor) / (current_ftp * 3600) * 100, 1)

        # 1. CHECK IF ALREADY CLAIMED
        # If ANY of the IDs in the bundle are known, we update that record
        found_existing = False
        for cid in comp_ids:
            if cid in existing_ids:
                rec = existing_ids[cid]
                # Update logic: If it's a "better" match (e.g. bundle vs single), update
                # For safety, we just ensure it's COMPLETED and has latest metrics
                rec.update(metrics)
                rec['status'] = "COMPLETED"
                found_existing = True
                break # Matched one, so the bundle is accounted for
        
        if found_existing:
            continue 

        # 2. LINK TO PENDING
        matched = False
        for rec in db_data:
            if rec.get('date') == g_date and rec.get('status') == 'Pending':
                if rec.get('plannedSport') == sport:
                    rec.update(metrics)
                    rec['status'] = "COMPLETED"
                    
                    # Mark IDs as claimed so we don't re-use
                    for cid in comp_ids: existing_ids[cid] = rec
                    
                    count_linked += 1
                    matched = True
                    break
        
        # 3. ADD UNPLANNED (Bundled)
        if not matched:
            new_unp = {
                "date": g_date, "status": "COMPLETED",
                "plannedWorkout": "", "plannedDuration": None,
                "plannedSport": None, "notes": "Unplanned Session"
            }
            new_unp.update(metrics)
            db_data.append(new_unp)
            for cid in comp_ids: existing_ids[cid] = new_unp
            count_unplanned += 1

    print(f"   + Linked {count_linked} new bundles.")
    print(f"   + Added {count_unplanned} new unplanned bundles.")
    save_db(db_data)

if __name__ == "__main__":
    sync()
