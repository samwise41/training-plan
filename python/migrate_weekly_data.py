import pandas as pd
import json
import os
import subprocess
import traceback
import re
from datetime import datetime

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

PLAN_FILE = os.path.join(ROOT_DIR, 'endurance_plan.md')
MASTER_DB = os.path.join(ROOT_DIR, 'MASTER_TRAINING_DATABASE.md')
GARMIN_JSON = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')

# Helper Scripts
GARMIN_FETCH_CMD = ["python", os.path.join(SCRIPT_DIR, "fetch_garmin.py")]
HYDRATE_CMD = ["python", os.path.join(SCRIPT_DIR, "hydrate_master_db.py")]

MASTER_COLUMNS = [
    'Status', 'Day', 'Planned Workout', 'Planned Duration', 
    'Actual Workout', 'Actual Duration', 'Notes / Targets', 'Date', 'Match Status',
    'activityId', 'activityName', 'activityType', 'sportTypeId',
    'duration', 'distance', 'averageHR', 'maxHR', 
    'aerobicTrainingEffect', 'anaerobicTrainingEffect', 'trainingEffectLabel',
    'avgPower', 'maxPower', 'normPower', 'trainingStressScore', 'intensityFactor',
    'averageSpeed', 'maxSpeed', 
    'averageBikingCadenceInRevPerMinute', 'averageRunningCadenceInStepsPerMinute',
    'avgStrideLength', 'avgVerticalOscillation', 'avgGroundContactTime',
    'vO2MaxValue', 'calories', 'elevationGain'
]

def print_header(msg): print(f"\n{'='*60}\n{msg}\n{'='*60}")

def run_garmin_fetch():
    print(f"📡 Triggering Garmin Fetch...")
    if not os.path.exists(GARMIN_FETCH_CMD[1]): return
    try:
        env = os.environ.copy()
        subprocess.run(GARMIN_FETCH_CMD, check=True, env=env, cwd=SCRIPT_DIR)
        print("✅ Garmin Data Synced.")
    except Exception as e: print(f"⚠️ Warning: Fetch failed: {e}")

def run_hydration():
    print(f"💧 Triggering Database Hydration & TSS Calc...")
    if not os.path.exists(HYDRATE_CMD[1]): return
    try:
        subprocess.run(HYDRATE_CMD, check=True, cwd=SCRIPT_DIR)
        print("✅ Hydration Complete.")
    except Exception as e: print(f"⚠️ Warning: Hydration failed: {e}")

def git_push_changes():
    print("🐙 Pushing changes to GitHub...")
    try:
        subprocess.run(["git", "config", "user.name", "github-actions"], check=True)
        subprocess.run(["git", "config", "user.email", "github-actions@github.com"], check=True)
        subprocess.run(["git", "add", MASTER_DB, PLAN_FILE, GARMIN_JSON], check=True)
        
        status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True).stdout
        if status:
            msg = f"Auto-Sync: Master DB & Weekly Plan {datetime.now().strftime('%Y-%m-%d')}"
            subprocess.run(["git", "commit", "-m", msg], check=True)
            subprocess.run(["git", "push"], check=True)
            print("✅ Successfully pushed to GitHub!")
        else: print("ℹ️ No changes to commit.")
    except Exception as e: print(f"⚠️ Git Push Failed: {e}")

def load_master_db():
    if not os.path.exists(MASTER_DB): return pd.DataFrame(columns=MASTER_COLUMNS)
    with open(MASTER_DB, 'r', encoding='utf-8') as f: lines = f.readlines()
    if len(lines) < 3: return pd.DataFrame(columns=MASTER_COLUMNS)
    
    # Robust header parsing
    header = [h.strip() for h in lines[0].strip('|').split('|')]
    data = []
    for line in lines[2:]:
        if '|' not in line: continue
        row = [c.strip() for c in line.strip('|').split('|')]
        # Fix column mismatch
        if len(row) < len(header): row += [''] * (len(header) - len(row))
        data.append(dict(zip(header, row)))
    return pd.DataFrame(data)

