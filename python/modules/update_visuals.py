import os
# We remove pandas dependency to keep it lightweight and compatible with the list object
try:
    from . import config
except ImportError:
    import config

def update_weekly_plan(db_data):
    """
    Updates the 'endurance_plan.md' Weekly Schedule table 
    based on the completions found in the JSON database (db_data).
    """
    if not os.path.exists(config.PLAN_FILE): 
        print("⚠️ Plan file not found.")
        return

    print("🎨 UPDATING VISUALS: Syncing JSON DB to Plan Markdown...")
    
    # 1. Create a Lookup Dictionary
    # Key: (DateString, SportType) -> Value: (ActualName, ActualDuration, Status)
    lookup = {}
    
    for record in db_data:
        # We only update the visual schedule if the record is COMPLETED
        if record.get('status') != 'COMPLETED': 
            continue
            
        date_str = record.get('date') # Expected: YYYY-MM-DD
        
        # Determine Sport Tag (must match the [TAG] in markdown)
        # JSON has "Bike", "Run", "Swim". We map to "BIKE", "RUN", "SWIM"
        sport = record.get('plannedSport') or record.get('actualSport')
        if not sport: continue
        
        sport_key = sport.upper() # "BIKE", "RUN", "SWIM"
        
        # Get Display Data
        act_name = record.get('actualWorkout', '') or "Completed"
        
        # Format Duration (e.g., 60.5 -> "60.5")
        raw_dur = record.get('actualDuration')
        if raw_dur is not None:
            act_dur = str(round(float(raw_dur), 1))
        else:
            act_dur = "-"
            
        # Store in Lookup
        lookup[(date_str, sport_key)] = (act_name, act_dur)

    # 2. Read and Modify the Markdown File
    with open(config.PLAN_FILE, 'r', encoding='utf-8') as f: 
        lines = f.readlines()
        
    new_lines = []
    in_schedule_table = False
    headers = {}
    
    for line in lines:
        stripped = line.strip()
        
        # A. Detect Start of Weekly Schedule Table
        if '|' in stripped and 'date' in stripped.lower() and 'planned workout' in stripped.lower():
            in_schedule_table = True
            # Map column indices dynamically
            cols = [c.strip().lower() for c in stripped.strip('|').split('|')]
            for i, c in enumerate(cols):
                if 'date' in c: headers['date'] = i
                elif 'planned workout' in c: headers['planned'] = i
                elif 'actual workout' in c: headers['actual'] = i
                elif 'actual duration' in c: headers['duration'] = i
                elif 'status' in c: headers['status'] = i
            new_lines.append(line)
            continue
            
        # B. Process Table Rows
        if in_schedule_table:
            # Check if we hit the end of the table (empty line or new header)
            if stripped == "" or (not stripped.startswith('|')):
                in_schedule_table = False
                new_lines.append(line)
                continue
                
            if '---' in stripped: # Skip separator line
                new_lines.append(line)
                continue
                
            # Parse the Row
            row_cols = [c.strip() for c in stripped.strip('|').split('|')]
            
            # Ensure row has enough columns to be valid
            if 'date' in headers and 'planned' in headers and len(row_cols) > max(headers.values()):
                try:
                    row_date = row_cols[headers['date']]
                    row_plan = row_cols[headers['planned']].upper()
                    
                    # Detect Tag in Markdown (e.g. "[BIKE]")
                    row_sport = None
                    if '[BIKE]' in row_plan: row_sport = 'BIKE'
                    elif '[RUN]' in row_plan: row_sport = 'RUN'
                    elif '[SWIM]' in row_plan: row_sport = 'SWIM'
                    
                    # Check if we have new data for this slot
                    if (row_date, row_sport) in lookup:
                        act_name, act_dur = lookup[(row_date, row_sport)]
                        
                        # UPDATE THE COLUMNS
                        if 'status' in headers: row_cols[headers['status']] = "COMPLETED"
                        if 'actual' in headers: row_cols[headers['actual']] = act_name
                        if 'duration' in headers: row_cols[headers['duration']] = act_dur
                        
                        # Reconstruct Line
                        new_line = "| " + " | ".join(row_cols) + " |\n"
                        new_lines.append(new_line)
                    else:
                        new_lines.append(line) # No update needed
                except:
                    new_lines.append(line) # Parsing error protection
            else:
                new_lines.append(line) # Malformed row protection
        else:
            # Not in table, just copy
            new_lines.append(line)

    # 3. Write Back to File
    with open(config.PLAN_FILE, 'w', encoding='utf-8') as f: 
        f.writelines(new_lines)
    
    print("✅ Visuals updated in endurance_plan.md")
