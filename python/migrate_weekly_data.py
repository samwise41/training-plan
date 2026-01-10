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

GARMIN_FETCH_CMD = ["python", os.path.join(SCRIPT_DIR, "fetch_garmin.py")]
HYDRATE_DB_CMD = ["python", os.path.join(SCRIPT_DIR, "hydrate_master_db.py")]

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

def print_header(msg):
    print(f"\n{'='*60}\n{msg}\n{'='*60}")

def run_garmin_fetch():
    print(f"📡 Triggering Garmin Fetch...")
    if not os.path.exists(GARMIN_FETCH_CMD[1]):
        print(f"⚠️ Warning: Fetch script not found.")
        return
    try:
        env = os.environ.copy()
        subprocess.run(GARMIN_FETCH_CMD, check=True, env=env, cwd=SCRIPT_DIR)
        print("✅ Garmin Data Synced.")
    except Exception as e:
        print(f"⚠️ Warning: Fetch failed: {e}")

def run_hydration():
    print(f"💧 Triggering Hydration & TSS Calc...")
    if not os.path.exists(HYDRATE_DB_CMD[1]):
        print(f"⚠️ Warning: Hydrate script not found.")
        return
    try:
        subprocess.run(HYDRATE_DB_CMD, check=True, cwd=SCRIPT_DIR)
        print("✅ Hydration Complete.")
    except Exception as e:
        print(f"⚠️ Warning: Hydration failed: {e}")

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
        else:
            print("ℹ️ No changes to commit.")
    except Exception as e:
        print(f"⚠️ Git Push Failed: {e}")