def get_activity_prefix(activity):
    g_type = activity.get('activityType', {}).get('typeKey', '').lower()
    if 'running' in g_type: return "[RUN]"
    if 'road_biking' in g_type or 'virtual_ride' in g_type: return "[BIKE]"
    if 'swimming' in g_type: return "[SWIM]"
    return ""

def extract_weekly_table():
    if not os.path.exists(PLAN_FILE): return pd.DataFrame()
    with open(PLAN_FILE, 'r', encoding='utf-8') as f: lines = f.readlines()
    
    table_lines, found_header = [], False
    for line in lines:
        s = line.strip()
        if not found_header:
            if s.startswith('#') and 'weekly schedule' in s.lower(): found_header = True
            continue
        if (s.startswith('# ') or s.startswith('## ')) and len(table_lines) > 2: break
        if '|' in s: table_lines.append(s)
        
    if not found_header or not table_lines: return pd.DataFrame()
    
    header = [h.strip() for h in table_lines[0].strip('|').split('|')]
    data = []
    for line in table_lines[1:]:
        if '---' in line: continue
        row_vals = [c.strip() for c in line.strip('|').split('|')]
        if len(row_vals) < len(header): row_vals += [''] * (len(header) - len(row_vals))
        data.append(dict(zip(header, row_vals)))
    return pd.DataFrame(data)

