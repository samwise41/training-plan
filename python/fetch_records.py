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
    try:
        seconds = float(seconds)
    except: return str(seconds)
    
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02}:{s:02}"
    return f"{m}:{s:02}"

def process_records(records):
    """Flattens the nested Garmin JSON into a clean list for the table."""
    table_data = []
    
    # --- FIX: Handle both Dict and List responses ---
    iter_data = []
    if isinstance(records, dict):
        # Standard format: {'running': [...], 'cycling': [...]}
        iter_data = records.items()
    elif isinstance(records, list):
        # Flat format or list of sports: [{'typeId': 2, ...}, ...]
        # We assume it's a mixed list, so we'll label them based on content
        print("⚠️ Detected LIST format. Processing linearly...")
        # Wrap it in a generic tuple to reuse logic
        iter_data = [('Records', records)]
    else:
        print(f"⚠️ Unknown data format: {type(records)}")
        return []

    for category, rec_list in iter_data:
        # Check if the item itself is a list (standard) or a dict (single record in flat list)
        if not isinstance(rec_list, list):
            rec_list = [rec_list]

        for r in rec_list:
            if not isinstance(r, dict): continue

            # Determine Record Name
            type_id = r.get('typeId', '')
            key_name = r.get('typeKey', str(type_id))
            name = key_name.replace('_', ' ').title()
            
            # Guess Sport if category is generic
            sport = category
            if category == 'Records':
                # Try to infer sport from the record type
                if 'run' in key_name.lower(): sport = 'Running'
                elif 'cycl' in key_name.lower() or 'bik' in key_name.lower(): sport = 'Cycling'
                elif 'swim' in key_name.lower(): sport = 'Swimming'
                else: sport = 'General'

            # Determine Value (Time or Distance)
            display_val = ""
            raw_val = r.get('value')
            
            # Logic: If name implies duration/time but raw_val is huge, it might be meters?
            # Usually: 
            # - value is seconds for distances (e.g. 5k)
            # - value is meters for durations (e.g. Longest Run)
            
            # Distance Record (e.g. Longest Run)
            if 'longest' in name.lower() or 'far' in name.lower():
                if raw_val:
                    km = float(raw_val) / 1000.0
                    display_val = f"{km:.2f} km"
            # Time Record (e.g. 5K, Marathon)
            elif raw_val:
                display_val = format_duration(raw_val)
            
            # Date
            rec_date = r.get('activityDate', 'Unknown')[:10]
            act_id = r.get('activityId')
            
            table_data.append({
                'Sport': sport.capitalize(),
                'Record': name,
                'Value': display_val,
                'Date': rec_date,
                'Activity ID': act_id
            })
            
    return table_data

def main():
    client = init_garmin()
    
    print("🏆 Fetching Personal Records...")
    try:
        records = client.get_personal_record()
        
        # 1. SAVE RAW JSON FIRST (For Debugging)
        print(f"💾 Saving raw JSON to {JSON_OUTPUT}...")
        with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
            json.dump(records, f, indent=4)

        # 2. Process
        table_data = process_records(records)
        
        # 3. Save Markdown
        if not table_data:
            print("⚠️ No valid records found to chart.")
        else:
            df = pd.DataFrame(table_data)
            df = df.sort_values(by=['Sport', 'Date'], ascending=[True, False])
            
            print(f"💾 Saving Markdown to {MD_OUTPUT}...")
            with open(MD_OUTPUT, 'w', encoding='utf-8') as f:
                f.write("# Personal Records 🏆\n\n")
                f.write(f"**Last Updated:** {date.today().isoformat()}\n\n")
                f.write(df.to_markdown(index=False))
                
        print("✅ Done.")
        
    except Exception as e:
        print(f"❌ Critical Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
