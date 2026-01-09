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
    try:
        env = os.environ.copy()
        subprocess.run(GARMIN_FETCH_CMD, check=True, env=env, cwd=SCRIPT_DIR)
        print("✅ Garmin Data Synced.")
    except Exception as e:
        print(f"⚠️ Warning: Fetch failed: {e}")

def git_push_changes():
    print("🐙 Pushing changes to GitHub...")
    try:
        subprocess.run(["git", "config", "user.name", "github-actions"], check=True)
        subprocess.run(["git", "config", "user.email", "github-actions@github.com"], check=True)
        subprocess.run(["git", "add", MASTER_DB, PLAN_FILE, GARMIN_JSON], check=True)
        status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True).stdout
        if status:
            msg = f"Auto-Sync: Data Update {datetime.now().strftime('%Y-%m-%d')}"
            subprocess.run(["git", "commit", "-m", msg], check=True)
            subprocess.run(["git", "push"], check=True)
            print("✅ Successfully pushed to GitHub!")
        else:
            print("ℹ️ No changes detected.")
    except Exception as e:
        print(f"⚠️ Git Push Failed: {e}")

def load_master_db():
    if not os.path.exists(MASTER_DB): return pd.DataFrame(columns=MASTER_COLUMNS)
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
    if not os.path.exists(PLAN_FILE): 
        print(f"❌ ERROR: {PLAN_FILE} not found.")
        return pd.DataFrame()
    
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    table_lines, found_header = [], False
    for line in lines:
        s = line.strip()
        if not found_header:
            if s.startswith('#') and 'weekly schedule' in s.lower(): 
                found_header = True
                print(f"📊 Found 'Weekly Schedule' section.")
            continue
        if (s.startswith('# ') or s.startswith('## ')) and len(table_lines) > 2: break
        if '|' in s: table_lines.append(s)
    
    if not found_header:
        print("❌ ERROR: Could not find 'Weekly Schedule' header in endurance_plan.md")
        return pd.DataFrame()
    
    if not table_lines:
        print("❌ ERROR: Found header, but no table rows detected.")
        return pd.DataFrame()

    print(f"✅ Extracted {len(table_lines) - 2} potential rows from the table.")
    header = [h.strip() for h in table_lines[0].strip('|').split('|')]
    data = []
    for line in table_lines[1:]:
        if '---' in line: continue
        row = [c.strip() for c in line.strip('|').split('|')]
        if len(row) < len(header): row += [''] * (len(header) - row)
        data.append(dict(zip(header, row)))
    return pd.DataFrame(data)

def main():
    try:
        print_header("STARTING CONSOLIDATED SYNC")
        run_garmin_fetch()

        if not os.path.exists(PLAN_FILE): return
        with open(PLAN_FILE, 'r', encoding='utf-8') as f:
            plan_lines = f.readlines()
        
        df_plan = extract_weekly_table()
        if df_plan.empty: 
            print("🛑 Extraction failed. Check endurance_plan.md formatting.")
            return

        df_master = load_master_db()
        
        if not os.path.exists(GARMIN_JSON):
            print(f"❌ ERROR: {GARMIN_JSON} missing.")
            return
            
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        # Build Garmin Date Index
        garmin_by_date = {}
        for entry in json_data:
            d = entry.get('startTimeLocal', '')[:10]
            if d:
                if d not in garmin_by_date: garmin_by_date[d] = []
                garmin_by_date[d].append(entry)

        print_header("PROCESSING ROWS")
        new_rows = []
        plan_updates = {}

        for _, row in df_plan.iterrows():
            # Debug each row extraction
            date_val = str(row.get('Date', '')).strip()
            plan_workout = str(row.get('Planned Workout', '')).lower()
            
            if not date_val or date_val.lower() == 'nan':
                continue

            print(f"🔍 Checking Plan: {date_val} | Workout: {plan_workout}")

            if date_val in garmin_by_date:
                candidates = garmin_by_date[date_val]
                print(f"   📅 Found {len(candidates)} Garmin activities on this date.")
                match = None
                
                for act in candidates:
                    prefix = get_activity_prefix(act)
                    # Use specific matching logic for RUN/BIKE/SWIM
                    if (('run' in plan_workout and prefix == "[RUN]") or 
                        ('bike' in plan_workout and prefix == "[BIKE]") or 
                        ('swim' in plan_workout and prefix == "[SWIM]")):
                        match = act
                        print(f"   🎯 Match found by sport type: {prefix}")
                        break
                
                if not match:
                    match = candidates[0]
                    print(f"   ⚠️ No sport match, using first activity found.")

                prefix = get_activity_prefix(match)
                raw_name = match.get('activityName', 'Manual Activity')
                new_name = f"{prefix} {raw_name}" if prefix and prefix not in raw_name else raw_name
                new_dur = f"{float(match.get('duration', 0)) / 60:.1f}"
                
                print(f"   ✅ SUCCESS: Mapping {new_name} ({new_dur}m)")
                plan_updates[date_val] = {"name": new_name, "dur": new_dur}

                new_row = {c: "" for c in MASTER_COLUMNS}
                new_row.update({'Status': 'COMPLETED', 'Date': date_val, 'Actual Workout': new_name, 'Actual Duration': new_dur})
                for col in MASTER_COLUMNS:
                    if col in match: new_row[col] = str(match[col])
                new_rows.append(new_row)
            else:
                print(f"   ❌ No Garmin data found for date {date_val}")

        # --- UPDATE PLAN FILE ---
        if plan_updates:
            print_header("WRITING UPDATES TO PLAN FILE")
            header_cols = [h.strip().lower() for h in df_plan.columns]
            act_workout_idx = next(i for i, h in enumerate(header_cols) if 'actual workout' in h) + 1
            act_dur_idx = next(i for i, h in enumerate(header_cols) if 'actual duration' in h) + 1

            with open(PLAN_FILE, 'w', encoding='utf-8') as f:
                in_schedule = False
                for line in plan_lines:
                    if 'weekly schedule' in line.lower(): in_schedule = True
                    if in_schedule and '|' in line and '---' not in line and not line.strip().startswith('#'):
                        cols = [c.strip() for c in line.split('|')]
                        # Date Regex Check
                        row_date = next((c for c in cols if re.match(r'\d{4}-\d{2}-\d{2}', c)), None)
                        if row_date in plan_updates:
                            cols[act_workout_idx] = plan_updates[row_date]['name']
                            cols[act_dur_idx] = plan_updates[row_date]['dur']
                            f.write("| " + " | ".join(cols[1:-1]) + " |\n")
                        else: f.write(line)
                    else:
                        if in_schedule and line.startswith('#') and 'weekly schedule' not in line.lower(): 
                            in_schedule = False
                        f.write(line)
        else:
            print("ℹ️ No plan updates to write.")

        # --- UPDATE MASTER DB ---
        if new_rows:
            print_header("WRITING UPDATES TO MASTER DB")
            df_combined = pd.concat([pd.DataFrame(new_rows), df_master]).drop_duplicates(subset=['Date', 'Actual Workout'], keep='first')
            with open(MASTER_DB, 'w', encoding='utf-8') as f:
                f.write("| " + " | ".join(MASTER_COLUMNS) + " |\n")
                f.write("| " + " | ".join(['---'] * len(MASTER_COLUMNS)) + " |\n")
                for _, row in df_combined.iterrows():
                    vals = [str(row.get(c, "")).replace('|', '/') for c in MASTER_COLUMNS]
                    f.write("| " + " | ".join(vals) + " |\n")
        else:
            print("ℹ️ No master database updates to write.")

        git_push_changes()
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    main()
