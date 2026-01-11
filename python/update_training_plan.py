import pandas as pd
import numpy as np
import json
import os
import subprocess
import traceback
import re
import ast
import sys # <--- Added to ensure correct Python interpreter usage
from datetime import datetime

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

PLAN_FILE = os.path.join(ROOT_DIR, 'endurance_plan.md')
MASTER_DB = os.path.join(ROOT_DIR, 'MASTER_TRAINING_DATABASE.md')
BRIEF_FILE = os.path.join(ROOT_DIR, 'coaching_brief.md') 
GARMIN_JSON = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')
GARMIN_FETCH_CMD = [sys.executable, os.path.join(SCRIPT_DIR, "fetch_garmin.py")] # Use sys.executable
TRENDS_SCRIPT = os.path.join(SCRIPT_DIR, "analyze_trends.py") 

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
    # Fix: Use the full path from the command list we built
    fetch_script_path = GARMIN_FETCH_CMD[1]
    if not os.path.exists(fetch_script_path):
        print(f"⚠️ Warning: Fetch script not found at {fetch_script_path}")
        return
    try:
        env = os.environ.copy()
        # Use sys.executable to ensure we use the same python environment
        subprocess.run(GARMIN_FETCH_CMD, check=True, env=env, cwd=SCRIPT_DIR)
        print("✅ Garmin Data Synced.")
    except Exception as e:
        print(f"⚠️ Warning: Fetch failed: {e}")

def run_trend_analysis():
    """Executes the external trend analysis script and PRINTS output for debugging."""
    print_header("RUNNING TREND ANALYSIS")
    
    if not os.path.exists(TRENDS_SCRIPT):
        print(f"⚠️ Warning: Trend script not found at {TRENDS_SCRIPT}")
        return

    try:
        print(f"   Executing: {TRENDS_SCRIPT}")
        # Capture output so we can see if it crashes
        result = subprocess.run(
            [sys.executable, TRENDS_SCRIPT], 
            cwd=SCRIPT_DIR, 
            capture_output=True, 
            text=True
        )
        
        # Print the output from the sub-script
        if result.stdout:
            print("   --- Script Output ---")
            print(result.stdout)
        
        if result.stderr:
            print("   --- Script Errors ---")
            print(result.stderr)

        if result.returncode == 0:
            print("✅ Coaching Brief Update Script Finished Successfully.")
        else:
            print("❌ Coaching Brief Update Failed (Non-zero exit code).")

    except Exception as e:
        print(f"⚠️ Warning: Execution failed: {e}")

def git_push_changes():
    print("🐙 Pushing changes to GitHub...")
    try:
        subprocess.run(["git", "config", "user.name", "github-actions"], check=True)
        subprocess.run(["git", "config", "user.email", "github-actions@github.com"], check=True)
        
        # Explicitly add all files including the brief
        files_to_add = [MASTER_DB, PLAN_FILE, GARMIN_JSON]
        if os.path.exists(BRIEF_FILE):
            files_to_add.append(BRIEF_FILE)
            
        print(f"   Adding files: {files_to_add}")
        subprocess.run(["git", "add"] + files_to_add, check=True)
        
        status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True).stdout
        if status:
            print("   Changes detected. Committing...")
            msg = f"Auto-Sync: Master DB, Plan & Brief {datetime.now().strftime('%Y-%m-%d')}"
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

def clean_corrupt_data(df):
    """Fixes dictionary strings in activityType only. Does NOT delete rows."""
    if 'activityType' in df.columns:
        def fix_type(val):
            val = str(val).strip()
            if val.startswith("{") and "typeKey" in val:
                try:
                    d = ast.literal_eval(val)
                    return d.get('typeKey', '')
                except:
                    match = re.search(r"'typeKey':\s*'([^']+)'", val)
                    return match.group(1) if match else val
            return val
        print("🧹 Cleaning corrupt activityType columns...")
        df['activityType'] = df['activityType'].apply(fix_type)
    return df

