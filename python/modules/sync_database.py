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
    """
    Strictly categorizes sports into 'Bike', 'Run', 'Swim', or None.
    Returns None for Yoga, Strength, Golf, etc.
    """
    val = str(val).upper() if val else ""
    act_type = str(activity_type).upper() if activity_type else ""
    
    # Check strict Activity Types
    if 'RIDE' in act_type or 'CYCL' in act_type or 'BIK' in act_type: return 'Bike'
    if 'RUN' in act_type: return 'Run'
    if 'SWIM' in act_type or 'POOL' in act_type: return 'Swim'

    # Check text tags
    if '[BIKE]' in val or 'ZWIFT' in val or 'CYCLING' in val: return 'Bike'
    if '[RUN]' in val or 'RUNNING' in val: return 'Run'
    if '[SWIM]' in val or 'SWIMMING' in val: return 'Swim'
        
    return None

def clean_numeric(val):
    if val is None or val == "": return None
    s_val = str(val).strip().lower()
    if s_val == 'nan': return None
    try:
        return float(s_val)
    except ValueError:
        return None

def get_current_ftp():
    if not os.path.exists(config.PLAN_FILE): return 241
    try:
        with open(config.PLAN_FILE, 'r', encoding='utf-8') as f: content = f.read()
        pattern = r"Cycling FTP[:\*]*\s*(\d+)"
        match = re.search(pattern, content, re.IGNORECASE)
        if match: return int(match.group(1))
    except: pass
    return 241

# --- 2. CORE IO FUNCTIONS ---

def load_db():
    if not os.path.exists(config.MASTER_DB): return []
    try:
        with open(config.MASTER_DB, 'r', encoding='utf-8') as f:
            return json.load(f)
    except: return []

def save_db(data):
    # Sort by date descending
    data.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)
    with open(config.MASTER_DB, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"💾 Database saved ({len(data)} records).")

# --- 3. PARSING PLANNED WORKOUTS ---

def extract_planned_workouts():
    if not os.path.exists(config.PLAN_FILE): return []
    with open(config.PLAN_FILE, 'r', encoding='utf-8') as f: lines = f.readlines()
    
    table_lines, found_header = [], False
    for line in lines:
        s = line.strip()
        if not found_header:
            if s.startswith('#') and 'weekly schedule' in s.lower(): found_header = True
            continue
        if (s.startswith('# ') or s.startswith('## ')) and len(table_lines) > 2: break
        if '|' in s: table_lines.append(s)
            
    if not found_header or not table_lines: return []
    
    raw_headers = [h.strip().lower() for h in table_lines[0].strip('|').split('|')]
    col_map = {}
    for i, h in enumerate(raw_headers):
        if 'date' in h: col_map['date'] = i
        elif 'day' in h: col_map['day'] = i
        elif 'planned workout' in h: col_map['plannedWorkout'] = i
        elif 'duration' in h: col_map['plannedDuration'] = i
        elif 'notes' in h: col_map['notes'] = i

    planned_data = []
    for line in table_lines[1:]:
        if '---' in line: continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        row = {}
        for key, idx in col_map.items():
            if idx < len(cells): row[key] = cells[idx]
        
        if 'date' in row and row['date']:
            try:
                dt = datetime.strptime(row['date'], '%Y-%m-%d')
                row['date'] = dt.strftime('%Y-%m-%d')
                if 'plannedDuration' in row:
                    dur_str = re.sub(r"[^0-9\.]", "", row['plannedDuration'])
                    row['plannedDuration'] = clean_numeric(dur_str)
                row['plannedSport'] = normalize_sport(row.get('plannedWorkout', ''))
                planned_data.append(row)
            except ValueError: continue
    return planned_data

# --- 4. MAIN SYNC LOGIC ---

