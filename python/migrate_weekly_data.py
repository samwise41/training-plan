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

# Columns
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

def get_activity_prefix(activity):
    g_type = activity.get('activityType', {}).get('typeKey', '').lower()
    if 'running' in g_type: return "[RUN]"
    if 'road_biking' in g_type or 'virtual_ride' in g_type: return "[BIKE]"
    if 'swimming' in g_type: return "[SWIM]"
    return ""

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

def main():
    try:
        print_header("STARTING MIGRATION & PLAN UPDATE")
        run_garmin_fetch()

        if not os.path.exists(PLAN_FILE): return
        with open(PLAN_FILE, 'r', encoding='utf-8') as f:
            plan_lines = f.readlines()

        df_plan = extract_weekly_table() # Can be empty if no schedule found, that's ok.
        df_master = load_master_db()
        
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            json_data = json.load(f)

        # Helper: Map Date -> List of Activities
        garmin_by_date = {}
        for entry in json_data:
            d = entry.get('startTimeLocal', '')[:10]
            if d:
                if d not in garmin_by_date: garmin_by_date[d] = []
                garmin_by_date[d].append(entry)

        print_header("PROCESSING PLANNED ROWS")
        new_rows = []
        plan_updates = {}
        matched_activity_ids = set()

        # 1. MATCH PLANNED ACTIVITIES
        if not df_plan.empty:
            for idx, row in df_plan.iterrows():
                def get_col(name):
                    if name in row: return str(row[name])
                    for col in row.keys():
                        if name.lower() in col.lower(): return str(row[col])
                    return ""

                date_str = get_col('Date').strip()
                plan_workout = get_col('Planned Workout')
                plan_notes = get_col('Notes')

                print(f"Row {idx+1}: [{date_str}] {plan_workout}")

                # Find Garmin Match
                match = None
                if date_str in garmin_by_date:
                    candidates = garmin_by_date[date_str]
                    p_type = plan_workout.lower()
                    for act in candidates:
                        # Prevent double matching the same activity to multiple plan rows
                        if str(act.get('activityId')) in matched_activity_ids: continue 
                        
                        g_type = act.get('activityType', {}).get('typeKey', '').lower()
                        # Basic type matching
                        if (('run' in p_type and 'running' in g_type) or 
                            ('bike' in p_type and ('biking' in g_type or 'virtual' in g_type)) or 
                            ('swim' in p_type and 'swimming' in g_type)):
                            match = act
                            break
                    # Fallback: if only 1 activity that day and unassigned, take it
                    if not match:
                        avail = [c for c in candidates if str(c.get('activityId')) not in matched_activity_ids]
                        if len(avail) == 1: match = avail[0]

                if match:
                    aid = str(match.get('activityId', ''))
                    matched_activity_ids.add(aid)
                    
                    prefix = get_activity_prefix(match)
                    raw_name = match.get('activityName', 'Manual Activity')
                    new_name = f"{prefix} {raw_name}" if prefix and prefix not in raw_name else raw_name
                    dur_min = f"{float(match.get('duration', 0)) / 60:.1f}"

                    plan_updates[date_str] = {"name": new_name, "dur": dur_min}

                    new_row = {c: "" for c in MASTER_COLUMNS}
                    new_row.update({
                        'Status': 'COMPLETED', 'Date': date_str, 'Day': get_col('Day'),
                        'Planned Workout': plan_workout, 'Planned Duration': get_col('Planned Duration'),
                        'Actual Workout': new_name, 'Actual Duration': dur_min,
                        'Notes / Targets': plan_notes,
                        'Match Status': 'Linked', 'activityId': aid
                    })
                    for col in MASTER_COLUMNS:
                        if col in match: new_row[col] = str(match[col])
                    new_rows.append(new_row)

        # 2. ADD UNMATCHED GARMIN ACTIVITIES (Extra/Unplanned Workouts)
        print_header("PROCESSING UNMATCHED / EXTRA ACTIVITIES")
        for entry in json_data:
            aid = str(entry.get('activityId', ''))
            if aid and aid not in matched_activity_ids:
                # Basic check to avoid adding extremely old data? 
                # For now, we rely on the DB de-duplication step to handle existing rows.
                
                date_str = entry.get('startTimeLocal', '')[:10]
                prefix = get_activity_prefix(entry)
                raw_name = entry.get('activityName', 'Unplanned Activity')
                full_name = f"{prefix} {raw_name}" if prefix and prefix not in raw_name else raw_name
                
                print(f"➕ Found Unplanned: [{date_str}] {full_name}")
                
                new_row = {c: "" for c in MASTER_COLUMNS}
                new_row.update({
                    'Status': 'COMPLETED',
                    'Date': date_str,
                    'Day': datetime.strptime(date_str, '%Y-%m-%d').strftime('%A') if date_str else '',
                    'Planned Workout': 'Unplanned', # Indicate it wasn't on schedule
                    'Planned Duration': '',
                    'Actual Workout': full_name,
                    'Actual Duration': f"{float(entry.get('duration', 0)) / 60:.1f}",
                    'Notes / Targets': '',
                    'Match Status': 'Linked', # It's linked because it came from Garmin
                    'activityId': aid
                })
                
                for col in MASTER_COLUMNS:
                    if col in entry: new_row[col] = str(entry[col])
                new_rows.append(new_row)

        # 3. UPDATE ENDURANCE_PLAN.MD
        if plan_updates:
            print_header("UPDATING WEEKLY PLAN")
            with open(PLAN_FILE, 'w', encoding='utf-8') as f:
                in_schedule = False
                for line in plan_lines:
                    if 'weekly schedule' in line.lower(): in_schedule = True
                    if in_schedule and '|' in line and '---' not in line and not line.strip().startswith('#'):
                        cols = [c.strip() for c in line.split('|')]
                        row_date = next((c for c in cols if re.match(r'\d{4}-\d{2}-\d{2}', c)), None)
                        if row_date in plan_updates:
                            update = plan_updates[row_date]
                            header_cols = [h.strip().lower() for h in df_plan.columns]
                            try:
                                act_workout_idx = next(i for i, h in enumerate(header_cols) if 'actual workout' in h) + 1
                                act_dur_idx = next(i for i, h in enumerate(header_cols) if 'actual duration' in h) + 1
                                cols[act_workout_idx] = update['name']
                                cols[act_dur_idx] = update['dur']
                                f.write("| " + " | ".join(cols[1:-1]) + " |\n")
                            except: f.write(line)
                        else: f.write(line)
                    else:
                        if in_schedule and line.startswith('#') and 'weekly schedule' not in line.lower(): in_schedule = False
                        f.write(line)

        # 4. SAVE MASTER DATABASE
        if new_rows:
            df_new = pd.DataFrame(new_rows)
            df_combined = pd.concat([df_new, df_master])
            
            # De-duplication: Prefer existing rows, but if activityId matches, ensure we don't have dupes.
            # Using activityId as primary key
            df_combined['temp_id'] = df_combined.apply(lambda x: x['activityId'] if x.get('activityId') else str(x['Date']) + str(x['Planned Workout']), axis=1)
            
            # Sort so newer (or non-empty) rows might take precedence if needed, 
            # but generally we want to keep the oldest 'record' or overwrite? 
            # For simplicity, drop duplicates on ID keeping the *first* encountered (which is the NEW data since we concat new first)
            # Wait, if we concat [new, master], keep='first' keeps the new one. This updates the row if it existed.
            df_combined = df_combined.drop_duplicates(subset=['temp_id'], keep='first').drop(columns=['temp_id'])
            
            df_combined['Date_Obj'] = pd.to_datetime(df_combined['Date'], errors='coerce')
            df_combined = df_combined.sort_values(by='Date_Obj', ascending=False).drop(columns=['Date_Obj'])

            print(f"💾 Saving {len(new_rows)} new/updated rows to Master DB...")
            with open(MASTER_DB, 'w', encoding='utf-8') as f:
                f.write("| " + " | ".join(MASTER_COLUMNS) + " |\n")
                f.write("| " + " | ".join(['---'] * len(MASTER_COLUMNS)) + " |\n")
                for _, row in df_combined.iterrows():
                    vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in MASTER_COLUMNS]
                    f.write("| " + " | ".join(vals) + " |\n")
            
            # 5. TRIGGER HYDRATION / TSS CALC
            # Now that the rows are saved (including unmatched ones), run the calc.
            run_hydration()
        else:
            print("ℹ️ No new rows to add.")
            # Run hydration anyway in case we need to fix TSS on existing rows
            run_hydration()
        
        # 6. FINAL PUSH
        git_push_changes()
        
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    main()
