import pandas as pd
import json
import os
import subprocess

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MASTER_DB = os.path.join(SCRIPT_DIR, 'MASTER_TRAINING_DATABASE.md')
GARMIN_JSON = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')

def load_master_db():
    if not os.path.exists(MASTER_DB):
        print("❌ Master Database not found.")
        return None, []
    
    with open(MASTER_DB, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if len(lines) < 3: return None, []

    header = [h.strip() for h in lines[0].strip('|').split('|')]
    data = []
    for line in lines[2:]:
        if '|' not in line: continue
        row = [c.strip() for c in line.strip('|').split('|')]
        if len(row) < len(header): row += [''] * (len(header) - len(row))
        data.append(dict(zip(header, row)))
        
    return header, data

def main():
    print("--- 💧 STARTING DATABASE HYDRATION ---")
    
    # 1. Load Master DB
    header, rows = load_master_db()
    if not rows: return

    # 2. Load Garmin JSON
    try:
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)
        # Create a dictionary for fast ID lookup
        garmin_lookup = {str(act['activityId']): act for act in garmin_data}
    except Exception as e:
        print(f"❌ Could not load Garmin JSON: {e}")
        return

    updated_count = 0

    # 3. Process Rows
    for row in rows:
        act_id = str(row.get('activityId', '')).strip()
        match_status = row.get('Match Status', '')

        # Criteria: Has an ID, but isn't fully linked yet
        if act_id and (match_status == 'Manual' or not row.get('averageHR')):
            if act_id in garmin_lookup:
                print(f"🔗 Hydrating Activity ID: {act_id} ({row.get('Planned Workout')})")
                match = garmin_lookup[act_id]
                
                # Update row with Garmin data
                row['Match Status'] = 'Linked'
                row['Actual Workout'] = match.get('activityName', row['Actual Workout'])
                
                for col in header:
                    if col in match:
                        row[col] = str(match[col])
                
                # Handle duration conversion
                if 'duration' in match:
                    try:
                        row['Actual Duration'] = f"{float(match['duration']) / 60:.1f}"
                    except: pass
                
                updated_count += 1

    if updated_count == 0:
        print("✨ No rows needed hydration. Everything is in sync!")
        return

    # 4. Save Changes
    print(f"💾 Saving {updated_count} updated records...")
    with open(MASTER_DB, 'w', encoding='utf-8') as f:
        f.write("| " + " | ".join(header) + " |\n")
        f.write("| " + " | ".join(['---'] * len(header)) + " |\n")
        for row in rows:
            vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in header]
            f.write("| " + " | ".join(vals) + " |\n")

    # 5. Push to GitHub
    try:
        print("🐙 Pushing updates to GitHub...")
        subprocess.run(["git", "add", MASTER_DB], check=True, shell=True, cwd=SCRIPT_DIR)
        subprocess.run(["git", "commit", "-m", "Manual Hydration: Linked Garmin IDs"], check=True, shell=True, cwd=SCRIPT_DIR)
        subprocess.run(["git", "push"], check=True, shell=True, cwd=SCRIPT_DIR)
        print("✅ Done!")
    except Exception as e:
        print(f"⚠️ Saved locally, but Git push failed: {e}")

if __name__ == "__main__":
    main()
    input("\nPress Enter to exit...")