def extract_weekly_table():
    if not os.path.exists(PLAN_FILE): 
        print("⚠️ Plan file not found.")
        return pd.DataFrame()
        
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

    if not found_header or not table_lines: 
        print("⚠️ No 'Weekly Schedule' table found in Plan.")
        return pd.DataFrame()

    # Parse Header aggressively
    raw_header = [h.strip() for h in table_lines[0].strip('|').split('|')]
    
    col_map = {}
    for i, h in enumerate(raw_header):
        clean_h = h.lower().replace(' ', '')
        if 'date' in clean_h: col_map['Date'] = i
        elif 'day' in clean_h: col_map['Day'] = i
        elif 'plannedworkout' in clean_h: col_map['Planned Workout'] = i
        elif 'plannedduration' in clean_h or 'dur(min)' in clean_h: col_map['Planned Duration'] = i
        elif 'notes' in clean_h: col_map['Notes'] = i

    data = []
    for line in table_lines[1:]:
        if '---' in line: continue
        row_vals = [c.strip() for c in line.strip('|').split('|')]
        
        row_dict = {}
        for col_name, idx in col_map.items():
            if idx < len(row_vals):
                row_dict[col_name] = row_vals[idx]
            else:
                row_dict[col_name] = ""
        data.append(row_dict)
    
    df = pd.DataFrame(data)
    print(f"✅ Extracted {len(df)} rows from Weekly Plan.")
    
    if 'Date' not in df.columns:
        print("❌ CRITICAL ERROR: Could not find 'Date' column in Markdown table.")
        print(f"Headers found: {raw_header}")
        return pd.DataFrame() 

    return df

