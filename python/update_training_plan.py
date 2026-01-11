import json
import os
import datetime
import pandas as pd
import numpy as np
from garminconnect import Garmin
import time

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Adjust path to go up one level from /python/ to the root of the repo for the MD file
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MASTER_DB_FILE = os.path.join(PROJECT_ROOT, 'MASTER_TRAINING_DATABASE.md')
JSON_FILE = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')

# Metrics for Calculation
CURRENT_FTP = 241  # Based on your latest test. Update this as fitness changes.
FETCH_LIMIT = 50

# Sport Mappings (Plan Tag -> Garmin SportTypeId)
# 1=Running, 2=Cycling, 5=Swimming, 255=All/Other specified by user
SPORT_MAP = {
    '[RUN]': [1, 255], 
    '[BIKE]': [2, 255],
    '[SWIM]': [5, 255]
}

# Reverse Map for labeling new activities
TYPE_ID_TO_TAG = {
    1: '[RUN]',
    2: '[BIKE]',
    5: '[SWIM]',
    255: '[OTHER]'
}

# Columns to map from Garmin JSON to Markdown
GARMIN_COLUMNS = [
    'activityId', 'activityName', 'activityType', 'sportTypeId', 'duration', 
    'distance', 'averageHR', 'maxHR', 'aerobicTrainingEffect', 
    'anaerobicTrainingEffect', 'trainingEffectLabel', 'avgPower', 'maxPower', 
    'normPower', 'trainingStressScore', 'intensityFactor', 'averageSpeed', 
    'maxSpeed', 'averageBikingCadenceInRevPerMinute', 
    'averageRunningCadenceInStepsPerMinute', 'avgStrideLength', 
    'avgVerticalOscillation', 'avgGroundContactTime', 'vO2MaxValue', 
    'calories', 'elevationGain'
]

def fetch_garmin_data():
    """Fetches latest data from Garmin and updates the local JSON file."""
    email = os.environ.get('GARMIN_EMAIL')
    password = os.environ.get('GARMIN_PASSWORD')

    if not email or not password:
        print("⚠️ GARMIN_EMAIL or GARMIN_PASSWORD missing. Skipping Fetch.")
        return

    print("🔐 Authenticating with Garmin Connect...")
    try:
        client = Garmin(email, password)
        client.login()
    except Exception as e:
        print(f"❌ Login Failed: {e}")
        return

    print(f"📡 Fetching last {FETCH_LIMIT} activities...")
    try:
        new_activities = client.get_activities(0, FETCH_LIMIT)
        print(f"✅ Retrieved {len(new_activities)} activities.")
    except Exception as e:
        print(f"❌ Fetch Failed: {e}")
        return

    # Load existing
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            try:
                existing_data = json.load(f)
            except:
                existing_data = []
    else:
        existing_data = []

    # Merge
    db = {str(item['activityId']): item for item in existing_data}
    updates = 0
    adds = 0
    
    for act in new_activities:
        aid = str(act['activityId'])
        if aid not in db:
            db[aid] = act
            adds += 1
        else:
            db[aid] = act # Update in case data changed (e.g. name edit)
            updates += 1

    final_data = list(db.values())
    # Sort descending by start time
    final_data.sort(key=lambda x: x.get('startTimeLocal', ''), reverse=True)

    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=4)
    
    print(f"💾 Saved JSON: {adds} added, {updates} updated.")