def sync():
    print(f"🔄 SYNC: JSON Architecture (Window: {SYNC_WINDOW_DAYS} days)")
    
    db_data = load_db()
    planned_items = extract_planned_workouts()
    current_ftp = get_current_ftp()
    
    if not os.path.exists(config.GARMIN_JSON):
        print("❌ Garmin JSON missing.")
        return
    with open(config.GARMIN_JSON, 'r', encoding='utf-8') as f:
        garmin_list = json.load(f)

    existing_ids = {str(item.get('id')): item for item in db_data if item.get('id')}
    
    # Time Boundaries
    today = datetime.now()
    today_str = today.strftime('%Y-%m-%d')
    cutoff_date = (today - timedelta(days=SYNC_WINDOW_DAYS)).strftime('%Y-%m-%d')
    
    # B. Merge Planned Workouts (Only Past/Present)
    count_new_planned = 0
    for plan in planned_items:
        p_date = plan['date']
        p_name = plan.get('plannedWorkout', '')
        
        if p_date < cutoff_date: continue
        if p_date > today_str: continue # <--- STRICTLY BLOCK FUTURE DATES
        if not p_name or "rest day" in p_name.lower(): continue
        
        exists = False
        for record in db_data:
            if record.get('date') == p_date and record.get('plannedWorkout') == p_name:
                exists = True
                break
        
        if not exists:
            new_record = {
                "id": "",
                "date": p_date,
                "status": "Pending",
                "day": plan.get('day', ''),
                "plannedSport": plan.get('plannedSport'),
                "actualSport": None,
                "plannedWorkout": p_name,
                "plannedDuration": plan.get('plannedDuration'),
                "actualWorkout": "",
                "actualDuration": None,
                "notes": plan.get('notes', ''),
                "distance": None, "movingTime": None, "avgPower": None,
                "normPower": None, "avgHr": None, "tss": None, "if": None
            }
            db_data.append(new_record)
            count_new_planned += 1
            
    print(f"   + Added {count_new_planned} new planned items.")

    # C. Process Garmin Data
    count_linked = 0
    count_unplanned = 0
    
    for g in garmin_list:
        g_date = g.get('startTimeLocal', '')[:10]
        if g_date < cutoff_date or g_date > today_str: continue
        
        g_id = str(g.get('activityId'))
        g_type_key = g.get('activityType', {}).get('typeKey', '')
        sport = normalize_sport(g.get('activityName'), g_type_key)
        if not sport: continue 
        
        metrics = {
            "id": g_id,
            "actualSport": sport,
            "actualWorkout": g.get('activityName'),
            "actualDuration": clean_numeric(g.get('duration', 0)) / 60.0 if g.get('duration') else None,
            "movingTime": clean_numeric(g.get('duration')),
            "distance": clean_numeric(g.get('distance')),
            "avgHr": clean_numeric(g.get('averageHR')),
            "maxHr": clean_numeric(g.get('maxHR')),
            "avgPower": clean_numeric(g.get('avgPower')),
            "normPower": clean_numeric(g.get('normPower')),
            "calories": clean_numeric(g.get('calories')),
            "elevation": clean_numeric(g.get('elevationGain')),
            "rpe": clean_numeric(g.get('perceivedEffort')),
            "feeling": clean_numeric(g.get('feeling'))
        }
        
        if metrics['normPower'] and metrics['movingTime']:
            intensity = metrics['normPower'] / current_ftp
            metrics['if'] = round(intensity, 2)
            metrics['tss'] = round((metrics['movingTime'] * metrics['normPower'] * intensity) / (current_ftp * 3600) * 100, 1)

        if g_id in existing_ids:
            rec = existing_ids[g_id]
            rec.update(metrics)
            rec['status'] = "COMPLETED"
            continue

        matched = False
        for rec in db_data:
            if rec.get('date') == g_date and rec.get('status') == 'Pending':
                if rec.get('plannedSport') == sport:
                    rec.update(metrics)
                    rec['status'] = "COMPLETED"
                    existing_ids[g_id] = rec 
                    count_linked += 1
                    matched = True
                    break
        
        if not matched:
            new_unplanned = {
                "date": g_date,
                "status": "COMPLETED",
                "plannedWorkout": "",
                "plannedDuration": None,
                "plannedSport": None,
                "notes": "Unplanned Session",
            }
            new_unplanned.update(metrics)
            db_data.append(new_unplanned)
            existing_ids[g_id] = new_unplanned
            count_unplanned += 1

    print(f"   + Linked {count_linked} activities.")
    print(f"   + Added {count_unplanned} unplanned activities.")

    save_db(db_data)

if __name__ == "__main__":
    sync()