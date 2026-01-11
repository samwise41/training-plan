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
    
    # Clean column names (strip whitespace) and remove empty edge columns
    df.columns = [c.strip() for c in df.columns]
    # Drop the first/last empty columns created by leading/trailing pipes
    if df.shape[1] > 1:
        df = df.iloc[:, 1:-1] 
    
    # Clean string data and headers
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].astype(str).str.strip()
            
    # Ensure Date is datetime object
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
    
    print(f"💾 Updated {file_path}")

def get_ftp_from_plan():
    """Parses endurance_plan.md to find the current FTP value."""
    if not os.path.exists(PLAN_FILE):
        return 241 # Default fallback
    
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Regex to find "Cycling FTP: 241" or "**Cycling FTP:** 241"
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
        print(f"✅ Fetched {len(activities)} activities.")
        
        # Load existing
        current_data = []
        if os.path.exists(GARMIN_JSON_FILE):
            with open(GARMIN_JSON_FILE, 'r') as f:
                try:
                    current_data = json.load(f)
                except: pass
        
        # Merge by activityId
        data_map = {str(a['activityId']): a for a in current_data}
        for act in activities:
            data_map[str(act['activityId'])] = act
            
        final_list = list(data_map.values())
        # Sort descending by date
        final_list.sort(key=lambda x: x['startTimeLocal'], reverse=True)
        
        with open(GARMIN_JSON_FILE, 'w') as f:
            json.dump(final_list, f, indent=4)
            
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
            
    # Clean headers
    cleaned_lines = [line for line in table_lines if '---' not in line]
    if not cleaned_lines:
        return pd.DataFrame()
        
    df = pd.read_csv(StringIO(''.join(cleaned_lines)), sep='|', skipinitialspace=True)
    df.columns = [c.strip() for c in df.columns]
    df = df.iloc[:, 1:-1]
    
    # Ensure date format
    df['Date'] = pd.to_datetime(df['Date'], format='%Y-%m-%d', errors='coerce').dt.date
    return df

# --- MAIN LOGIC ---

