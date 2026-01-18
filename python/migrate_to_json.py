import pandas as pd
import json
import os
import re
import ast
import numpy as np

# --- CONFIGURATION ---
INPUT_FILE = 'python/MASTER_TRAINING_DATABASE.md'
OUTPUT_FILE = 'data/training_log.json'

def normalize_sport(val, activity_type=None):
    """
    Strictly categorizes sports into 'Bike', 'Run', 'Swim', or None.
    NO 'Other', NO 'Strength', NO fallbacks.
    """
    val = str(val).upper() if val else ""
    act_type = str(activity_type).upper() if activity_type else ""
    
    # 1. Check strict Activity Types from Garmin/Strava first
    if 'RIDE' in act_type or 'CYCL' in act_type or 'BIKING' in act_type:
        return 'Bike'
    if 'RUN' in act_type:
        return 'Run'
    if 'SWIM' in act_type or 'POOL' in act_type:
        return 'Swim'

    # 2. Check text tags in the name (e.g., "[RUN]")
    if '[BIKE]' in val or 'ZWIFT' in val or 'CYCLING' in val:
        return 'Bike'
    if '[RUN]' in val or 'RUNNING' in val:
        return 'Run'
    if '[SWIM]' in val or 'SWIMMING' in val:
        return 'Swim'
        
    return None

def clean_numeric(val):
    """
    Converts strings to floats/ints. Handles 'nan', empty strings, and weird text.
    """
    if val is None or val == "":
        return None
    s_val = str(val).strip()
    if s_val.lower() == 'nan':
        return None
    try:
        # Return float first, let frontend formatting handle decimals
        return float(s_val)
    except ValueError:
        return None

def parse_markdown_table(file_path):
    if not os.path.exists(file_path):
        print(f"❌ Error: File {file_path} not found.")
        return []

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find the header line
    header_line = None
    start_index = 0
    for i, line in enumerate(lines):
        if '|' in line and 'Date' in line:
            header_line = line
            start_index = i + 2 # Skip header and separator line
            break
    
    if not header_line:
        print("❌ Error: Could not find table header.")
        return []

    headers = [h.strip() for h in header_line.strip().strip('|').split('|')]
    
    records = []
    for line in lines[start_index:]:
        if '|' not in line: continue
        
        # Extract cells
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        
        # Pad with empty strings if row is shorter than header
        if len(cells) < len(headers):
            cells += [''] * (len(headers) - len(cells))
            
        row_dict = dict(zip(headers, cells))
        records.append(row_dict)
        
    return records

def migrate():
    print(f"🚀 Starting Migration: {INPUT_FILE} -> {OUTPUT_FILE}")
    
    raw_data = parse_markdown_table(INPUT_FILE)
    cleaned_data = []
    
    stats = {"Bike": 0, "Run": 0, "Swim": 0, "Ignored": 0}

    for row in raw_data:
        # 1. Basic Cleaning
        date_str = row.get('Date', '').strip()
        if not date_str or date_str == 'nan':
            continue

        # 2. Strict Sport Typing
        planned_sport = normalize_sport(row.get('Planned Workout', ''))
        
        # Clean activity type (sometimes it's a dict string)
        act_type_raw = row.get('activityType', '')
        if act_type_raw.startswith('{'):
            try:
                act_dict = ast.literal_eval(act_type_raw)
                act_type_clean = act_dict.get('typeKey', '')
            except:
                act_type_clean = act_type_raw
        else:
            act_type_clean = act_type_raw

        actual_sport = normalize_sport(row.get('Actual Workout', ''), act_type_clean)

        # Update stats
        if actual_sport:
            stats[actual_sport] += 1
        else:
            stats['Ignored'] += 1

        # 3. Construct New JSON Object (CamelCase Keys)
        new_record = {
            "id": row.get('activityId', ''),
            "date": date_str,  # Strict YYYY-MM-DD
            "status": row.get('Status', 'Pending'),
            "day": row.get('Day', ''),
            
            # Categorization
            "plannedSport": planned_sport,
            "actualSport": actual_sport,
            
            # Workout Details
            "plannedWorkout": row.get('Planned Workout', ''),
            "plannedDuration": clean_numeric(str(row.get('Planned Duration', '')).replace(' mins', '').replace(' min', '')),
            "actualWorkout": row.get('Actual Workout', ''),
            "actualDuration": clean_numeric(row.get('Actual Duration', '')),
            "notes": row.get('Notes / Targets', ''),
            
            # Metrics (Strict Numbers)
            "distance": clean_numeric(row.get('distance')),
            "movingTime": clean_numeric(row.get('duration')), # Assuming duration is seconds
            "avgHr": clean_numeric(row.get('averageHR')),
            "maxHr": clean_numeric(row.get('maxHR')),
            "avgPower": clean_numeric(row.get('avgPower')),
            "normPower": clean_numeric(row.get('normPower')),
            "tss": clean_numeric(row.get('trainingStressScore')),
            "if": clean_numeric(row.get('intensityFactor')),
            "calories": clean_numeric(row.get('calories')),
            "elevation": clean_numeric(row.get('elevationGain')),
            "rpe": clean_numeric(row.get('RPE')),
            "feeling": clean_numeric(row.get('Feeling'))
        }
        
        cleaned_data.append(new_record)

    # 4. Write to JSON
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, indent=2)

    print("✅ Migration Complete!")
    print(f"📊 Stats: {json.dumps(stats, indent=2)}")
    print(f"💾 File saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    migrate()
