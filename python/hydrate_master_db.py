import pandas as pd
import json
import os
import subprocess
from datetime import datetime

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MASTER_DB = os.path.join(SCRIPT_DIR, 'MASTER_TRAINING_DATABASE.md')
GARMIN_JSON = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')
PLAN_FILE = os.path.join(SCRIPT_DIR, '..', 'endurance_plan.md')

def get_ftp_history():
    """Parses FTP history from plan."""
    default_ftp = 241
    if not os.path.exists(PLAN_FILE):
        return [(datetime.now(), default_ftp)]

    ftp_log = []
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    in_table = False
    for line in lines:
        if "### Historical FTP Log" in line: in_table = True; continue
        if in_table and line.strip().startswith('|') and "Date" not in line and "---" not in line:
            try:
                parts = [p.strip() for p in line.strip('|').split('|')]
                if len(parts) >= 2:
                    dt = datetime.strptime(parts[0], "%b %d, %Y")
                    ftp = int(parts[1].lower().replace('w', '').strip())
                    ftp_log.append((dt, ftp))
            except: continue
        elif in_table and line.strip() == "": in_table = False
    
    return sorted(ftp_log, key=lambda x: x[0], reverse=True) or [(datetime.now(), default_ftp)]

def get_ftp(date_str, history):
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d")
        for d, f in history:
            if d <= target: return f
        return history[-1][1]
    except: return 241

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
    
    # 3. Load FTP History
    ftp_history = get_ftp_history()
    print(f"💪 FTP History Loaded: {len(ftp_history)} entries")

    updated_count = 0

    # 4. Process Rows
    for row in rows:
        act_id = str(row.get('activityId', '')).strip()
        match_status = row.get('Match Status', '')
        
        # Check if TSS is missing/zero
        current_tss = row.get('trainingStressScore', '')
        has_tss = False
        try:
            if float(current_tss) > 0.1: has_tss = True
        except: pass

        # Criteria: Has ID AND (Is Manual, OR Missing Data, OR Missing TSS)
        should_process = act_id and (match_status == 'Manual' or not row.get('averageHR') or not has_tss)

        if should_process and act_id in garmin_lookup:
            print(f"🔗 Hydrating Activity ID: {act_id} ({row.get('Planned Workout')})")
            match = garmin_lookup[act_id]
            
            # Update row with Garmin data
            row['Match Status'] = 'Linked'
            row['Actual Workout'] = match.get('activityName', row['Actual Workout'])
            
            for col in header:
                if col in match:
                    val = str(match[col])
                    if val != 'None':
                        row[col] = val
            
            # Handle duration conversion (Seconds -> Minutes for display)
            duration_sec = 0.0
            if 'duration' in match:
                try:
                    duration_sec = float(match['duration'])
                    row['Actual Duration'] = f"{duration_sec / 60:.1f}"
                except: pass

            # --- TSS CALCULATION FIX ---
            # Re-check TSS after hydration
            try:
                tss_val = float(row.get('trainingStressScore', 0) or 0)
            except: tss_val = 0
            
            # If Garmin didn't provide TSS (value is 0/missing), try to calculate it
            if tss_val < 0.1:
                np_val = row.get('normPower', '')
                date_val = row.get('Date', '')
                
                # If Date missing in row, try match
                if not date_val and 'startTimeLocal' in match:
                    date_val = match['startTimeLocal'][:10]

                # We need NP, Duration (sec), and Date
                if np_val and np_val not in ['nan', 'None', ''] and duration_sec > 0 and date_val:
                    try:
                        np = float(np_val)
                        ftp = get_ftp(date_val, ftp_history)
                        if ftp > 0:
                            intensity = np / ftp
                            new_tss = (duration_sec * np * intensity) / (ftp * 3600) * 100
                            row['trainingStressScore'] = f"{new_tss:.1f}"
                            print(f"   + 🧮 Calculated TSS: {row['trainingStressScore']} (NP: {np}, FTP: {ftp})")
                    except Exception as e:
                        print(f"   ⚠️ Could not calc TSS: {e}")

            updated_count += 1

    if updated_count == 0:
        print("✨ No rows needed hydration. Everything is in sync!")
        return

    # 5. Save Changes
    print(f"💾 Saving {updated_count} updated records...")
    with open(MASTER_DB, 'w', encoding='utf-8') as f:
        f.write("| " + " | ".join(header) + " |\n")
        f.write("| " + " | ".join(['---'] * len(header)) + " |\n")
        for row in rows:
            vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in header]
            f.write("| " + " | ".join(vals) + " |\n")

    # 6. Push to GitHub
    try:
        print("🐙 Pushing updates to GitHub...")
        subprocess.run(["git", "add", MASTER_DB], check=True, shell=True, cwd=SCRIPT_DIR)
        subprocess.run(["git", "commit", "-m", "Manual Hydration: Linked Garmin IDs + Calculated TSS"], check=True, shell=True, cwd=SCRIPT_DIR)
        subprocess.run(["git", "push"], check=True, shell=True, cwd=SCRIPT_DIR)
        print("✅ Done!")
    except Exception as e:
        print(f"⚠️ Saved locally, but Git push failed: {e}")

if __name__ == "__main__":
    main()