def main():
    # 1. Sync Garmin Data
    fetch_garmin_data()
    
    # Load Data
    master_df = load_markdown_table(MASTER_DB_FILE)
    plan_df = extract_weekly_schedule_from_plan()
    
    with open(GARMIN_JSON_FILE, 'r') as f:
        garmin_data = json.load(f)

    # 2. Add Current Week from Plan to Master
    print("🔄 Syncing Weekly Plan to Master Database...")
    
    # Identify dates currently in Master DB to avoid duplicates
    existing_dates = set(master_df['Date'].dropna())
    
    # Filter plan rows that are NOT in master DB
    new_plan_rows = plan_df[~plan_df['Date'].isin(existing_dates)].copy()
    
    if not new_plan_rows.empty:
        # Align columns (Master has more columns than Plan)
        for col in master_df.columns:
            if col not in new_plan_rows.columns:
                new_plan_rows[col] = "" # Initialize missing cols
        
        # Concat to top
        master_df = pd.concat([new_plan_rows, master_df], ignore_index=True)
        # Sort desc
        master_df = master_df.sort_values(by='Date', ascending=False).reset_index(drop=True)
        print(f"   + Added {len(new_plan_rows)} new planned workouts.")
    else:
        print("   - No new planned workouts found.")

    # 3. Map Garmin Data
    print("🔗 Mapping Garmin Activities...")
    
    # Build a lookup for Garmin data: (Date_String, SportId) -> Activity
    garmin_map = {}
    for act in garmin_data:
        date_str = act['startTimeLocal'][:10] # YYYY-MM-DD
        sport_id = act.get('sportTypeId')
        key = (date_str, sport_id)
        # Store, prefer existing key if multiple (usually keeps first/latest due to sort)
        if key not in garmin_map:
            garmin_map[key] = act

    ftp = get_ftp_from_plan()

    # Iterate master rows
    for idx, row in master_df.iterrows():
        
        # A. LINKING LOGIC (If no activity ID)
        current_id = clean_id(row.get('activityId', ''))
        
        if not current_id:
            date_str = str(row['Date'])
            planned_txt = str(row.get('Planned Workout', '')).upper()
            
            target_sport = None
            tag = ""
            if '[RUN]' in planned_txt: 
                target_sport = 1
                tag = "[RUN]"
            elif '[BIKE]' in planned_txt: 
                target_sport = 2
                tag = "[BIKE]"
            elif '[SWIM]' in planned_txt: 
                target_sport = 5
                tag = "[SWIM]"
            
            # Try to match
            found_act = garmin_map.get((date_str, target_sport))
            
            if found_act:
                # Update Linking Cols
                master_df.at[idx, 'Match Status'] = 'Linked'
                master_df.at[idx, 'Status'] = 'COMPLETED'
                
                # Update Name
                master_df.at[idx, 'Actual Workout'] = f"{tag} {found_act['activityName']}"
                
                # Update Duration (Sec to Min)
                if found_act.get('duration'):
                    dur_min = round(found_act['duration'] / 60, 1)
                    master_df.at[idx, 'Actual Duration'] = dur_min

                # Populate Telemetry
                for col in TELEMETRY_COLUMNS:
                    val = found_act.get(col, '')
                    if col == 'activityType': val = val.get('typeKey', '') if isinstance(val, dict) else val
                    
                    # Ensure ID is cleaned string
                    if col == 'activityId': val = clean_id(val)
                    
                    if col in master_df.columns:
                        master_df.at[idx, col] = val

        # B. TSS CALCULATION LOGIC (For rows with ID but missing TSS)
        aid = clean_id(master_df.at[idx, 'activityId'])
        tss = master_df.at[idx, 'trainingStressScore']
        
        # Check if ID exists AND TSS is missing/zero
        has_id = (aid != '')
        needs_tss = (pd.isna(tss) or tss == '' or str(tss) == '0.0' or (isinstance(tss, (int, float)) and float(tss) == 0))
        
        # Check if sport is Bike (2) or Run (1)
        # Use existing sportTypeId column
        s_id_val = master_df.at[idx, 'sportTypeId']
        try:
            sport_type = int(float(s_id_val)) if s_id_val and s_id_val != '' else 0
        except:
            sport_type = 0
            
        is_valid_sport = sport_type in [1, 2]

        if has_id and needs_tss and is_valid_sport:
            try:
                # Get raw data needed for formula
                dur_val = master_df.at[idx, 'duration'] # Seconds
                dur_sec = float(dur_val) if dur_val and dur_val != '' else 0
                
                # Fallback to Actual Duration * 60
                if dur_sec == 0:
                    act_dur = master_df.at[idx, 'Actual Duration']
                    dur_sec = float(act_dur) * 60 if act_dur and act_dur != '' else 0
                
                np_val = master_df.at[idx, 'normPower']
                np_float = float(np_val) if np_val and np_val != '' else 0
                
                if_val = master_df.at[idx, 'intensityFactor']
                if_float = float(if_val) if if_val and if_val != '' else 0
                
                if dur_sec > 0 and np_float > 0 and if_float > 0 and ftp > 0:
                    # Formula: (Duration_Sec * NP * IF) / (FTP * 3600) * 100
                    calc_tss = (dur_sec * np_float * if_float) / (ftp * 3600) * 100
                    master_df.at[idx, 'trainingStressScore'] = round(calc_tss, 1)
            except:
                pass 

    # 4. Inject Extra Activities
    print("➕ Checking for non-planned Garmin activities...")
    
    # Re-scan dataframe for IDs to ensure we capture newly linked ones
    # Use clean_id to ensure format matches Garmin JSON
    existing_ids = set(master_df['activityId'].apply(clean_id).tolist())
    # Remove empty strings from set
    existing_ids.discard('')
    
    extras = []
    
    for act in garmin_data:
        aid = clean_id(act.get('activityId'))
        # STRICTLY use sportTypeId. Do not use parentTypeId.
        sport_id = act.get('sportTypeId')
        
        # Only Run(1), Bike(2), Swim(5), Other(255)
        # AND check if ID is NOT in our set
        if sport_id in TARGET_SPORT_IDS and aid not in existing_ids:
            
            # Create a new row
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
            existing_ids.add(aid) # Prevent duplicates in loop
            print(f"   -> Found new activity: {new_row['Actual Workout']} ({new_row['Date']})")
            
    if extras:
        print(f"   + Injecting {len(extras)} extra activities.")
        extras_df = pd.DataFrame(extras)
        master_df = pd.concat([master_df, extras_df], ignore_index=True)
        # Sort again
        master_df = master_df.sort_values(by='Date', ascending=False).reset_index(drop=True)
    else:
        print("   - No extra activities found.")

    # 5. Save
    save_markdown_table(master_df, MASTER_DB_FILE)
    print("✅ All processing complete.")

if __name__ == "__main__":
    main()
