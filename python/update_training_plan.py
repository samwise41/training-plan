import json
import os
import re
import math
import pandas as pd
import datetime
from garminconnect import Garmin
from io import StringIO
import time

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# File Paths
MASTER_DB_FILE = os.path.join(PROJECT_ROOT, 'MASTER_TRAINING_DATABASE.md')
PLAN_FILE = os.path.join(PROJECT_ROOT, 'endurance_plan.md')
GARMIN_JSON_FILE = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')

# Garmin Settings
FETCH_LIMIT = 50 
GARMIN_EMAIL = os.environ.get('GARMIN_EMAIL')
GARMIN_PASSWORD = os.environ.get('GARMIN_PASSWORD')

# Data Definitions
# Filter List: 1=Running, 2=Cycling, 5=Swimming, 255=Other
TARGET_SPORT_IDS = [1, 2, 5, 255]

# Reverse map for tagging extra activities
SPORT_ID_TO_TAG = {
    1: '[RUN]',
    2: '[BIKE]',
    5: '[SWIM]',
    255: '[OTHER]'
}

# The columns to sync from Garmin JSON to the Markdown table
TELEMETRY_COLUMNS = [
    'activityId', 'activityName', 'activityType', 'sportTypeId', 'duration', 
    'distance', 'averageHR', 'maxHR', 'aerobicTrainingEffect', 
    'anaerobicTrainingEffect', 'trainingEffectLabel', 'avgPower', 'maxPower', 
    'normPower', 'trainingStressScore', 'intensityFactor', 'averageSpeed', 
    'maxSpeed', 'averageBikingCadenceInRevPerMinute', 
    'averageRunningCadenceInStepsPerMinute', 'avgStrideLength', 
    'avgVerticalOscillation', 'avgGroundContactTime', 'vO2MaxValue', 
    'calories', 'elevationGain'
]

# --- HELPER FUNCTIONS ---

def clean_id(val):
    """Normalizes IDs to strings, removing decimal points if they exist."""
    if pd.isna(val) or val == '' or str(val).lower() == 'nan':
        return ''
    # Convert to string, remove .0 ending if present (common pandas float artifact)
    return str(val).replace('.0', '').strip()

def load_markdown_table(file_path):
    """Reads a Markdown table into a Pandas DataFrame."""
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return pd.DataFrame()
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Extract table lines (looking for pipes)
    table_lines = [line for line in lines if '|' in line]
    
    # Filter out separator lines (e.g. |---|---|)
    cleaned_lines = [line for line in table_lines if '---' not in line]
    
    if not cleaned_lines:
        return pd.DataFrame()

    # Parse into DataFrame
    df = pd.read_csv(StringIO(''.join(cleaned_lines)), sep='|', skipinitialspace=True)
    
    # Clean column names (strip whitespace and markdown bolding)
    df.columns = [c.strip().replace('**', '') for c in df.columns]
    
    # Drop the first/last empty columns created by leading/trailing pipes
    if df.shape[1] > 1:
        df = df.iloc[:, 1:-1] 
    
    # Clean string data
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].astype(str).str.strip()
            
    # Ensure Date is datetime object
    if 'Date' in df.columns:
        df['Date'] = pd.to_datetime(df['Date'], format='%Y-%m-%d', errors='coerce').dt.date
    
    # Force Activity ID to be a clean string
    if 'activityId' in df.columns:
        df['activityId'] = df['activityId'].apply(clean_id)
    
    return df

def save_markdown_table(df, file_path):
    """Saves DataFrame back to the specific file, preserving headers."""
    # Convert NaNs to empty strings
    df = df.fillna('')
    
    # Ensure IDs are clean strings for saving
    if 'activityId' in df.columns:
        df['activityId'] = df['activityId'].apply(clean_id)

    # Use tabulate for clean Markdown formatting
    from tabulate import tabulate
    markdown_table = tabulate(df, headers='keys', tablefmt='pipe', showindex=False)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(markdown_table)
    
    print(f"💾 Saved updated database to {file_path}")

def get_ftp_from_plan():
    """Parses endurance_plan.md to find the current FTP value."""
    if not os.path.exists(PLAN_FILE):
        return 241 # Default fallback
    
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r'Cycling FTP:.*?(\d+)\s*W', content, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return 241

