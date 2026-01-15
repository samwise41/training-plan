import os
import sys
import json
import pandas as pd
from garminconnect import Garmin
from datetime import date

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, 'garmind_data')

# Ensure output directory exists
os.makedirs(DATA_DIR, exist_ok=True)

JSON_OUTPUT = os.path.join(DATA_DIR, 'garmin_records.json')
MD_OUTPUT = os.path.join(DATA_DIR, 'garmin_records.md')

# --- CONSTANTS ---
# Fallback mapping for common Garmin Record IDs if text is missing
RECORD_TYPE_MAP = {
    1: "1 km", 2: "1 Mile", 3: "5 km", 4: "10 km", 5: "Half Marathon", 6: "Marathon",
    12: "Longest Run", 
    22: "Longest Ride", 23: "Max Power (20 min)", 24: "40 km", 
    27: "100m Swim", 28: "1000m Swim", 29: "Longest Swim"
}

# --- CREDENTIALS ---
EMAIL = os.environ.get('GARMIN_EMAIL')
PASSWORD = os.environ.get('GARMIN_PASSWORD')

def init_garmin():
    if not EMAIL or not PASSWORD:
        print("❌ Error: Credentials missing.")
        sys.exit(1)
    try:
        print("🔐 Authenticating with Garmin Connect...")
        client = Garmin(EMAIL, PASSWORD)
        client.login()
        return client
    except Exception as e:
        print(f"❌ Login Failed: {e}")
        sys.exit(1)

def format_duration(seconds):
    """Converts seconds to HH:MM:SS or MM:SS"""
    if not seconds: return "--"
    try:
        seconds = float(seconds)
    except: return str(seconds)
    
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02}:{s:02}"
    return f"{m}:{s:02}"

def guess_sport(record_name, type_id):
    """Infers sport from record name or ID"""
    name_lower = record_name.lower()
    
    # Explicit keyword matches
    if 'run' in name_lower or 'marathon' in name_lower or '5k' in name_lower: return 'Running'
    if 'ride' in name_lower or 'cycl' in name_lower or 'power' in name_lower: return 'Cycling'
    if 'swim' in name_lower: return 'Swimming'
    
    # ID Ranges (Heuristic)
    if type_id in [1,2,3,4,5,6,12]: return 'Running'
    if type_id in [22,23,24]: return 'Cycling'
    if type_id in [27,28,29]: return 'Swimming'
    
    return 'Other'

def find_records_recursive(data, collected=[]):
    """Recursively searches for objects that look like records (have typeId and value)."""
    if isinstance(data, dict):
        # Check if this dict IS a record
        if 'typeId' in data and 'value' in data:
            collected.append(data)
        # Otherwise search its keys
        for k, v in data.items():
            find_records_recursive(v, collected)
            
    elif isinstance(data, list):
        for item in data:
            find_records_recursive(item, collected)
            
    return collected

def process_records(records_raw):
    """Flattens the Garmin data into a clean list for the table."""
    table_data = []
    
    # 1. Find all record objects regardless of structure (Dict vs List)
    all_records = find_records_recursive(records_raw)
    
    print(f"🔎 Found {len(all_records)} potential records.")

    for r in all_records:
        # --- 1. DETERMINE NAME ---
        type_id = r.get('typeId')
        type_key = r.get('typeKey')
        
        # Prefer mapped name, then typeKey, then ID
        if type_id in RECORD_TYPE_MAP:
            name = RECORD_TYPE_MAP[type_id]
        elif type_key:
            name = type_key.replace('_', ' ').title()
        else:
            name = f"Record ID {type_id}"

        # --- 2. DETERMINE SPORT ---
        # Some objects have a 'sportId' we could map, but guessing by name is usually safer
        sport = guess_sport(name, type_id)

        # --- 3. DETERMINE VALUE ---
        raw_val = r.get('value')
        display_val = "--"
        
        # Heuristic: If it looks like a distance record, value is meters
        if 'longest' in name.lower() or 'far' in name.lower():
            if raw_val:
                km = float(raw_val) / 1000.0
                display_val = f"{km:.2f} km"
        # Heuristic: Elevation
        elif 'elevation' in name.lower() or 'ascent' in name.lower():
             if raw_val:
                display_val = f"{int(raw_val)} m"
        # Default: Time (Seconds)
        elif raw_val:
            display_val = format_duration(raw_val)

        # --- 4. DETERMINE DATE ---
        # Garmin uses different date keys depending on endpoint
        rec_date = r.get('activityDate') or r.get('date') or r.get('startTimeLocal') or "Unknown"
        rec_date = rec_date[:10] # YYYY-MM-DD

        # Activity Link
        act_id = r.get('activityId')
        
        table_data.append({
            'Sport': sport,
            'Record': name,
            'Value': display_val,
            'Date': rec_date,
            'Activity ID': act_id
        })
            
    return table_data

def save_outputs(records, table_data):
    # 1. Save Raw JSON (For debugging)
    with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=4)
    print(f"💾 Raw JSON saved: {JSON_OUTPUT}")

    # 2. Save Markdown
    if not table_data:
        print("⚠️ No records found to chart.")
        return

    df = pd.DataFrame(table_data)
    
    # Sort: Sport -> Date Descending
    if not df.empty:
        df = df.sort_values(by=['Sport', 'Date'], ascending=[True, False])
    
    # Clean up columns for display
    display_df = df[['Sport', 'Record', 'Value', 'Date']].copy()
    
    with open(MD_OUTPUT, 'w', encoding='utf-8') as f:
        f.write("# Personal Records 🏆\n\n")
        f.write(f"**Last Updated:** {date.today().isoformat()}\n\n")
        f.write(display_df.to_markdown(index=False))
    
    print(f"💾 Markdown Table saved: {MD_OUTPUT}")

def main():
    client = init_garmin()
    
    print("🏆 Fetching Personal Records...")
    try:
        # Fetch raw data
        records = client.get_personal_record()
        
        # Process using the new "Search Everything" logic
        table_data = process_records(records)
        
        # Save
        save_outputs(records, table_data)
        
    except Exception as e:
        print(f"❌ Critical Error: {e}")
        # Dump what we have if possible for debugging
        sys.exit(1)

if __name__ == "__main__":
    main()
