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

    # Clean header splitting
    header = [h.strip() for h in lines[0].strip().strip('|').split('|')]
    data = []
    for line in lines[2:]:
        if '|' not in line: continue
        # Split and clean whitespace from every cell
        row = [c.strip() for c in line.strip().strip('|').split('|')]
        
        # Ensure row fits header
        if len(row) < len(header): 
            row += [''] * (len(header) - len(row))
        elif len(row) > len(header):
            row = row[:len(header)]
            
        data.append(dict(zip(header, row)))
        
    return header, data

def get_ftp_history():
    """Parses the Historical FTP Log from the endurance plan."""
    default_ftp = 241
    if not os.path.exists(PLAN_FILE):
        print("⚠️ Plan file not found, using default FTP.")
        return [(datetime.now(), default_ftp)]

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
                    dt = datetime.strptime(date_str, "%b %d, %Y")
                    ftp = int(watts_str)
                    ftp_log.append((dt, ftp))
            except: continue
        elif in_table and line.strip() == "":
            in_table = False
    
    if not ftp_log:
        return [(datetime.now(), default_ftp)]
        
    return sorted(ftp_log, key=lambda x: x[0], reverse=True)

def get_ftp_for_date(target_date, ftp_history):
    if isinstance(target_date, str):
        try:
            target_date = datetime.strptime(target_date, "%Y-%m-%d")
        except:
            return 241 

    for log_date, ftp in ftp_history:
        if log_date <= target_date:
            return ftp
    return ftp_history[-1][1]

def calculate_tss(duration_sec, np, ftp):
    try:
        s = float(duration_sec)
        n = float(np)
        f = float(ftp)
        if f == 0 or s == 0 or n == 0: return ""
        
        intensity_factor = n / f
        tss = (s * n * intensity_factor) / (f * 3600) * 100
        return f"{tss:.1f}"
    except:
        return ""

def main():
    print("--- 💧 STARTING DATABASE HYDRATION (TSS FIX) ---")
    
    header, rows = load_master_db()
    ftp_history = get_ftp_history()
    print(f"📈 Loaded FTP History: {len(ftp_history)} entries")
    
    if not rows: return

    try:
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)
        garmin_lookup = {str(act['activityId']): act for act in garmin_data}
    except:
        garmin_lookup = {}

    updated_count = 0

    for i, row in enumerate(rows):
        row_changed = False
        
        # 1. LINKING (Existing Logic)
        act_id = str(row.get('activityId', '')).strip()
        match_status = row.get('Match Status', '')
        
        if act_id and act_id in garmin_lookup:
            match = garmin_lookup[act_id]
            if match_status == 'Manual' or not row.get('averageHR') or not row.get('normPower'):
                row['Match Status'] = 'Linked'
                row['Actual Workout'] = match.get('activityName', row['Actual Workout'])
                for col in header:
                    if col in match and not row.get(col):
                        row[col] = str(match[col])
                if 'duration' in match and not row.get('Actual Duration'):
                    try:
                        row['Actual Duration'] = f"{float(match['duration']) / 60:.1f}"
                    except: pass
                row_changed = True

        # 2. TSS CALCULATION (The Fix)
        current_tss = str(row.get('trainingStressScore', '')).strip().lower()
        
        # Check if TSS is missing, empty, "nan", or "0"
        if not current_tss or current_tss == 'nan' or current_tss == '0' or current_tss == '0.0':
            
            np = str(row.get('normPower', '')).strip()
            date_str = str(row.get('Date', '')).strip()
            
            # Duration Strategy: Try 'duration' (seconds), fallback to 'Actual Duration' (minutes)
            dur_sec = str(row.get('duration', '')).strip()
            dur_min = str(row.get('Actual Duration', '')).strip()
            
            final_dur_sec = 0
            
            if dur_sec and dur_sec != 'nan':
                try: final_dur_sec = float(dur_sec)
                except: pass
            
            if final_dur_sec == 0 and dur_min and dur_min != 'nan':
                try: final_dur_sec = float(dur_min) * 60
                except: pass

            if np and np != 'nan' and final_dur_sec > 0 and date_str:
                ftp = get_ftp_for_date(date_str, ftp_history)
                new_tss = calculate_tss(final_dur_sec, np, ftp)
                
                if new_tss and new_tss != "0.0":
                    print(f"🧮 {date_str}: Calc TSS {new_tss} (NP:{np}W | Dur:{int(final_dur_sec)}s | FTP:{ftp}W)")
                    row['trainingStressScore'] = new_tss
                    row_changed = True

        if row_changed:
            updated_count += 1

    if updated_count == 0:
        print("✨ No rows needed update.")
        return

    print(f"💾 Saving {updated_count} updated records...")
    with open(MASTER_DB, 'w', encoding='utf-8') as f:
        # Reconstruct table with strict formatting
        f.write("| " + " | ".join(header) + " |\n")
        f.write("| " + " | ".join(['---'] * len(header)) + " |\n")
        for row in rows:
            # Ensure every column is present and stringified
            vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in header]
            f.write("| " + " | ".join(vals) + " |\n")

    try:
        print("🐙 Pushing updates to GitHub...")
        subprocess.run(["git", "add", MASTER_DB], check=True, shell=True, cwd=SCRIPT_DIR)
        subprocess.run(["git", "commit", "-m", "Auto: Calculated missing TSS"], check=True, shell=True, cwd=SCRIPT_DIR)
        subprocess.run(["git", "push"], check=True, shell=True, cwd=SCRIPT_DIR)
        print("✅ Done!")
    except Exception as e:
        print(f"⚠️ Saved locally, but Git push failed: {e}")

if __name__ == "__main__":
    main()