def fetch_garmin_data():
    """Fetches from Garmin API and updates local JSON."""
    if not GARMIN_EMAIL or not GARMIN_PASSWORD:
        print("⚠️ Garmin credentials not found. Skipping API fetch.")
        return

    print("📡 Connecting to Garmin Connect...")
    try:
        client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
        client.login()
        
        activities = client.get_activities(0, FETCH_LIMIT)
        print(f"✅ Fetched {len(activities)} activities from API.")
        
        # Load existing
        current_data = []
        if os.path.exists(GARMIN_JSON_FILE):
            with open(GARMIN_JSON_FILE, 'r') as f:
                try:
                    current_data = json.load(f)
                except: pass
        
        # Merge by activityId
        data_map = {str(a['activityId']): a for a in current_data}
        count_new = 0
        for act in activities:
            aid = str(act['activityId'])
            if aid not in data_map:
                count_new += 1
            data_map[aid] = act
            
        final_list = list(data_map.values())
        # Sort descending by date
        final_list.sort(key=lambda x: x['startTimeLocal'], reverse=True)
        
        with open(GARMIN_JSON_FILE, 'w') as f:
            json.dump(final_list, f, indent=4)
        
        print(f"   -> Added {count_new} new activities to local JSON.")
            
    except Exception as e:
        print(f"❌ Garmin Sync Error: {e}")

def extract_weekly_schedule_from_plan():
    """Parses Section 5 of endurance_plan.md to get the current week's rows."""
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    table_lines = []
    in_section = False
    
    for line in lines:
        if "## 5. Weekly Schedule" in line:
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break # Next section
        if in_section and '|' in line:
            table_lines.append(line)
            
    cleaned_lines = [line for line in table_lines if '---' not in line]
    if not cleaned_lines:
        return pd.DataFrame()
        
    df = pd.read_csv(StringIO(''.join(cleaned_lines)), sep='|', skipinitialspace=True)
    df.columns = [c.strip().replace('**', '') for c in df.columns]
    df = df.iloc[:, 1:-1]
    
    if 'Date' in df.columns:
        df['Date'] = pd.to_datetime(df['Date'], format='%Y-%m-%d', errors='coerce').dt.date
    
    return df

# --- MAIN LOGIC ---

