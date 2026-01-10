import pandas as pd
import json
import os
import subprocess
from datetime import datetime

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MASTER_DB = os.path.join(SCRIPT_DIR, '..', 'MASTER_TRAINING_DATABASE.md')
GARMIN_JSON = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')
PLAN_FILE = os.path.join(SCRIPT_DIR, '..', 'endurance_plan.md')

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

def get_ftp_history():
    """Parses the Historical FTP Log from the endurance plan."""
    if not os.path.exists(PLAN_FILE):
        print("⚠️ Plan file not found, using default FTP.")
        return []

    ftp_log = []
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    in_table = False
    for line in lines:
        if "### Historical FTP Log" in line:
            in_table = True
            continue
        if in_table and line.strip().startswith('|') and "Date" not in line and "---" not in line:
            try:
                parts = [p.strip() for p in line.strip('|').split('|')]
                if len(parts) >= 2:
                    date_str = parts[0]
                    watts_str = parts[1].lower().replace('w', '').strip()
                    
                    # Parse Date (e.g., "Dec 23, 2025")
                    dt = datetime.strptime(date_str, "%b %d, %Y")
                    ftp = int(watts_str)
                    ftp_log.append((dt, ftp))
            except Exception as e:
                continue
        elif in_table and line.strip() == "":
            in_table = False
    
    # Sort by date descending (newest first)
    return sorted(ftp_log, key=lambda x: x[0], reverse=True)

def get_ftp_for_date(target_date, ftp_history):
    """Finds the active FTP for a specific date."""
    if isinstance(target_date, str):
        try:
            target_date = datetime.strptime(target_date, "%Y-%m-%d")
        except:
            return 241 # Default fallback if date parse fails

    for log_date, ftp in ftp_history:
        if log_date <= target_date:
            return ftp
    
    # If older than oldest log, return oldest known
    return ftp_history[-1][1] if ftp_history else 241

def calculate_tss(duration_sec, np, ftp):
    """Calculates TSS = (sec x NP x IF) / (FTP x 3600) x 100"""
    if not np or not duration_sec or not ftp: return ""
    try:
        s = float(duration_sec)
        n = float(np)
        f = float(ftp)
        if f == 0: return ""
        
        intensity_factor = n / f
        tss = (s * n * intensity_factor) / (f * 3600) * 100
        return f"{tss:.1f}"
    except:
        return ""

def main():
    print("--- 💧 STARTING DATABASE HYDRATION ---")
    
    # 1. Load Data
    header, rows = load_master_db()
    ftp_history = get_ftp_history()
    
    if not rows: return

    # 2. Load Garmin JSON
    try:
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)
        garmin_lookup = {str(act['activityId']): act for act in garmin_data}
    except Exception as e:
        print(f"❌ Could not load Garmin JSON: {e}")
        return

    updated_count = 0

    # 3. Process Rows
    for row in rows:
        act_id = str(row.get('activityId', '')).strip()
        match_status = row.get('Match Status', '')
        row_changed = False

        # A. HYDRATE MISSING DATA
        if act_id and act_id in garmin_lookup:
            match = garmin_lookup[act_id]
            
            # Check if we need to link/update basic stats
            if match_status == 'Manual' or not row.get('averageHR') or not row.get('normPower'):
                # print(f"🔗 Hydrating Activity ID: {act_id}")
                row['Match Status'] = 'Linked'
                row['Actual Workout'] = match.get('activityName', row['Actual Workout'])
                
                for col in header:
                    if col in match and not row.get(col): # Only fill if missing
                        row[col] = str(match[col])
                
                # Handle duration conversion
                if 'duration' in match and not row.get('Actual Duration'):
                    try:
                        row['Actual Duration'] = f"{float(match['duration']) / 60:.1f}"
                    except: pass
                
                row_changed = True

        # B. CALCULATE MISSING TSS (The Fix)
        # We check if TSS is missing/empty, but we have NP and Duration
        if not row.get('trainingStressScore') or row.get('trainingStressScore') == 'nan':
            np = row.get('normPower')
            # Duration in DB is minutes, we need seconds. 
            # Or retrieve from 'duration' col if it exists (usually hidden/raw seconds)
            dur_sec = row.get('duration') 
            date_str = row.get('Date')

            if np and dur_sec and date_str:
                # We have the ingredients!
                ftp = get_ftp_for_date(date_str, ftp_history)
                tss = calculate_tss(dur_sec, np, ftp)
                
                if tss:
                    print(f"🧮 Calculated TSS for {date_str}: {tss} (NP: {np}W, FTP: {ftp}W)")
                    row['trainingStressScore'] = tss
                    row_changed = True

        if row_changed:
            updated_count += 1

    if updated_count == 0:
        print("✨ No rows needed update.")
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
        subprocess.run(["git", "commit", "-m", "Auto: Calculated missing TSS for virtual rides"], check=True, shell=True, cwd=SCRIPT_DIR)
        subprocess.run(["git", "push"], check=True, shell=True, cwd=SCRIPT_DIR)
        print("✅ Done!")
    except Exception as e:
        print(f"⚠️ Saved locally, but Git push failed: {e}")

if __name__ == "__main__":
    main()
