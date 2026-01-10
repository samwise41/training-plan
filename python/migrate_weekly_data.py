import pandas as pd
import numpy as np
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
    if not os.path.exists(GARMIN_FETCH_CMD[1]):
        print(f"⚠️ Warning: Fetch script not found at {GARMIN_FETCH_CMD[1]}")
        return
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

def calculate_tss(row):
    """
    Calculates TSS only if:
    1. It is missing (empty or 0)
    2. Activity Type is Run or Bike
    """
    # 1. Check if TSS already exists
    existing = str(row.get('trainingStressScore', '')).strip()
    if existing and existing != 'nan':
        try:
            if float(existing) > 0: return existing
        except: pass

    # 2. Check Activity Type (Only calc for Run/Bike)
    # We check both 'Planned Workout' and 'activityType' (from Garmin) to be safe
    act_type = str(row.get('activityType', '')).lower()
    plan_type = str(row.get('Planned Workout', '')).lower()
    
    is_run_bike = ('run' in act_type or 'run' in plan_type or 
                   'cycl' in act_type or 'bik' in act_type or 'virtual_ride' in act_type)
    
    if not is_run_bike:
        return ""

    # 3. Calculate
    try:
        duration = float(row.get('duration', 0))
        np_val = float(row.get('normPower', 0))
        ftp = 265.0 # Default FTP
        
        if duration > 0 and np_val > 0:
            intensity = np_val / ftp
            tss = (duration * np_val * intensity) / (ftp * 3600) * 100
            return f"{tss:.1f}"
    except:
        return ""
    return ""