def main():
    print("==========================================")
    print("   TRAINING PLAN AUTO-UPDATER STARTING    ")
    print("==========================================")

    # 1. Sync Garmin Data
    print("\n--- STEP 1: FETCH GARMIN DATA ---")
    fetch_garmin_data()
    
    # Load Data
    print("\n--- STEP 2: LOAD DATA ---")
    master_df = load_markdown_table(MASTER_DB_FILE)
    plan_df = extract_weekly_schedule_from_plan()
    
    with open(GARMIN_JSON_FILE, 'r') as f:
        garmin_data = json.load(f)

    # Build Map (ActivityID -> Data)
    garmin_id_map = {clean_id(a['activityId']): a for a in garmin_data}
    
    # Build Map (Date, SportID -> Activity)
    garmin_date_map = {}
    for act in garmin_data:
        date_str = act['startTimeLocal'][:10]
        sport_id = act['sportTypeId']
        garmin_date_map[(date_str, sport_id)] = act

    # 2. Add Current Week from Plan to Master
    print("\n--- STEP 3: SYNC WEEKLY PLAN TO MASTER ---")
    existing_dates = set(master_df['Date'].dropna())
    new_plan_rows = plan_df[~plan_df['Date'].isin(existing_dates)].copy()
    
    if not new_plan_rows.empty:
        for col in master_df.columns:
            if col not in new_plan_rows.columns:
                new_plan_rows[col] = "" 
        master_df = pd.concat([new_plan_rows, master_df], ignore_index=True)
        master_df = master_df.sort_values(by='Date', ascending=False).reset_index(drop=True)
        print(f"   + Added {len(new_plan_rows)} new planned workouts.")
    else:
        print("   - No new planned workouts found.")

    # 3. Process Rows (Match & TSS)
    print("\n--- STEP 4: PROCESS ROWS (Match & TSS) ---")
    ftp = get_ftp_from_plan()
    print(f"   * Using FTP: {ftp}W")

    for idx, row in master_df.iterrows():
        current_id = clean_id(row.get('activityId', ''))
        
        # A. LINKING (If no ID)
        if not current_id:
            date_str = str(row['Date'])
            planned_txt = str(row.get('Planned Workout', '')).upper()
            target_sport = None
            tag = ""
            
            if '[RUN]' in planned_txt: target_sport = 1; tag = "[RUN]"
            elif '[BIKE]' in planned_txt: target_sport = 2; tag = "[BIKE]"
            elif '[SWIM]' in planned_txt: target_sport = 5; tag = "[SWIM]"
            
            if target_sport:
                found_act = garmin_date_map.get((date_str, target_sport))
                if found_act:
                    print(f"   -> MATCH FOUND: Linked '{found_act['activityName']}' ({date_str})")
                    master_df.at[idx, 'Match Status'] = 'Linked'
                    master_df.at[idx, 'Status'] = 'COMPLETED'
                    master_df.at[idx, 'Actual Workout'] = f"{tag} {found_act['activityName']}"
                    
                    if found_act.get('duration'):
                        master_df.at[idx, 'Actual Duration'] = round(found_act['duration'] / 60, 1)

                    for col in TELEMETRY_COLUMNS:
                        val = found_act.get(col, '')
                        if col == 'activityType': val = val.get('typeKey', '') if isinstance(val, dict) else val
                        if col == 'activityId': val = clean_id(val)
                        if col in master_df.columns:
                            master_df.at[idx, col] = val
                    
                    current_id = clean_id(found_act.get('activityId')) # Set ID for TSS step below

        # B. BACKFILL & TSS (If we have an ID)
        if current_id and current_id in garmin_id_map:
            # 1. Backfill missing telemetry from JSON (Heals rows with ID but missing data)
            act_data = garmin_id_map[current_id]
            
            # Check for critical TSS inputs
            if pd.isna(master_df.at[idx, 'normPower']) or master_df.at[idx, 'normPower'] == '':
                master_df.at[idx, 'normPower'] = act_data.get('normPower', '')
            if pd.isna(master_df.at[idx, 'intensityFactor']) or master_df.at[idx, 'intensityFactor'] == '':
                master_df.at[idx, 'intensityFactor'] = act_data.get('intensityFactor', '')
            if pd.isna(master_df.at[idx, 'duration']) or master_df.at[idx, 'duration'] == '':
                master_df.at[idx, 'duration'] = act_data.get('duration', '')
            if pd.isna(master_df.at[idx, 'sportTypeId']) or master_df.at[idx, 'sportTypeId'] == '':
                master_df.at[idx, 'sportTypeId'] = act_data.get('sportTypeId', '')

            # 2. Check and Calculate TSS
            tss = master_df.at[idx, 'trainingStressScore']
            sport_val = master_df.at[idx, 'sportTypeId']
            
            needs_tss = (pd.isna(tss) or tss == '' or str(tss) == '0.0' or float(tss if tss else 0) == 0)
            
            try:
                is_valid_sport = int(float(sport_val)) in [1, 2] if sport_val else False
            except:
                is_valid_sport = False
            
            if needs_tss and is_valid_sport:
                try:
                    dur = float(master_df.at[idx, 'duration'])
                    np_val = float(master_df.at[idx, 'normPower'])
                    if_val = float(master_df.at[idx, 'intensityFactor'])
                    
                    if dur > 0 and np_val > 0 and if_val > 0:
                        calc_tss = (dur * np_val * if_val) / (ftp * 3600) * 100
                        master_df.at[idx, 'trainingStressScore'] = round(calc_tss, 1)
                        print(f"      -> TSS Calculated: {round(calc_tss, 1)} (ID: {current_id})")
                    else:
                        print(f"      -> TSS Skipped (ID: {current_id}): Missing metrics (Dur:{dur}, NP:{np_val}, IF:{if_val})")
                except Exception as e:
                    print(f"      -> TSS Error (ID: {current_id}): {e}")

    # 4. Inject Extra Activities
    print("\n--- STEP 5: INJECT UNPLANNED ACTIVITIES ---")
    current_db_ids = set(master_df['activityId'].apply(clean_id).tolist())
    current_db_ids.discard('')
    
    extras = []
    
    for act in garmin_data:
        aid = clean_id(act.get('activityId'))
        sport_id = act.get('sportTypeId')
        
        if sport_id in TARGET_SPORT_IDS and aid not in current_db_ids:
            print(f"   + Found Unplanned: {act.get('activityName')} on {act.get('startTimeLocal')[:10]}")
            new_row = {col: '' for col in master_df.columns}
            
            # Basic Info
            start_local = act.get('startTimeLocal', '')
            if start_local:
                new_row['Date'] = datetime.datetime.strptime(start_local[:10], '%Y-%m-%d').date()
                new_row['Day'] = new_row['Date'].strftime('%A')
            
            new_row['Status'] = 'COMPLETED'
            new_row['Match Status'] = 'Linked'
            tag = SPORT_ID_TO_TAG.get(sport_id, '[EXTRA]')
            new_row['Actual Workout'] = f"{tag} {act.get('activityName','')}"
            if act.get('duration'):
                new_row['Actual Duration'] = round(act['duration'] / 60, 1)
            
            # Telemetry
            for col in TELEMETRY_COLUMNS:
                val = act.get(col, '')
                if col == 'activityType': val = val.get('typeKey', '') if isinstance(val, dict) else val
                if col == 'activityId': val = clean_id(val)
                if col in new_row:
                    new_row[col] = val
            
            extras.append(new_row)
            current_db_ids.add(aid)
            
    if extras:
        print(f"   => Injecting {len(extras)} new activities.")
        extras_df = pd.DataFrame(extras)
        master_df = pd.concat([master_df, extras_df], ignore_index=True)
        master_df = master_df.sort_values(by='Date', ascending=False).reset_index(drop=True)
    else:
        print("   - No unplanned activities to add.")

    # 5. Save
    print("\n--- STEP 6: SAVE DATABASE ---")
    save_markdown_table(master_df, MASTER_DB_FILE)
    print("✅ All processing complete.")

if __name__ == "__main__":
    main()
