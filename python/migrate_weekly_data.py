import pandas as pd
import json
import os
import subprocess
import traceback
from datetime import datetime

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLAN_FILE = os.path.join(SCRIPT_DIR, 'endurance_plan.md')
GARMIN_JSON = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')
MASTER_DB = os.path.join(SCRIPT_DIR, 'MASTER_TRAINING_DATABASE.md')
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

# Inside migrate_weekly_data.py
def git_pull_latest():
    print("⬇️  SYNCING FROM GITHUB...")
    try:
        subprocess.run(["git", "fetch", "--all"], check=True, shell=True, cwd=SCRIPT_DIR)
        # Ensure this says main
        subprocess.run(["git", "reset", "--hard", "origin/main"], check=True, shell=True, cwd=SCRIPT_DIR)
        print("✅ Success: Local files matched to GitHub main.")
    except Exception as e:
        print(f"❌ GIT ERROR: {e}")

def run_garmin_fetch():
    print(f"📡 Triggering Garmin Fetch...")
    if not os.path.exists(GARMIN_FETCH_CMD[1]):
        print(f"⚠️ Warning: Fetch script not found at {GARMIN_FETCH_CMD[1]}")
        return
    try:
        subprocess.run(GARMIN_FETCH_CMD, check=True, shell=True, cwd=SCRIPT_DIR)
        print("✅ Garmin Data Synced.")
    except Exception as e:
        print(f"⚠️ Warning: Fetch failed: {e}")

def git_push_changes():
    print("🐙 Pushing changes to GitHub...")
    try:
        subprocess.run(["git", "add", MASTER_DB], check=True, shell=True, cwd=SCRIPT_DIR)
        msg = f"Auto-Archive: Training Data {datetime.now().strftime('%Y-%m-%d')}"
        subprocess.run(["git", "commit", "-m", msg], check=True, shell=True, cwd=SCRIPT_DIR)
        subprocess.run(["git", "push"], check=True, shell=True, cwd=SCRIPT_DIR)
        print("✅ Successfully pushed to GitHub!")
    except Exception as e:
        print(f"⚠️ Git Push Failed: {e}")

def load_master_db():
    if not os.path.exists(MASTER_DB):
        print(f"ℹ️ Creating new Master DB at {MASTER_DB}")
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
    if not os.path.exists(PLAN_FILE):
        print(f"❌ CRITICAL ERROR: Plan file not found at: {PLAN_FILE}")
        return pd.DataFrame()

    print(f"🔍 Reading {os.path.basename(PLAN_FILE)}...")
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    table_lines = []
    found_header = False
    
    for line in lines:
        s = line.strip()
        # Header Search
        if not found_header:
            if s.startswith('#') and 'weekly schedule' in s.lower():
                found_header = True
                print(f"   ✅ Found Schedule Header: '{s}'")
            continue
        
        # Stop at next section
        if (s.startswith('# ') or s.startswith('## ')) and len(table_lines) > 2:
            break
            
        # Collect Rows
        if '|' in s:
            if s.count('|') > 1: # Basic validation
                table_lines.append(s)

    if not found_header:
        print("   ❌ Error: Could not find 'Weekly Schedule' header.")
        return pd.DataFrame()
    
    if not table_lines:
        print("   ❌ Error: Found header, but no table rows (lines with '|').")
        return pd.DataFrame()

    print(f"   ✅ Found {len(table_lines)} raw table lines.")

    # Parse Table
    header_line = table_lines[0]
    header = [h.strip() for h in header_line.strip('|').split('|')]
    print(f"   ℹ️ Detected Columns: {header}")

    data = []
    for line in table_lines[1:]:
        if '---' in line: continue
        row_vals = [c.strip() for c in line.strip('|').split('|')]
        if len(row_vals) < len(header): 
            row_vals += [''] * (len(header) - len(row_vals))
        data.append(dict(zip(header, row_vals)))

    return pd.DataFrame(data)