def update_weekly_plan(df_master):
    """Updates Status, Actual Workout, and Duration in the weekly plan file using Date+Sport matching."""
    if not os.path.exists(PLAN_FILE): return

    print_header("UPDATING WEEKLY PLAN VISUALS")

    # 1. Create Lookup from Master DB
    # Key: (Date, SportTag) -> Value: (Actual Workout, Actual Duration, Status)
    lookup = {}
    
    df_master['Date_Norm'] = pd.to_datetime(df_master['Date'], errors='coerce').dt.strftime('%Y-%m-%d')
    
    for _, row in df_master.iterrows():
        d = row.get('Date_Norm')
        p_work = str(row.get('Planned Workout', '')).upper()
        
        # Identify Sport Tag for matching
        sport_tag = None
        if '[RUN]' in p_work: sport_tag = 'RUN'
        elif '[BIKE]' in p_work: sport_tag = 'BIKE'
        elif '[SWIM]' in p_work: sport_tag = 'SWIM'
        
        a_work = str(row.get('Actual Workout', '')).strip()
        a_dur = str(row.get('Actual Duration', '')).strip()
        
        # Only store if we have a matched/completed row
        if d and sport_tag and (a_work or a_dur):
            # Clean 'nan' for display
            if a_work.lower() == 'nan': a_work = ""
            if a_dur.lower() == 'nan': a_dur = ""
            
            lookup[(d, sport_tag)] = (a_work, a_dur, "COMPLETED")

    # 2. Read and Modify the Plan File
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    table_started = False
    header_indices = {}
    
    for line in lines:
        stripped = line.strip()
        
        # Detect Table Start & Parse Headers
        if not table_started:
            if stripped.startswith('|') and 'date' in stripped.lower() and 'day' in stripped.lower():
                table_started = True
                headers = [h.strip().lower() for h in stripped.strip('|').split('|')]
                
                # Map headers to indices
                for i, h in enumerate(headers):
                    if 'date' in h: header_indices['date'] = i
                    elif 'planned workout' in h: header_indices['planned_workout'] = i
                    elif 'actual workout' in h: header_indices['actual_workout'] = i
                    elif 'actual duration' in h: header_indices['actual_duration'] = i
                    elif 'status' in h: header_indices['status'] = i
            
            new_lines.append(line)
            continue
        
        # Process Table Rows
        if table_started and stripped.startswith('|') and '---' not in stripped:
            cols = [c.strip() for c in stripped.strip('|').split('|')]
            
            try:
                # Extract Key info from this row
                if 'date' in header_indices and 'planned_workout' in header_indices:
                    row_date_raw = cols[header_indices['date']]
                    row_plan_raw = cols[header_indices['planned_workout']].upper()
                    
                    row_date = pd.to_datetime(row_date_raw, errors='coerce').strftime('%Y-%m-%d')
                    
                    # Identify Tag in this row
                    row_tag = None
                    if '[RUN]' in row_plan_raw: row_tag = 'RUN'
                    elif '[BIKE]' in row_plan_raw: row_tag = 'BIKE'
                    elif '[SWIM]' in row_plan_raw: row_tag = 'SWIM'
                    
                    key = (row_date, row_tag)
                    
                    if key in lookup:
                        act_work, act_dur, status_update = lookup[key]
                        
                        if 'actual_workout' in header_indices:
                            cols[header_indices['actual_workout']] = act_work
                        if 'actual_duration' in header_indices:
                            cols[header_indices['actual_duration']] = act_dur
                        if 'status' in header_indices:
                            cols[header_indices['status']] = status_update
                        
                        new_line = "| " + " | ".join(cols) + " |\n"
                        new_lines.append(new_line)
                    else:
                        new_lines.append(line)
                else:
                    new_lines.append(line)
            except:
                new_lines.append(line)
        else:
            new_lines.append(line)

    # 3. Write Back
    with open(PLAN_FILE, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("✅ Weekly plan updated with actuals and status.")

def main():
    try:
        print_header("STARTING MIGRATION (SYNC & FIX)")
        run_garmin_fetch()

        # 1. Load & Clean Data
        df_master = load_master_db()
        df_master = clean_corrupt_data(df_master) 
        
        df_plan = extract_weekly_table()
        if df_plan.empty:
            print("❌ Aborting Sync: No valid plan data found.")
        
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)
        
        garmin_by_date = {}
        for g in garmin_data:
            d = g.get('startTimeLocal', '')[:10]
            if d not in garmin_by_date: garmin_by_date[d] = []
            garmin_by_date[d].append(g)

        # 2. SYNC PLAN -> MASTER
        if not df_plan.empty:
            print_header("SYNCING WEEKLY PLAN TO MASTER")
            count_added = 0
            
            df_master['Date_Norm'] = pd.to_datetime(df_master['Date'], errors='coerce').dt.strftime('%Y-%m-%d')
            df_plan['Date_Norm'] = pd.to_datetime(df_plan['Date'], errors='coerce').dt.strftime('%Y-%m-%d')

            existing_keys = set(zip(df_master['Date_Norm'], df_master['Planned Workout'].str.strip()))

            for _, p_row in df_plan.iterrows():
                p_date_norm = p_row['Date_Norm']
                p_workout = str(p_row.get('Planned Workout', '')).strip()
                p_workout_clean = re.sub(r'[^a-zA-Z0-9\s]', '', p_workout.lower()) 
                
                if pd.isna(p_date_norm): continue 
                
                # --- FILTER: Strict Rest Day Skipping (Only for NEW rows) ---
                if 'rest day' in p_workout_clean or p_workout_clean in ['rest', 'off', 'day off']:
                    print(f"   [SKIP] Rest detected in Plan: {p_date_norm} - {p_workout}")
                    continue

                if (p_date_norm, p_workout) not in existing_keys:
                    print(f"[NEW PLAN ROW] Adding: {p_date_norm} - {p_workout}")
                    new_row = {c: "" for c in MASTER_COLUMNS}
                    new_row.update({
                        'Date': p_date_norm,
                        'Day': p_row.get('Day', ''),
                        'Planned Workout': p_workout,
                        'Planned Duration': p_row.get('Planned Duration', ''),
                        'Notes / Targets': p_row.get('Notes', ''),
                        'Status': 'Pending'
                    })
                    df_master = pd.concat([df_master, pd.DataFrame([new_row])], ignore_index=True)
                    existing_keys.add((p_date_norm, p_workout))
                    count_added += 1
            
            print(f"✅ Sync Complete. Added {count_added} new planned workouts.")
            if 'Date_Norm' in df_master.columns: df_master.drop(columns=['Date_Norm'], inplace=True)

        # 3. LINKING (Iterative)
        claimed_ids = set() 
        print_header("LINKING GARMIN DATA")
        
        for idx, row in df_master.iterrows():
            date = str(row.get('Date', '')).strip()
            try: date = pd.to_datetime(date).strftime('%Y-%m-%d')
            except: pass

            current_id = str(row.get('activityId', '')).strip()
            
            candidates = garmin_by_date.get(date, [])
            match = None

            # A. Already has ID? Re-fetch data
            if current_id and current_id != 'nan':
                 for cand in candidates:
                     if str(cand.get('activityId')) == current_id:
                         match = cand
                         break
            
            # B. No ID? Search for matching sport
            if not match and candidates and (not current_id or current_id == 'nan'):
                planned_txt = str(row.get('Planned Workout', '')).upper()
                
                for cand in candidates:
                    cand_id = str(cand.get('activityId'))
                    if cand_id in claimed_ids: continue

                    g_type = cand.get('activityType', {}).get('typeKey', '').lower()
                    
                    is_run = '[RUN]' in planned_txt and 'running' in g_type
                    is_bike = '[BIKE]' in planned_txt and ('cycling' in g_type or 'biking' in g_type or 'virtual' in g_type)
                    is_swim = '[SWIM]' in planned_txt and 'swimming' in g_type
                    
                    if is_run or is_bike or is_swim:
                        match = cand
                        break
                
                if not match and len(candidates) == 1:
                    cand = candidates[0]
                    if str(cand.get('activityId')) not in claimed_ids:
                        match = cand

            if match:
                m_id = str(match.get('activityId'))
                claimed_ids.add(m_id)
                
                df_master.at[idx, 'Status'] = 'COMPLETED'
                df_master.at[idx, 'Match Status'] = 'Linked'
                df_master.at[idx, 'activityId'] = m_id
                
                prefix = ""
                g_type = match.get('activityType', {}).get('typeKey', '').lower()
                if 'running' in g_type: prefix = "[RUN]"
                elif 'cycling' in g_type or 'virtual' in g_type: prefix = "[BIKE]"
                elif 'swimming' in g_type: prefix = "[SWIM]"
                
                raw_name = match.get('activityName', 'Activity')
                if prefix and prefix not in raw_name:
                    new_name = f"{prefix} {raw_name}"
                else:
                    new_name = raw_name
                
                df_master.at[idx, 'Actual Workout'] = new_name
                df_master.at[idx, 'activityType'] = g_type
                
                try:
                    dur_sec = float(match.get('duration', 0))
                    df_master.at[idx, 'Actual Duration'] = f"{dur_sec/60:.1f}"
                except: pass

                # Map Telemetry
                cols_to_map = [
                    'duration', 'distance', 'averageHR', 'maxHR', 
                    'aerobicTrainingEffect', 'anaerobicTrainingEffect', 'trainingEffectLabel',
                    'avgPower', 'maxPower', 'normPower', 'trainingStressScore', 'intensityFactor',
                    'averageSpeed', 'maxSpeed', 'vO2MaxValue', 'calories', 'elevationGain'
                ]
                
                for col in cols_to_map:
                    val = match.get(col, '')
                    if val is not None and val != "":
                         df_master.at[idx, col] = val

        # 4. UNPLANNED APPEND
        print("Handling Unplanned Workouts...")
        unplanned_rows = []
        all_garmin = [item for sublist in garmin_by_date.values() for item in sublist]
        
        for g in all_garmin:
            g_id = str(g.get('activityId'))
            if g_id not in claimed_ids:
                
                # Use empty string for planned cols to avoid 'nan'
                new_row = {c: "" for c in MASTER_COLUMNS}
                new_row['Planned Workout'] = "" 
                new_row['Planned Duration'] = ""
                new_row['Status'] = 'COMPLETED'
                new_row['Match Status'] = 'Unplanned'
                new_row['Date'] = g.get('startTimeLocal', '')[:10]
                new_row['activityId'] = g_id
                
                raw_name = g.get('activityName', 'Unplanned')
                new_row['Actual Workout'] = raw_name
                new_row['activityType'] = g.get('activityType', {}).get('typeKey', '')
                
                cols_to_map = [
                    'duration', 'distance', 'averageHR', 'maxHR', 
                    'aerobicTrainingEffect', 'anaerobicTrainingEffect', 'trainingEffectLabel',
                    'avgPower', 'maxPower', 'normPower', 'trainingStressScore', 'intensityFactor',
                    'averageSpeed', 'maxSpeed', 'vO2MaxValue', 'calories', 'elevationGain'
                ]
                for col in cols_to_map:
                     new_row[col] = g.get(col, '')

                try:
                    new_row['Actual Duration'] = f"{float(g.get('duration', 0))/60:.1f}"
                except: pass

                unplanned_rows.append(new_row)

        if unplanned_rows:
            print(f"Adding {len(unplanned_rows)} unplanned rows.")
            df_master = pd.concat([df_master, pd.DataFrame(unplanned_rows)], ignore_index=True)

        # 5. HYDRATE
        print("Hydrating calculated fields...")
        
        for idx, row in df_master.iterrows():
            act_type = str(row.get('activityType', '')).lower()
            plan_type = str(row.get('Planned Workout', '')).lower()
            
            # Scope: Only Run/Bike
            is_run_bike = ('run' in act_type or 'run' in plan_type or 
                           'cycl' in act_type or 'bik' in act_type or 'virtual_ride' in act_type)
            if not is_run_bike: continue

            try:
                duration = float(row.get('duration', 0))
                np_val = float(row.get('normPower', 0))
                ftp = 265.0 
            except: continue 

            if duration > 0 and np_val > 0:
                intensity = np_val / ftp
                
                existing_if = str(row.get('intensityFactor', '')).strip()
                if not existing_if or existing_if == 'nan' or float(existing_if) == 0:
                     df_master.at[idx, 'intensityFactor'] = f"{intensity:.2f}"

                existing_tss = str(row.get('trainingStressScore', '')).strip()
                if not existing_tss or existing_tss == 'nan' or float(existing_tss) == 0:
                    tss = (duration * np_val * intensity) / (ftp * 3600) * 100
                    df_master.at[idx, 'trainingStressScore'] = f"{tss:.1f}"

        # 6. SAVE
        df_master['Date_Sort'] = pd.to_datetime(df_master['Date'], errors='coerce')
        df_master = df_master.sort_values(by='Date_Sort', ascending=False).drop(columns=['Date_Sort'])
        
        print(f"Saving {len(df_master)} rows to Master DB...")
        with open(MASTER_DB, 'w', encoding='utf-8') as f:
            f.write("| " + " | ".join(MASTER_COLUMNS) + " |\n")
            f.write("| " + " | ".join(['---'] * len(MASTER_COLUMNS)) + " |\n")
            for _, row in df_master.iterrows():
                vals = []
                for c in MASTER_COLUMNS:
                    val = str(row.get(c, ""))
                    val = val.replace('\n', ' ').replace('\r', '').replace('|', '/')
                    vals.append(val)
                f.write("| " + " | ".join(vals) + " |\n")

        # 7. UPDATE WEEKLY PLAN
        update_weekly_plan(df_master)

        # 8. ANALYZE TRENDS
        run_trend_analysis()

        print("✅ Success: Migration Complete.")
        git_push_changes()

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    main()
