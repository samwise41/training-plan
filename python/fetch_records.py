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
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02}:{s:02}"
    return f"{m}:{s:02}"

def process_records(records):
    """Flattens the nested Garmin JSON into a clean list for the table."""
    table_data = []
    
    # Garmin returns keys like 'running', 'cycling', 'swimming'
    for sport, rec_list in records.items():
        if not isinstance(rec_list, list): continue
        
        for r in rec_list:
            # Skip invalid entries
            if not r: continue

            # Determine Record Name
            type_id = r.get('typeId', '')
            name = r.get('typeKey', type_id).replace('_', ' ').title()
            
            # Determine Value (Time or Distance)
            display_val = ""
            raw_val = r.get('value')
            
            # Distance records usually have 'value' as meters, but check fields
            # Some records are time-based (e.g. 5k), some are distance-based (e.g. Longest Run)
            
            if 'duration' in name.lower() or 'longest' in name.lower():
                # Distance Record (value is likely meters)
                if raw_val:
                    km = raw_val / 1000.0
                    display_val = f"{km:.2f} km"
            elif raw_val:
                # Time Record (value is seconds)
                display_val = format_duration(raw_val)
            
            # Date
            rec_date = r.get('activityDate', 'Unknown')[:10]
            
            # Activity Link (Optional, if available)
            act_id = r.get('activityId')
            
            table_data.append({
                'Sport': sport.capitalize(),
                'Record': name,
                'Value': display_val,
                'Date': rec_date,
                'Activity ID': act_id
            })
            
    return table_data

def save_outputs(records, table_data):
    # 1. Save JSON (Raw Data)
    print(f"💾 Saving JSON to {JSON_OUTPUT}...")
    with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(records, f, indent=4)

    # 2. Save Markdown (Table)
    if not table_data:
        print("⚠️ No records found to chart.")
        return

    df = pd.DataFrame(table_data)
    
    # Sort for better readability
    df = df.sort_values(by=['Sport', 'Date'], ascending=[True, False])
    
    print(f"💾 Saving Markdown to {MD_OUTPUT}...")
    with open(MD_OUTPUT, 'w', encoding='utf-8') as f:
        f.write("# Personal Records 🏆\n\n")
        f.write(f"**Last Updated:** {date.today().isoformat()}\n\n")
        f.write(df.to_markdown(index=False))

def main():
    client = init_garmin()
    
    print("🏆 Fetching Personal Records...")
    try:
        records = client.get_personal_record()
        table_data = process_records(records)
        save_outputs(records, table_data)
        print("✅ Done.")
    except Exception as e:
        print(f"❌ Failed to fetch records: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
