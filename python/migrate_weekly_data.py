import pandas as pd
import json
import os
import subprocess
import traceback
import re
from datetime import datetime

# --- CONFIGURATION ---
# ROOT_DIR is the repo root. SCRIPT_DIR is the 'python/' folder.
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
        # Pass GitHub Secrets to the fetch script
        env = os.environ.copy()
        subprocess.run(GARMIN_FETCH_CMD, check=True, env=env, cwd=SCRIPT_DIR)
        print("✅ Garmin Data Synced.")
    except Exception as e:
        print(f"⚠️ Warning: Fetch failed: {e}")

def git_push_changes():
    print("🐙 Pushing changes to GitHub...")
    try:
        # 1. Set Identity to fix 'status 128' error
        subprocess.run(["git", "config", "user.name", "github-actions"], check=True)
        subprocess.run(["git", "config", "user.email", "github-actions@github.com"], check=True)
        
        # 2. Add all modified files
        subprocess.run(["git", "add", MASTER_DB, PLAN_FILE, GARMIN_JSON], check=True)
        
        # 3. Only commit if changes exist to avoid 'status 1' error
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
    """Maps activity type to dashboard tags."""
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
        row = [c.strip() for c in line.strip('|').split('|')]
        if len(row) < len(header): row += [''] * (len(header) - len(row))
        data.append(dict(zip(header, row)))
    return pd.DataFrame(data)

def main():
    try:
        print_header("STARTING CONSOLIDATED SYNC")
        run_garmin_fetch()

        with open(PLAN_FILE, 'r', encoding='utf-8') as f:
            plan_lines = f.readlines()
        df_plan = extract_weekly_table()
        if df_plan.empty: return

        df_master = load_master_db()
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        garmin_by_date = {}
        for entry in json_data:
            d = entry.get('startTimeLocal', '')[:10]
            if d:
                if d not in garmin_by_date: garmin_by_date[d] = []
                garmin_by_date[d].append(entry)

        new_rows = []
        plan_updates = {}

        for _, row in df_plan.iterrows():
            date_str = str(row.get('Date', '')).strip()
            if date_str in garmin_by_date:
                match = garmin_by_date[date_str][0] # Simple match for now
                prefix = get_activity_prefix(match)
                new_name = f"{prefix} {match.get('activityName')}"
                new_dur = f"{float(match.get('duration', 0)) / 60:.1f}"
                plan_updates[date_str] = {"name": new_name, "dur": new_dur}

                new_row = {c: "" for c in MASTER_COLUMNS}
                new_row.update({'Status': 'COMPLETED', 'Date': date_str, 'Actual Workout': new_name, 'Actual Duration': new_dur})
                for col in MASTER_COLUMNS:
                    if col in match: new_row[col] = str(match[col])
                new_rows.append(new_row)

        # --- UPDATE PLAN FILE ---
        header_cols = [h.strip().lower() for h in df_plan.columns]
        act_workout_idx = next(i for i, h in enumerate(header_cols) if 'actual workout' in h) + 1
        act_dur_idx = next(i for i, h in enumerate(header_cols) if 'actual duration' in h) + 1

        with open(PLAN_FILE, 'w', encoding='utf-8') as f:
            in_schedule = False
            for line in plan_lines:
                if 'weekly schedule' in line.lower(): in_schedule = True
                if in_schedule and '|' in line and '---' not in line and not line.strip().startswith('#'):
                    cols = [c.strip() for c in line.split('|')]
                    row_date = next((c for c in cols if re.match(r'\d{4}-\d{2}-\d{2}', c)), None)
                    if row_date in plan_updates:
                        cols[act_workout_idx] = plan_updates[row_date]['name']
                        cols[act_dur_idx] = plan_updates[row_date]['dur']
                        f.write("| " + " | ".join(cols[1:-1]) + " |\n")
                    else: f.write(line)
                else: f.write(line)

        # --- UPDATE MASTER DB ---
        if new_rows:
            df_combined = pd.concat([pd.DataFrame(new_rows), df_master]).drop_duplicates(subset=['Date', 'Actual Workout'], keep='first')
            with open(MASTER_DB, 'w', encoding='utf-8') as f:
                f.write("| " + " | ".join(MASTER_COLUMNS) + " |\n")
                f.write("| " + " | ".join(['---'] * len(MASTER_COLUMNS)) + " |\n")
                for _, row in df_combined.iterrows():
                    vals = [str(row.get(c, "")).replace('|', '/') for c in MASTER_COLUMNS]
                    f.write("| " + " | ".join(vals) + " |\n")

        git_push_changes()
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    main()