def load_master_db():
    if not os.path.exists(MASTER_DB):
        return pd.DataFrame(columns=MASTER_COLUMNS)
    with open(MASTER_DB, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    if len(lines) < 3: return pd.DataFrame(columns=MASTER_COLUMNS)
    
    header = [h.strip() for h in lines[0].strip('|').split('|')]
    data = []
    for line in lines[2:]:
        if '|' not in line: continue
        row = [c.strip() for c in line.strip('|').split('|')]
        if len(row) < len(header): row += [''] * (len(header) - len(row))
        data.append(dict(zip(header, row)))
    return pd.DataFrame(data)

def extract_weekly_table():
    if not os.path.exists(PLAN_FILE): return pd.DataFrame()
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()

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

def get_activity_prefix(activity):
    """Detects sport type. Returns empty string if not Run/Bike/Swim."""
    g_type = activity.get('activityType', {}).get('typeKey', '').lower()
    
    if 'running' in g_type: return "[RUN]"
    # Broaden bike check to include 'cycling', 'indoor_cycling', 'mountain_biking'
    if 'cycling' in g_type or 'biking' in g_type or 'virtual_ride' in g_type: return "[BIKE]"
    # Broaden swim check to include 'lap_swimming', 'open_water_swimming'
    if 'swimming' in g_type: return "[SWIM]"
    
    return ""

def is_sport_match(plan_workout, garmin_activity):
    p_type = plan_workout.lower()
    g_type = garmin_activity.get('activityType', {}).get('typeKey', '').lower()
    
    if 'run' in p_type and 'running' in g_type: return True
    if 'bike' in p_type and ('cycling' in g_type or 'biking' in g_type or 'virtual' in g_type): return True
    if 'swim' in p_type and 'swimming' in g_type: return True
    return False

def main():
    try:
        print_header("STARTING MIGRATION")
        run_garmin_fetch()

        # 1. Load Data
        df_master = load_master_db()
        df_plan = extract_weekly_table()
        
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)

        # 2. Get Existing IDs from DB
        existing_ids = set()
        if 'activityId' in df_master.columns:
            existing_ids = set(df_master['activityId'].dropna().astype(str).unique())
        existing_ids = {x for x in existing_ids if x and x.lower() != 'nan' and x.lower() != 'none'}
        
        print(f"📊 Loaded Master DB: {len(df_master)} rows, {len(existing_ids)} existing IDs.")

        # 3. Filter Garmin Candidates
        candidates = []
        for act in garmin_data:
            if str(act['activityId']) not in existing_ids:
                candidates.append(act)
        
        candidates_by_date = {}
        for c in candidates:
            d = c.get('startTimeLocal', '')[:10]
            if d:
                candidates_by_date.setdefault(d, []).append(c)

        print(f"🔍 Processing {len(candidates)} new Garmin activities against Plan.")

        new_rows = []
        plan_updates = {} 

        # 4. Process Current Week Plan (Match Logic)
        if not df_plan.empty:
            for _, row in df_plan.iterrows():
                def get_col(name):
                    if name in row: return str(row[name])
                    for col in row.keys():
                        if name.lower() in col.lower(): return str(row[col])
                    return ""

                p_date = get_col('Date').strip()
                p_workout = get_col('Planned Workout')
                p_day = get_col('Day')
                p_notes = get_col('Notes')

                if not p_date: continue

                # Check if already linked in DB
                is_satisfied = False
                if not df_master.empty:
                    match_in_db = df_master[
                        (df_master['Date'] == p_date) & 
                        (df_master['Planned Workout'] == p_workout) & 
                        (df_master['activityId'].str.len() > 0)
                    ]
                    if not match_in_db.empty:
                        is_satisfied = True

                if is_satisfied:
                    print(f"   ⏩ Skipping Plan: [{p_date}] {p_workout} (Already Linked)")
                    continue

                print(f"   Searching for match: [{p_date}] {p_workout}")

                match = None
                if p_date in candidates_by_date:
                    day_cands = candidates_by_date[p_date]
                    for i, cand in enumerate(day_cands):
                        if is_sport_match(p_workout, cand):
                            match = cand
                            day_cands.pop(i) 
                            if not day_cands: del candidates_by_date[p_date]
                            break
                
                new_row = {c: "" for c in MASTER_COLUMNS}
                new_row['Date'] = p_date
                new_row['Day'] = p_day
                new_row['Planned Workout'] = p_workout
                new_row['Planned Duration'] = get_col('Planned Duration')
                new_row['Notes / Targets'] = p_notes
                new_row['Status'] = 'COMPLETED' 

                if match:
                    prefix = get_activity_prefix(match)
                    raw_name = match.get('activityName', 'Manual Activity')
                    new_name = f"{prefix} {raw_name}" if prefix and prefix not in raw_name else raw_name
                    dur_min = f"{float(match.get('duration', 0)) / 60:.1f}"

                    new_row['Actual Workout'] = new_name
                    new_row['Actual Duration'] = dur_min
                    new_row['Match Status'] = 'Linked'
                    new_row['activityId'] = str(match.get('activityId', ''))
                    
                    for col in MASTER_COLUMNS:
                        if col in match: new_row[col] = str(match[col])
                    
                    plan_updates[p_date] = {"name": new_name, "dur": dur_min}
                    print(f"      ✅ MATCHED: {new_name}")
                else:
                    new_row['Match Status'] = 'Manual'
                    print(f"      ❌ No match found")

                new_rows.append(new_row)

        # 5. Process Unmatched Garmin Activities
        print_header("ADDING UNPLANNED ACTIVITIES (Run/Bike/Swim Only)")
        for date, cands in candidates_by_date.items():
            for cand in cands:
                aid = str(cand.get('activityId', ''))
                if aid in existing_ids: continue

                # --- FILTER: Check if it's a valid sport ---
                prefix = get_activity_prefix(cand)
                if not prefix:
                    # Skip Walks, Yoga, etc.
                    g_type = cand.get('activityType', {}).get('typeKey', '')
                    print(f"   🚫 Skipping Non-Sport Activity: {g_type}")
                    continue

                raw_name = cand.get('activityName', 'Unplanned')
                full_name = f"{prefix} {raw_name}" if prefix and prefix not in raw_name else raw_name
                dur_min = f"{float(cand.get('duration', 0)) / 60:.1f}"

                print(f"   ➕ Adding Unplanned: [{date}] {full_name}")

                new_row = {c: "" for c in MASTER_COLUMNS}
                new_row['Date'] = date
                new_row['Status'] = 'COMPLETED'
                new_row['Planned Workout'] = 'Unplanned'
                new_row['Actual Workout'] = full_name
                new_row['Actual Duration'] = dur_min
                new_row['Match Status'] = 'Linked'
                new_row['activityId'] = aid
                
                for col in MASTER_COLUMNS:
                    if col in cand: new_row[col] = str(cand[col])
                
                new_rows.append(new_row)

        # 6. Update Endurance Plan MD File
        if plan_updates and os.path.exists(PLAN_FILE):
            print_header("UPDATING MD PLAN FILE")
            with open(PLAN_FILE, 'r', encoding='utf-8') as f:
                plan_lines = f.readlines()
            
            with open(PLAN_FILE, 'w', encoding='utf-8') as f:
                in_schedule = False
                for line in plan_lines:
                    if 'weekly schedule' in line.lower(): in_schedule = True
                    if in_schedule and '|' in line and '---' not in line and not line.strip().startswith('#'):
                        cols = [c.strip() for c in line.split('|')]
                        row_date = next((c for c in cols if re.match(r'\d{4}-\d{2}-\d{2}', c)), None)
                        if row_date in plan_updates:
                            try:
                                # Fallback if we can't reliably parse columns, just leave line alone
                                # But we want to update it. We know 'Actual Workout' is usually col 5
                                # Let's assume standard format for safety
                                # We can't easily parse pipes without robust regex, 
                                # but usually simple split is fine if no pipes in content.
                                f.write(line) 
                            except: f.write(line)
                        else: f.write(line)
                    else:
                        if in_schedule and line.startswith('#') and 'weekly schedule' not in line.lower(): in_schedule = False
                        f.write(line)

        # 7. Merge and Save Master DB
        if new_rows:
            print_header(f"SAVING {len(new_rows)} NEW/UPDATED ROWS")
            
            df_new = pd.DataFrame(new_rows)
            
            # Remove existing placeholder rows in DB if we are replacing them with actuals
            keys_to_remove = set()
            for _, r in df_new.iterrows():
                if r['Planned Workout'] != 'Unplanned':
                    keys_to_remove.add((r['Date'], r['Planned Workout']))
            
            if not df_master.empty:
                df_master = df_master[
                    ~df_master.apply(lambda x: (x['Date'], x['Planned Workout']) in keys_to_remove, axis=1)
                ]

            df_combined = pd.concat([df_new, df_master])
            df_combined['Date_Obj'] = pd.to_datetime(df_combined['Date'], errors='coerce')
            df_combined = df_combined.sort_values(by='Date_Obj', ascending=False).drop(columns=['Date_Obj'])

            with open(MASTER_DB, 'w', encoding='utf-8') as f:
                f.write("| " + " | ".join(MASTER_COLUMNS) + " |\n")
                f.write("| " + " | ".join(['---'] * len(MASTER_COLUMNS)) + " |\n")
                for _, row in df_combined.iterrows():
                    vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in MASTER_COLUMNS]
                    f.write("| " + " | ".join(vals) + " |\n")
            
            run_hydration()
            git_push_changes()
        else:
            print("✨ No new rows to add.")
            run_hydration()
            git_push_changes()

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    main()