def main():
    try:
        print_header("STARTING MIGRATION")
        run_garmin_fetch()

        # 1. Load Data
        df_master = load_master_db()
        df_plan = extract_weekly_table()
        
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)
        
        garmin_by_date = {}
        for g in garmin_data:
            d = g.get('startTimeLocal', '')[:10]
            if d not in garmin_by_date: garmin_by_date[d] = []
            garmin_by_date[d].append(g)

        # 2. Sync Plan -> Master (Append missing planned rows)
        if not df_plan.empty:
            print("Syncing Plan Rows...")
            for _, p_row in df_plan.iterrows():
                p_date = p_row.get('Date', '').strip()
                p_workout = p_row.get('Planned Workout', '').strip()
                
                # Check for duplicate
                match = df_master[(df_master['Date'] == p_date) & 
                                  (df_master['Planned Workout'] == p_workout)]
                
                if match.empty:
                    new_row = {c: "" for c in MASTER_COLUMNS}
                    new_row.update({
                        'Date': p_date,
                        'Day': p_row.get('Day', ''),
                        'Planned Workout': p_workout,
                        'Planned Duration': p_row.get('Planned Duration', ''),
                        'Notes / Targets': p_row.get('Notes', ''),
                        'Status': 'Pending'
                    })
                    df_master = pd.concat([df_master, pd.DataFrame([new_row])], ignore_index=True)

        # 3. LINKING (Iterative)
        claimed_ids = set() 
        print("Linking Garmin Data...")
        
        for idx, row in df_master.iterrows():
            date = str(row.get('Date', '')).strip()
            if len(date) < 10: continue

            current_id = str(row.get('activityId', '')).strip()
            if current_id and current_id != 'nan':
                claimed_ids.add(current_id)
                continue

            candidates = garmin_by_date.get(date, [])
            if not candidates: continue

            planned_type = str(row.get('Planned Workout', '')).lower()
            best_match = None
            
            # Type Match
            for cand in candidates:
                cand_id = str(cand.get('activityId'))
                if cand_id in claimed_ids: continue

                g_type = cand.get('activityType', {}).get('typeKey', '').lower()
                is_run = 'run' in planned_type and 'running' in g_type
                is_bike = 'bike' in planned_type and ('cycling' in g_type or 'biking' in g_type)
                is_swim = 'swim' in planned_type and 'swimming' in g_type
                
                if is_run or is_bike or is_swim:
                    best_match = cand
                    break
            
            # Fallback (Single activity matches anything)
            if not best_match and len(candidates) == 1:
                cand = candidates[0]
                if str(cand.get('activityId')) not in claimed_ids:
                    best_match = cand

            if best_match:
                m_id = str(best_match.get('activityId'))
                claimed_ids.add(m_id)
                
                df_master.at[idx, 'Status'] = 'COMPLETED'
                df_master.at[idx, 'Match Status'] = 'Linked'
                df_master.at[idx, 'activityId'] = m_id
                df_master.at[idx, 'Actual Workout'] = best_match.get('activityName', '')
                df_master.at[idx, 'activityType'] = best_match.get('activityType', {}).get('typeKey', '')
                
                try:
                    dur_sec = float(best_match.get('duration', 0))
                    df_master.at[idx, 'Actual Duration'] = f"{dur_sec/60:.1f}"
                except: pass

                # Map Telemetry
                # We map specifically to ensure we populate columns for TSS calc
                df_master.at[idx, 'duration'] = best_match.get('duration', '')
                df_master.at[idx, 'normPower'] = best_match.get('normPower', '')
                df_master.at[idx, 'trainingStressScore'] = best_match.get('trainingStressScore', '') # Try Garmin TSS first
                
                # Other fields
                df_master.at[idx, 'distance'] = best_match.get('distance', '')
                df_master.at[idx, 'averageHR'] = best_match.get('averageHeartRate', '')
                df_master.at[idx, 'maxHR'] = best_match.get('maxHeartRate', '')
                df_master.at[idx, 'calories'] = best_match.get('calories', '')
                df_master.at[idx, 'elevationGain'] = best_match.get('totalAscent', '')
                df_master.at[idx, 'avgPower'] = best_match.get('avgPower', '')

        # 4. UNPLANNED APPEND
        print("Handling Unplanned Workouts...")
        unplanned_rows = []
        all_garmin = [item for sublist in garmin_by_date.values() for item in sublist]
        
        for g in all_garmin:
            g_id = str(g.get('activityId'))
            if g_id not in claimed_ids:
                new_row = {c: "" for c in MASTER_COLUMNS}
                new_row['Planned Workout'] = 'Unplanned'
                new_row['Status'] = 'COMPLETED'
                new_row['Match Status'] = 'Unplanned'
                new_row['Date'] = g.get('startTimeLocal', '')[:10]
                new_row['activityId'] = g_id
                new_row['Actual Workout'] = g.get('activityName', 'Unplanned')
                new_row['activityType'] = g.get('activityType', {}).get('typeKey', '')
                
                # Telemetry
                new_row['duration'] = g.get('duration', '')
                new_row['normPower'] = g.get('normPower', '')
                new_row['trainingStressScore'] = g.get('trainingStressScore', '')
                
                new_row['distance'] = g.get('distance', '')
                new_row['averageHR'] = g.get('averageHeartRate', '')
                new_row['maxHR'] = g.get('maxHeartRate', '')
                new_row['calories'] = g.get('calories', '')
                new_row['elevationGain'] = g.get('totalAscent', '')
                new_row['avgPower'] = g.get('avgPower', '')
                
                try:
                    new_row['Actual Duration'] = f"{float(g.get('duration', 0))/60:.1f}"
                except: pass

                unplanned_rows.append(new_row)

        if unplanned_rows:
            print(f"Adding {len(unplanned_rows)} unplanned rows.")
            df_master = pd.concat([df_master, pd.DataFrame(unplanned_rows)], ignore_index=True)

        # 5. HYDRATE (Selective TSS)
        print("Hydrating calculated fields (Run/Bike Only)...")
        df_master['trainingStressScore'] = df_master.apply(calculate_tss, axis=1)

        # 6. SAVE (Sorted Newest to Oldest)
        # Create temp sort column
        df_master['Date_Sort'] = pd.to_datetime(df_master['Date'], errors='coerce')
        # Sort DESCENDING (Newest first)
        df_master = df_master.sort_values(by='Date_Sort', ascending=False).drop(columns=['Date_Sort'])
        
        print("Saving Master DB...")
        with open(MASTER_DB, 'w', encoding='utf-8') as f:
            f.write("| " + " | ".join(MASTER_COLUMNS) + " |\n")
            f.write("| " + " | ".join(['---'] * len(MASTER_COLUMNS)) + " |\n")
            for _, row in df_master.iterrows():
                vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in MASTER_COLUMNS]
                f.write("| " + " | ".join(vals) + " |\n")

        print("✅ Success: Migration Complete.")
        git_push_changes()

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    main()
