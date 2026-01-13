import pandas as pd
import json
import os
import subprocess

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Move up one level from python/ to root, then find the MD file
ROOT_DIR = os.path.dirname(SCRIPT_DIR) 
MASTER_DB = os.path.join(ROOT_DIR, 'MASTER_TRAINING_DATABASE.md')
GARMIN_JSON = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')

def load_master_db():
    if not os.path.exists(MASTER_DB):
        print(f"❌ Master Database not found at: {MASTER_DB}")
        return None, []
    
    with open(MASTER_DB, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if len(lines) < 3: return None, []

    # Clean headers
    header = [h.strip() for h in lines[0].strip().strip('|').split('|')]
    data = []
    for line in lines[2:]:
        if '|' not in line: continue
        # Split and clean cells
        row_vals = [c.strip() for c in line.strip().strip('|').split('|')]
        # Ensure row matches header length
        if len(row_vals) < len(header): 
            row_vals += [''] * (len(header) - len(row_vals))
        
        row_dict = dict(zip(header, row_vals))
        data.append(row_dict)
        
    return header, data

def main():
    print("--- 💧 STARTING SMART HYDRATION (GAP FILL ONLY) ---")
    
    # 1. Load Master DB
    header, rows = load_master_db()
    if not rows: return

    # 2. Load Garmin JSON
    try:
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)
        # Create a dictionary for fast ID lookup
        garmin_lookup = {str(act['activityId']): act for act in garmin_data}
        print(f"✅ Loaded {len(garmin_lookup)} activities from Garmin JSON.")
    except Exception as e:
        print(f"❌ Could not load Garmin JSON: {e}")
        return

    updated_count = 0

    # 3. Process Rows
    for row in rows:
        act_id = str(row.get('activityId', '')).strip()
        
        # Skip if no ID
        if not act_id: continue

        # Check if we have data for this ID
        if act_id in garmin_lookup:
            match = garmin_lookup[act_id]
            row_was_modified = False
            
            # --- STATUS CHECK ---
            # Always ensure status is Linked if we found the ID
            if row.get('Match Status') != 'Linked':
                row['Match Status'] = 'Linked'
                row_was_modified = True

            # --- NAME ENHANCEMENT ---
            # Special case: If name is generic "Virtual Cycling", allow overwrite
            current_name = row.get('Actual Workout', '')
            if not current_name or current_name == 'Virtual Cycling':
                new_name = match.get('activityName')
                if new_name and new_name != current_name:
                    row['Actual Workout'] = new_name
                    row_was_modified = True

            # --- GAP FILLING LOOP ---
            # Iterate through all other columns. 
            # ONLY update if the database value is currently EMPTY/NULL.
            for col in header:
                # Skip columns we already handled or want to protect explicitly
                if col in ['Match Status', 'Actual Workout', 'Notes / Targets']:
                    continue

                if col in match and match[col] is not None:
                    db_val = str(row.get(col, '')).strip()
                    
                    # STRICT RULE: Only update if DB is empty
                    if not db_val:
                        # Special formatting for Duration (Seconds -> Minutes)
                        if col == 'Actual Duration' and 'duration' in match:
                             try:
                                 row[col] = f"{float(match['duration']) / 60:.1f}"
                                 row_was_modified = True
                             except: pass
                        else:
                            # Standard fields (Cadence, Power, HR, etc)
                            row[col] = str(match[col])
                            row_was_modified = True

            if row_was_modified:
                print(f"🔗 Updated ID: {act_id} | {row.get('Actual Workout')}")
                updated_count += 1

    if updated_count == 0:
        print("✨ No missing data found. Your corrections are safe!")
        return

    # 4. Save Changes
    print(f"💾 Saving {updated_count} records (preserving existing data)...")
    try:
        with open(MASTER_DB, 'w', encoding='utf-8') as f:
            # Reconstruct Table
            f.write("| " + " | ".join(header) + " |\n")
            f.write("| " + " | ".join(['---'] * len(header)) + " |\n")
            for row in rows:
                # Ensure we write values in the correct column order
                vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in header]
                f.write("| " + " | ".join(vals) + " |\n")
        print("✅ File saved successfully.")
    except Exception as e:
        print(f"❌ Error saving file: {e}")
        return

    # 5. Push to GitHub
    try:
        print("🐙 Pushing updates to GitHub...")
        subprocess.run(f'git add "{MASTER_DB}"', check=True, shell=True, cwd=ROOT_DIR)
        subprocess.run('git commit -m "Manual Hydration: Filled missing metrics only"', check=True, shell=True, cwd=ROOT_DIR)
        subprocess.run("git push", check=True, shell=True, cwd=ROOT_DIR)
        print("✅ Git push successful!")
    except Exception as e:
        print(f"⚠️ Saved locally, but Git push failed: {e}")

if __name__ == "__main__":
    main()
