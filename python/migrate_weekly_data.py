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
        # Configure Git Identity for Actions
        subprocess.run(["git", "config", "user.name", "github-actions"], check=True)
        subprocess.run(["git", "config", "user.email", "github-actions@github.com"], check=True)
        
        # Add all three files
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
    """Extracts the planned workouts from endurance_plan.md"""
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
    Hydration: Calculate TSS if missing. 
    Formula: (sec * NP * IF) / (FTP * 3600) * 100
    Assuming a standard FTP if not present (e.g., 250) or skipping.
    """
    # If TSS exists and is not zero/empty, keep it
    try:
        current_tss = float(row.get('trainingStressScore', 0))
        if current_tss > 0: return current_tss
    except: pass

    try:
        # Get duration in seconds
        duration = float(row.get('duration', 0))
        # Get Normalized Power (Garmin often labels this 'normPower' or similar)
        np_val = float(row.get('normPower', 0))
        
        # We need FTP. Hardcoded fallback or column lookup.
        ftp = 265.0 # Update this or pull from a settings file/column if available
        
        if duration > 0 and np_val > 0:
            intensity = np_val / ftp
            tss = (duration * np_val * intensity) / (ftp * 3600) * 100
            return round(tss, 1)
    except Exception:
        return ""
    
    return ""

def main():
    try:
        print_header("STARTING MIGRATION & PLAN UPDATE")
        run_garmin_fetch()

        # 1. Load Data Sources
        df_master = load_master_db()
        df_plan = extract_weekly_table()
        
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)
        df_garmin = pd.DataFrame(garmin_data)

        # 2. Pre-process Dates for Matching
        df_master['Date_Dt'] = pd.to_datetime(df_master['Date'], errors='coerce').dt.normalize()
        
        # Process Garmin Dates & Columns
        if not df_garmin.empty:
            # Handle start time
            df_garmin['Date_Dt'] = pd.to_datetime(df_garmin['startTimeLocal']).dt.normalize()
            df_garmin['activityId'] = df_garmin['activityId'].astype(str)
            
            # Ensure columns map to Master Schema
            # Map standard Garmin JSON keys to our columns if names differ
            # (The JSON keys seem to match MASTER_COLUMNS mostly based on previous script)
            pass

        # 3. Sync Plan to Master (Ensure Master has all planned rows)
        # We append planned rows that aren't in Master yet
        if not df_plan.empty:
            print("Syncing Weekly Plan to Master DB...")
            df_plan['Date_Dt'] = pd.to_datetime(df_plan['Date'], errors='coerce').dt.normalize()
            
            # Simple check: Date + Planned Workout match
            # Create a signature key for checking existence
            df_master['unique_key'] = df_master['Date_Dt'].astype(str) + "_" + df_master['Planned Workout'].astype(str)
            df_plan['unique_key'] = df_plan['Date_Dt'].astype(str) + "_" + df_plan['Planned Workout'].astype(str)
            
            existing_keys = set(df_master['unique_key'].tolist())
            
            new_plan_rows = []
            for _, row in df_plan.iterrows():
                if row['unique_key'] not in existing_keys:
                    # Create new blank master row from plan
                    new_row = {col: "" for col in MASTER_COLUMNS}
                    new_row.update({
                        'Date': row['Date'],
                        'Day': row['Day'],
                        'Planned Workout': row['Planned Workout'],
                        'Planned Duration': row['Planned Duration'],
                        'Notes / Targets': row.get('Notes', ''),
                        'Status': 'Pending'
                    })
                    new_plan_rows.append(new_row)
            
            if new_plan_rows:
                print(f"Adding {len(new_plan_rows)} new planned workouts to Master.")
                df_master = pd.concat([df_master, pd.DataFrame(new_plan_rows)], ignore_index=True)
                # Re-calc dates
                df_master['Date_Dt'] = pd.to_datetime(df_master['Date'], errors='coerce').dt.normalize()

        # 4. THE MERGE (Master First)
        # We merge Garmin data into Master. 
        # Left Join = Keep all Master rows.
        print_header("MERGING GARMIN DATA (MASTER PRESERVED)")
        
        # Prepare Garmin for Merge (Rename cols to avoid collision or map directly)
        # We'll suffix Garmin columns with '_new' to control the overwrite
        df_garmin_merge = df_garmin.add_suffix('_new')
        
        # Merge on Date (and potentially Activity Type if we wanted to get fancy, but Date is standard)
        # Note: If there are multiple activities per day, this simple merge might duplicate rows.
        # To be safe, we merge on Date.
        merged_df = pd.merge(
            df_master, 
            df_garmin_merge, 
            left_on='Date_Dt', 
            right_on='Date_Dt_new', 
            how='left'
        )

        # 5. Hydrate & Update Columns
        # For every row, if we found a match (activityId_new exists), we update the data.
        
        telemetry_cols = [
            'activityId', 'activityName', 'activityType', 'duration', 'distance', 
            'averageHR', 'maxHR', 'aerobicTrainingEffect', 'anaerobicTrainingEffect', 
            'avgPower', 'normPower', 'trainingStressScore', 'calories', 'elevationGain'
        ]

        for index, row in merged_df.iterrows():
            if pd.notna(row.get('activityId_new')):
                # We have a match!
                merged_df.at[index, 'Match Status'] = 'Linked'
                merged_df.at[index, 'Status'] = 'COMPLETED'
                
                # Update telemetry
                for col in telemetry_cols:
                    new_val = row.get(f"{col}_new")
                    # Update if new_val is valid
                    if pd.notna(new_val) and str(new_val) != "":
                        merged_df.at[index, col] = new_val
                
                # Update Actual Workout Name/Duration for the plan
                merged_df.at[index, 'Actual Workout'] = row.get('activityName_new', 'Activity')
                # Convert duration (sec) to minutes for readability in "Actual Duration"
                try:
                    dur_sec = float(row.get('duration_new', 0))
                    merged_df.at[index, 'Actual Duration'] = f"{dur_sec/60:.1f}"
                except: pass

        # 6. Identify & Append Unplanned Workouts
        # Find Garmin IDs that were NOT used in the merge
        matched_ids = merged_df['activityId_new'].dropna().unique()
        unplanned_mask = ~df_garmin['activityId'].isin(matched_ids)
        df_unplanned = df_garmin[unplanned_mask].copy()
        
        if not df_unplanned.empty:
            print(f"Found {len(df_unplanned)} unplanned activities. Appending...")
            
            # Map Unplanned rows to Master Schema
            unplanned_rows = []
            for _, u_row in df_unplanned.iterrows():
                new_row = {col: "" for col in MASTER_COLUMNS}
                # Fill what we know
                new_row['Planned Workout'] = 'Unplanned'
                new_row['Status'] = 'COMPLETED'
                new_row['Match Status'] = 'Unplanned'
                new_row['Date'] = str(u_row['startTimeLocal'])[:10] # YYYY-MM-DD
                new_row['Actual Workout'] = u_row.get('activityName', 'Unplanned Activity')
                
                try:
                    new_row['Actual Duration'] = f"{float(u_row.get('duration', 0))/60:.1f}"
                except: pass
                
                # Fill telemetry
                for col in telemetry_cols:
                    if col in u_row:
                        new_row[col] = u_row[col]
                
                unplanned_rows.append(new_row)
            
            merged_df = pd.concat([merged_df, pd.DataFrame(unplanned_rows)], ignore_index=True)

        # 7. Final Hydration (TSS Calc)
        print("Hydrating TSS and calculated fields...")
        merged_df['trainingStressScore'] = merged_df.apply(calculate_tss, axis=1)

        # 8. Clean up & Save Master
        # Remove temporary merge columns
        final_cols = [c for c in merged_df.columns if c in MASTER_COLUMNS]
        df_final = merged_df[final_cols]
        
        # Sort by Date (Descending)
        df_final['Date_Sort'] = pd.to_datetime(df_final['Date'], errors='coerce')
        df_final = df_final.sort_values(by='Date_Sort', ascending=False).drop(columns=['Date_Sort'])

        # Write to Markdown
        print(f"Saving {len(df_final)} rows to Master DB...")
        with open(MASTER_DB, 'w', encoding='utf-8') as f:
            f.write("| " + " | ".join(MASTER_COLUMNS) + " |\n")
            f.write("| " + " | ".join(['---'] * len(MASTER_COLUMNS)) + " |\n")
            for _, row in df_final.iterrows():
                # Clean values for Markdown table
                vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in MASTER_COLUMNS]
                f.write("| " + " | ".join(vals) + " |\n")

        # 9. Update the Weekly Plan (Visuals only)
        # We read the master rows we just updated to sync back to the Plan MD
        # (This keeps the "Actual" columns in your weekly schedule updated)
        if not df_plan.empty:
            print_header("UPDATING WEEKLY PLAN VISUALS")
            # Create a lookup map from the updated master
            # Key: Date -> {Actual Name, Actual Duration}
            updates_map = {}
            for _, row in df_final.iterrows():
                d = str(row['Date'])
                if row['Actual Workout'] and row['Actual Workout'] != 'nan':
                    updates_map[d] = {
                        'name': row['Actual Workout'],
                        'dur': row['Actual Duration']
                    }

            # Rewriting the plan file line by line
            with open(PLAN_FILE, 'r', encoding='utf-8') as f:
                plan_lines = f.readlines()
            
            with open(PLAN_FILE, 'w', encoding='utf-8') as f:
                in_schedule = False
                for line in plan_lines:
                    if 'weekly schedule' in line.lower(): in_schedule = True
                    
                    if in_schedule and '|' in line and '---' not in line and not line.strip().startswith('#'):
                        cols = [c.strip() for c in line.split('|')]
                        # Find date in this row
                        row_date = next((c for c in cols if re.match(r'\d{4}-\d{2}-\d{2}', c)), None)
                        
                        if row_date and row_date in updates_map:
                            upd = updates_map[row_date]
                            # Assuming fixed column positions based on header, or simple search
                            # We'll use index logic roughly based on standard plan format
                            # Date | Day | Planned Workout | Dur | Actual Workout | Actual Dur | Notes
                            # 1    | 2   | 3               | 4   | 5              | 6          | 7
                            if len(cols) > 6:
                                cols[5] = upd['name'] # Actual Workout
                                cols[6] = upd['dur']  # Actual Duration
                            f.write("| " + " | ".join(cols[1:-1]) + " |\n")
                        else:
                            f.write(line)
                    else:
                        if in_schedule and line.startswith('#') and 'weekly schedule' not in line.lower(): 
                            in_schedule = False
                        f.write(line)

        print("✅ Success: Master DB and Weekly Plan updated.")
        git_push_changes()

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    main()