def load_master_db():
    """Parses the Markdown table into a Pandas DataFrame."""
    if not os.path.exists(MASTER_DB_FILE):
        raise FileNotFoundError(f"Cannot find {MASTER_DB_FILE}")
    
    # Read markdown table. 
    # Use the pipe separator, strip whitespace. 
    # Skip the separator line (row 1 usually, index 1)
    with open(MASTER_DB_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Filter out the separator line (e.g., |---|---|)
    cleaned_lines = [line for line in lines if '---' not in line]
    
    from io import StringIO
    df = pd.read_csv(StringIO(''.join(cleaned_lines)), sep='|', skipinitialspace=True)
    
    # Clean up column names (remove whitespace and empty columns from pipe edges)
    df.columns = [c.strip() for c in df.columns]
    df = df.iloc[:, 1:-1] # Remove the first and last empty columns caused by leading/trailing pipes
    
    # Ensure Date is datetime
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce').dt.date
    
    # Ensure ID column is treated as string/object to prevent float conversion issues
    # but handle existing NaNs
    df['activityId'] = df['activityId'].astype(str).replace('nan', '')

    return df

def get_current_week_dates():
    """Returns a list of date objects for the current week (Mon-Sun)."""
    today = datetime.date.today()
    start_of_week = today - datetime.timedelta(days=today.weekday())
    dates = [start_of_week + datetime.timedelta(days=i) for i in range(7)]
    # Reverse so Sunday is top, Monday bottom (standard log format often) 
    # OR Standard plan format: usually Future -> Past. 
    # The prompt says "Add current week to top". 
    # We will assume Descending order (future dates at top) if the file is reverse chronological.
    return sorted(dates, reverse=True)

def update_master_plan(df, garmin_data):
    """Main logic processor."""
    
    # --- 1. Add Current Week if missing ---
    print("📅 Checking for current week entries...")
    current_week_dates = get_current_week_dates()
    existing_dates = set(df['Date'].dropna().unique())
    
    new_rows = []
    days_of_week = {0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday'}
    
    for d in current_week_dates:
        if d not in existing_dates:
            # Create a generic empty row structure
            row = {col: '' for col in df.columns}
            row['Date'] = d
            row['Day'] = days_of_week[d.weekday()]
            # Set basic Status
            row['Status'] = 'Planned'
            new_rows.append(row)
    
    if new_rows:
        print(f"   + Adding {len(new_rows)} days for the current week.")
        new_df = pd.DataFrame(new_rows)
        df = pd.concat([new_df, df], ignore_index=True)
        # Ensure sorted descending by date
        df['Date'] = pd.to_datetime(df['Date']).dt.date
        df = df.sort_values(by='Date', ascending=False).reset_index(drop=True)

    # --- Pre-process Garmin Data for easy lookup ---
    # Create a lookup key: "YYYY-MM-DD" -> list of activities on that day
    garmin_lookup = {}
    for act in garmin_data:
        # Extract Date "YYYY-MM-DD" from "2026-01-10 06:04:01"
        d_str = act['startTimeLocal'][:10]
        if d_str not in garmin_lookup:
            garmin_lookup[d_str] = []
        garmin_lookup[d_str].append(act)

    # --- 2. Map Master DB rows with NO activityId ---
    print("🔗 Linking planned workouts to Garmin data...")
    
    # Iterate through rows using index to allow updating
    for index, row in df.iterrows():
        # Check if activityId is empty or "nan" string
        if not row['activityId'] or row['activityId'] == 'nan':
            date_key = str(row['Date'])
            planned_workout = str(row.get('Planned Workout', '')).upper()
            
            # Determine target sport type ID
            target_types = []
            tag_found = None
            for tag, types in SPORT_MAP.items():
                if tag in planned_workout:
                    target_types = types
                    tag_found = tag
                    break
            
            if date_key in garmin_lookup and target_types:
                # Find matching activity on that day
                candidates = garmin_lookup[date_key]
                match = None
                for cand in candidates:
                    if cand['activityType']['parentTypeId'] in target_types or cand['activityType']['typeId'] in target_types:
                        match = cand
                        break
                
                if match:
                    print(f"   -> Linked {date_key}: {match['activityName']}")
                    df.at[index, 'Match Status'] = 'Linked'
                    df.at[index, 'Status'] = 'COMPLETED'
                    
                    # Update Columns
                    for col in GARMIN_COLUMNS:
                        val = match.get(col, '')
                        # Flatten complex objects if necessary (e.g. activityType is dict)
                        if col == 'activityType' and isinstance(val, dict):
                            val = val.get('typeKey', '') # Store simple key or raw string? Using raw str for now based on file sample
                        if col == 'sportTypeId' and val:
                             val = int(val)
                        
                        # Handle specific numeric precision if needed, else pandas handles it
                        if col in df.columns:
                            df.at[index, col] = str(val) if val is not None else ''

                    # Specific Update: Actual Workout Name
                    activity_name = match.get('activityName', 'Activity')
                    df.at[index, 'Actual Workout'] = f"{tag_found} {activity_name}"
                    
                    # Specific Update: Duration (Seconds to Minutes)
                    dur_sec = match.get('duration', 0)
                    if dur_sec:
                        df.at[index, 'Actual Duration'] = round(float(dur_sec) / 60, 1)

    # --- 3. Calculate TSS for Linked Rows ---
    print("🧮 Calculating TSS for Bike/Run...")
    for index, row in df.iterrows():
        aid = str(row['activityId'])
        if aid and aid != 'nan':
            # Check Sport (Simplistic check on Planned tag or SportTypeId if available)
            # sportTypeId: 1=Run, 2=Bike
            sport_id = pd.to_numeric(row.get('sportTypeId', 0), errors='coerce')
            
            is_run_bike = (sport_id == 1 or sport_id == 2)
            
            # If sport_id wasn't populated (manual entry?), check tags
            if not is_run_bike:
                actual = str(row.get('Actual Workout', '')).upper()
                planned = str(row.get('Planned Workout', '')).upper()
                if '[BIKE]' in actual or '[RUN]' in actual or '[BIKE]' in planned or '[RUN]' in planned:
                    is_run_bike = True

            if is_run_bike:
                current_tss = pd.to_numeric(row.get('trainingStressScore', 0), errors='coerce')
                
                # Check if missing or 0 (and not NaN)
                if pd.isna(current_tss) or current_tss == 0:
                    try:
                        # Formula: (Duration_Sec * NP * IF) / (FTP * 3600) * 100
                        # We need duration in seconds. 'duration' col from Garmin is seconds.
                        # 'Actual Duration' is minutes. Let's use 'duration' column if it exists and is populated
                        duration_sec = pd.to_numeric(row.get('duration', 0), errors='coerce')
                        
                        # Fallback to Actual Duration * 60 if duration column is empty
                        if pd.isna(duration_sec) or duration_sec == 0:
                            duration_min = pd.to_numeric(row.get('Actual Duration', 0), errors='coerce')
                            duration_sec = duration_min * 60
                        
                        np_val = pd.to_numeric(row.get('normPower', 0), errors='coerce')
                        if_val = pd.to_numeric(row.get('intensityFactor', 0), errors='coerce')
                        
                        if duration_sec > 0 and np_val > 0 and if_val > 0 and CURRENT_FTP > 0:
                            tss = (duration_sec * np_val * if_val) / (CURRENT_FTP * 3600) * 100
                            df.at[index, 'trainingStressScore'] = round(tss, 1)
                            print(f"   -> Calculated TSS for {row['Date']}: {round(tss, 1)}")
                    except Exception as e:
                        # print(f"Skipping TSS calc for row {index}: {e}")
                        pass

    # --- 4. Add Extra Garmin Activities ---
    print("➕ Checking for extra activities...")
    
    # Get set of existing IDs in Master DB
    existing_ids = set(df['activityId'].astype(str).replace('nan', '').tolist())
    
    extras = []
    target_sport_ids = [1, 2, 5, 255] # Run, Bike, Swim, Other
    
    for act in garmin_data:
        aid = str(act['activityId'])
        sport_id = act.get('activityType', {}).get('parentTypeId') 
        # Fallback to specific type if parent not available or specific required
        if not sport_id: 
            sport_id = act.get('sportTypeId')

        # Check filter
        # Note: Garmin JSON usually has 'sportTypeId' at top level too.
        top_sport_id = act.get('sportTypeId')
        
        # Check against the list provided
        if (top_sport_id in target_sport_ids) and (aid not in existing_ids) and aid != 'None':
            # Create New Row
            row = {col: '' for col in df.columns}
            
            # Map Data
            row['Date'] = act['startTimeLocal'][:10]
            # Convert YYYY-MM-DD to Day Name
            d_obj = datetime.datetime.strptime(row['Date'], '%Y-%m-%d').date()
            row['Day'] = days_of_week[d_obj.weekday()]
            row['Status'] = 'EXTRA' # Or COMPLETED? User said populate "Match Status" as Linked
            row['Match Status'] = 'Linked'
            
            # Tag
            tag = TYPE_ID_TO_TAG.get(top_sport_id, '[EXTRA]')
            row['Actual Workout'] = f"{tag} {act['activityName']}"
            
            # Duration
            if act.get('duration'):
                row['Actual Duration'] = round(float(act['duration']) / 60, 1)
            
            # Garmin Cols
            for col in GARMIN_COLUMNS:
                val = act.get(col, '')
                # Handle dicts
                if col == 'activityType' and isinstance(val, dict):
                    val = val  # Keep dict as string representation if that's how the csv stores it, or val.get('typeKey')
                if col in df.columns:
                    row[col] = str(val) if val is not None else ''

            extras.append(row)
            existing_ids.add(aid) # prevent duplicates if duplicates in json

    if extras:
        print(f"   + Adding {len(extras)} extra activities.")
        extras_df = pd.DataFrame(extras)
        df = pd.concat([df, extras_df], ignore_index=True)
        # Sort again
        df['Date'] = pd.to_datetime(df['Date']).dt.date
        df = df.sort_values(by='Date', ascending=False).reset_index(drop=True)

    return df

def save_master_db(df):
    """Saves DataFrame back to Markdown table format."""
    # Convert all columns to string, replace nan with empty string
    df = df.fillna('')
    df = df.astype(str)
    
    # Replace 'nan' string with ''
    for col in df.columns:
        df[col] = df[col].replace('nan', '')

    # Generate Markdown Table using pipe format
    # We do this manually or use tabulate to ensure control over formatting
    try:
        from tabulate import tabulate
        # Tabulate usually adds spaces, we need to ensure it matches the user's preferred dense style or standard md
        md_table = tabulate(df, headers='keys', tablefmt='pipe', showindex=False)
        
        # Write to file
        with open(MASTER_DB_FILE, 'w', encoding='utf-8') as f:
            f.write(md_table)
        print("✅ Master Database updated successfully.")
        
    except ImportError:
        print("❌ 'tabulate' library not found. Please run: pip install tabulate")

def main():
    # 1. Fetch Latest
    fetch_garmin_data()
    
    # 2. Load Local Data
    print("📂 Loading Master Database...")
    try:
        master_df = load_master_db()
    except Exception as e:
        print(f"❌ Error loading Master DB: {e}")
        return

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        garmin_data = json.load(f)

    # 3. Process
    updated_df = update_master_plan(master_df, garmin_data)
    
    # 4. Save
    save_master_db(updated_df)

if __name__ == "__main__":
    main()