def main():
    try:
        print_header("STARTING WEEKLY MIGRATION")
        print(f"📂 Directory: {SCRIPT_DIR}")

        # 1. SYNC
        git_pull_latest()
        
        # 2. FETCH
        run_garmin_fetch()

        # 3. LOAD
        df_plan = extract_weekly_table()
        if df_plan.empty:
            print("❌ Stopping: No schedule data found.")
            return

        df_master = load_master_db()
        
        try:
            with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
        except FileNotFoundError:
            print(f"❌ Error: {GARMIN_JSON} not found.")
            return

        # Index Garmin
        garmin_by_date = {}
        for entry in json_data:
            d = entry.get('startTimeLocal', '')[:10]
            if d:
                if d not in garmin_by_date: garmin_by_date[d] = []
                garmin_by_date[d].append(entry)

        # 4. PROCESS
        print_header("PROCESSING ROWS")
        new_rows = []
        
        for idx, row in df_plan.iterrows():
            # Safe Getters
            def get_col(name):
                # Search case-insensitive if exact match fails
                if name in row: return str(row[name])
                for col in row.keys():
                    if name.lower() in col.lower(): return str(row[col])
                return ""

            status = get_col('Status').upper().strip()
            date_str = get_col('Date').strip()
            act_dur = get_col('Actual Duration').strip()
            workout = get_col('Planned Workout')

            print(f"Row {idx+1}: [{date_str}] {workout}")
            
            is_completed = 'COMPLETED' in status
            has_duration = (act_dur and act_dur != '0' and act_dur.lower() != 'nan' and act_dur != '')

            if is_completed or has_duration:
                print("   ✅ Marked COMPLETED. Linking data...")
                new_row = {c: "" for c in MASTER_COLUMNS}
                
                # Copy Plan Data (using fuzzy matching for columns)
                new_row['Status'] = 'COMPLETED'
                new_row['Date'] = date_str
                new_row['Day'] = get_col('Day')
                new_row['Planned Workout'] = get_col('Planned Workout')
                new_row['Planned Duration'] = get_col('Planned Duration')
                new_row['Actual Workout'] = get_col('Actual Workout')
                new_row['Actual Duration'] = act_dur
                new_row['Notes / Targets'] = get_col('Notes') # Might be Notes / Targets
                new_row['Match Status'] = 'Manual'

                # Garmin Match
                if date_str in garmin_by_date:
                    candidates = garmin_by_date[date_str]
                    plan_type = new_row['Planned Workout'].lower()
                    match = None
                    for act in candidates:
                        g_type = act.get('activityType', {}).get('typeKey', '').lower()
                        if ('run' in plan_type and 'running' in g_type) or \
                           ('bike' in plan_type and ('cycling' in g_type or 'virtual' in g_type)) or \
                           ('swim' in plan_type and 'swimming' in g_type):
                            match = act
                            break
                    if not match and len(candidates) == 1: match = candidates[0]

                    if match:
                        print(f"      🔗 Linked Garmin: {match.get('activityName')}")
                        new_row['Match Status'] = 'Linked'
                        new_row['activityId'] = str(match.get('activityId', ''))
                        new_row['Actual Workout'] = match.get('activityName', new_row['Actual Workout'])
                        for col in MASTER_COLUMNS:
                            if col in match: new_row[col] = str(match[col])
                        if 'duration' in match:
                            try:
                                dur = float(match['duration']) / 60
                                new_row['Actual Duration'] = f"{dur:.1f}"
                            except: pass
                    else:
                        print("      ⚠️ No matching Garmin file found.")
                else:
                    print(f"      ⚠️ No Garmin data for date {date_str}")
                new_rows.append(new_row)
            else:
                print(f"   ⏭️ Skipped (Status='{status}', Dur='{act_dur}')")

        if not new_rows:
            print("\n❌ No completed workouts found to migrate.")
            return

        # 5. SAVE
        print_header(f"SAVING {len(new_rows)} RECORDS")
        df_new = pd.DataFrame(new_rows)
        df_combined = pd.concat([df_new, df_master])
        
        # Deduplicate
        df_combined['temp_id'] = df_combined.apply(
            lambda x: x['activityId'] if x.get('activityId') else str(x['Date']) + str(x['Planned Workout']), axis=1
        )
        df_combined = df_combined.drop_duplicates(subset=['temp_id'], keep='first')
        df_combined.drop(columns=['temp_id'], inplace=True)

        # Sort
        df_combined['Date_Obj'] = pd.to_datetime(df_combined['Date'], errors='coerce')
        df_combined = df_combined.sort_values(by='Date_Obj', ascending=False)
        df_combined.drop(columns=['Date_Obj'], inplace=True)

        with open(MASTER_DB, 'w', encoding='utf-8') as f:
            f.write("| " + " | ".join(MASTER_COLUMNS) + " |\n")
            f.write("| " + " | ".join(['---'] * len(MASTER_COLUMNS)) + " |\n")
            for _, row in df_combined.iterrows():
                vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in MASTER_COLUMNS]
                f.write("| " + " | ".join(vals) + " |\n")

        print(f"✅ Master Database updated.")
        git_push_changes()
    
    except Exception:
        print("\n❌ FATAL ERROR ❌")
        traceback.print_exc()

if __name__ == "__main__":
    main()
    print("\n" + "="*30)
    input("Press Enter to exit...")