def main():
    try:
        print_header("STARTING MIGRATION & PLAN UPDATE")
        run_garmin_fetch()

        if not os.path.exists(PLAN_FILE): return
        df_plan = extract_weekly_table()
        df_master = load_master_db()
        
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            json_data = json.load(f)

        # Map Date -> List of Activities
        garmin_by_date = {}
        for entry in json_data:
            d = entry.get('startTimeLocal', '')[:10]
            if d:
                if d not in garmin_by_date: garmin_by_date[d] = []
                garmin_by_date[d].append(entry)

        new_rows = []
        plan_updates = {}
        matched_activity_ids = set() 

        print_header("1. MATCHING PLANNED WORKOUTS")
        for idx, row in df_plan.iterrows():
            date_str = str(row.get('Date', '')).strip()
            plan_workout = str(row.get('Planned Workout', ''))
            
            if date_str in garmin_by_date:
                candidates = garmin_by_date[date_str]
                match = None
                p_type = plan_workout.lower()
                
                # --- STRICT MATCHING LOGIC ---
                for act in candidates:
                    g_type = act.get('activityType', {}).get('typeKey', '').lower()
                    
                    is_run = 'run' in p_type and 'running' in g_type
                    is_bike = 'bike' in p_type and ('biking' in g_type or 'virtual' in g_type)
                    is_swim = 'swim' in p_type and 'swimming' in g_type
                    
                    if is_run or is_bike or is_swim:
                        match = act
                        break
                
                if match:
                    act_id = match.get('activityId')
                    matched_activity_ids.add(act_id)
                    
                    prefix = get_activity_prefix(match)
                    raw_name = match.get('activityName', 'Manual Activity')
                    new_name = f"{prefix} {raw_name}" if prefix and prefix not in raw_name else raw_name
                    dur_min = f"{float(match.get('duration', 0)) / 60:.1f}"

                    plan_updates[date_str] = {"name": new_name, "dur": dur_min}

                    new_row = {c: "" for c in MASTER_COLUMNS}
                    new_row.update({
                        'Status': 'COMPLETED', 'Date': date_str, 'Day': str(row.get('Day', '')),
                        'Planned Workout': plan_workout, 'Planned Duration': str(row.get('Planned Duration', '')),
                        'Actual Workout': new_name, 'Actual Duration': dur_min,
                        'Notes / Targets': str(row.get('Notes / Targets', '')),
                        'Match Status': 'Linked', 'activityId': str(act_id)
                    })
                    for col in MASTER_COLUMNS:
                        if col in match: new_row[col] = str(match[col])
                    new_rows.append(new_row)
                    print(f"   ✅ Linked: [{date_str}] {plan_workout} -> {new_name}")
                else:
                    print(f"   ⚠️ No Sport Match for: [{date_str}] {plan_workout}")

        print_header("2. FINDING UNPLANNED ACTIVITIES")
        # Check all activities in the relevant date range
        plan_dates = set(df_plan['Date'].unique())
        
        for date_str, activities in garmin_by_date.items():
            if date_str in plan_dates:
                for act in activities:
                    if act.get('activityId') not in matched_activity_ids:
                        # Found an orphan!
                        prefix = get_activity_prefix(act)
                        raw_name = act.get('activityName', 'Unplanned Activity')
                        name = f"{prefix} {raw_name}"
                        dur = f"{float(act.get('duration', 0)) / 60:.1f}"
                        
                        print(f"   🆕 Found Unplanned: [{date_str}] {name}")
                        
                        new_row = {c: "" for c in MASTER_COLUMNS}
                        new_row.update({
                            'Status': 'EXTRA', 'Date': date_str, 
                            'Day': datetime.strptime(date_str, '%Y-%m-%d').strftime('%A'),
                            'Planned Workout': '', 'Planned Duration': '',
                            'Actual Workout': name, 'Actual Duration': dur,
                            'Notes / Targets': 'Unplanned Session',
                            'Match Status': 'Unplanned', 'activityId': str(act.get('activityId'))
                        })
                        for col in MASTER_COLUMNS:
                            if col in act: new_row[col] = str(act[col])
                        new_rows.append(new_row)

        # --- UPDATE ENDURANCE_PLAN.MD ---
        if plan_updates:
            with open(PLAN_FILE, 'r', encoding='utf-8') as f: lines = f.readlines()
            with open(PLAN_FILE, 'w', encoding='utf-8') as f:
                in_schedule = False
                for line in lines:
                    if 'weekly schedule' in line.lower(): in_schedule = True
                    if in_schedule and '|' in line and '---' not in line and not line.strip().startswith('#'):
                        cols = [c.strip() for c in line.split('|')]
                        row_date = next((c for c in cols if re.match(r'\d{4}-\d{2}-\d{2}', c)), None)
                        if row_date in plan_updates:
                            update = plan_updates[row_date]
                            if len(cols) > 5:
                                cols[5] = update['name'] 
                                cols[6] = update['dur']  
                                f.write("| " + " | ".join(cols[1:-1]) + " |\n")
                            else: f.write(line)
                        else: f.write(line)
                    else:
                        if in_schedule and line.startswith('#') and 'weekly schedule' not in line.lower(): in_schedule = False
                        f.write(line)

        # --- SAVE MASTER DATABASE ---
        if new_rows:
            df_new = pd.DataFrame(new_rows)
            df_combined = pd.concat([df_new, df_master])
            
            # Dedup based on activityId
            # We filter out rows that have an ID but might be duplicates
            df_combined = df_combined.drop_duplicates(subset=['activityId'], keep='first')
            
            # Sort
            df_combined['Date_Obj'] = pd.to_datetime(df_combined['Date'], errors='coerce')
            df_combined = df_combined.sort_values(by='Date_Obj', ascending=False).drop(columns=['Date_Obj'])

            with open(MASTER_DB, 'w', encoding='utf-8') as f:
                f.write("| " + " | ".join(MASTER_COLUMNS) + " |\n")
                f.write("| " + " | ".join(['---'] * len(MASTER_COLUMNS)) + " |\n")
                for _, row in df_combined.iterrows():
                    vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in MASTER_COLUMNS]
                    f.write("| " + " | ".join(vals) + " |\n")

        # --- FINAL STEP: HYDRATE & PUSH ---
        run_hydration()
        git_push_changes()
        
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    main()
