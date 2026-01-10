import json
import os
import subprocess
from datetime import datetime

# --- CONFIGURATION ---
# Paths are relative to where the script runs
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MASTER_DB = os.path.join(SCRIPT_DIR, '..', 'MASTER_TRAINING_DATABASE.md')
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

def calculate_tss(duration_sec, np, ftp):
    """TSS = (sec x NP x IF) / (FTP x 3600) x 100"""
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
    print(f"--- 💧 HYDRATION & TSS REPAIR STARTED ---")
    
    if not os.path.exists(MASTER_DB):
        print("❌ Master DB not found!"); return

    # 1. Load Resources
    ftp_hist = get_ftp_history()
    try:
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)
        garmin_lookup = {str(act['activityId']): act for act in garmin_data}
    except: garmin_lookup = {}

    # 2. Read File Lines
    with open(MASTER_DB, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    if len(lines) < 3: return

    # 3. Parse Header
    header_line = lines[0].strip().strip('|')
    headers = [h.strip() for h in header_line.split('|')]
    
    # Map Indices
    try:
        # Core
        idx_id = headers.index('activityId')
        idx_date = headers.index('Date')
        idx_match = headers.index('Match Status')
        
        # Metrics
        idx_tss = headers.index('trainingStressScore')
        idx_np = headers.index('normPower')
        idx_hr = headers.index('averageHR')
        
        # Duration (Raw Seconds vs Display Minutes)
        idx_dur = headers.index('duration') 
        idx_act_dur = headers.index('Actual Duration')
        idx_act_name = headers.index('Actual Workout')
        
    except ValueError as e:
        print(f"❌ Missing critical column: {e}"); return

    updated_lines = lines[:2] # Preserve header & separator
    updates = 0

    # 4. Process Rows
    for line in lines[2:]:
        if '|' not in line: 
            updated_lines.append(line); continue

        cols = [c.strip() for c in line.strip().strip('|').split('|')]
        
        # Pad Columns
        if len(cols) < len(headers): cols += [''] * (len(headers) - len(cols))
        
        # Vars
        act_id = cols[idx_id]
        date_val = cols[idx_date]
        
        # --- A. HYDRATE FROM GARMIN (The Linker) ---
        if act_id and act_id in garmin_lookup:
            match = garmin_lookup[act_id]
            is_manual = (cols[idx_match] == 'Manual')
            missing_data = (not cols[idx_hr] or not cols[idx_np])
            
            if is_manual or missing_data:
                cols[idx_match] = 'Linked'
                cols[idx_act_name] = match.get('activityName', cols[idx_act_name])
                
                # Fill all matching columns
                for i, h in enumerate(headers):
                    if h in match and not cols[i]:
                        cols[i] = str(match[h])
                
                # Handle Duration Display (Sec -> Min)
                if 'duration' in match and not cols[idx_act_dur]:
                    try: cols[idx_act_dur] = f"{float(match['duration']) / 60:.1f}"
                    except: pass
                
                updates += 1

        # --- B. CALCULATE TSS (The Fix) ---
        tss_val = cols[idx_tss]
        np_val = cols[idx_np]
        
        is_bad_tss = (tss_val in ['', 'nan', 'NaN', '0', '0.0', 'None'])
        
        if is_bad_tss and np_val and np_val not in ['nan', '']:
            # Get Duration in Seconds
            sec = 0
            if cols[idx_dur] and cols[idx_dur] != 'nan':
                try: sec = float(cols[idx_dur])
                except: pass
            elif cols[idx_act_dur] and cols[idx_act_dur] != 'nan':
                try: sec = float(cols[idx_act_dur]) * 60
                except: pass
            
            if sec > 0:
                ftp = get_ftp(date_val, ftp_hist)
                new_tss = calculate_tss(sec, np_val, ftp)
                if new_tss and new_tss != "0.0":
                    cols[idx_tss] = new_tss
                    print(f"   🧮 Calculated TSS: {date_val} = {new_tss}")
                    updates += 1

        # Rebuild Line
        updated_lines.append("| " + " | ".join(cols) + " |\n")

    # 5. Save & Push
    if updates > 0:
        print(f"\n💾 Saving {updates} updates...")
        with open(MASTER_DB, 'w', encoding='utf-8') as f:
            f.writelines(updated_lines)
        
        try:
            print("🐙 Pushing to GitHub...")
            subprocess.run(["git", "add", MASTER_DB], check=True, shell=True, cwd=SCRIPT_DIR)
            subprocess.run(["git", "commit", "-m", "Auto: Hydrated DB & Calculated TSS"], check=True, shell=True, cwd=SCRIPT_DIR)
            subprocess.run(["git", "push"], check=True, shell=True, cwd=SCRIPT_DIR)
            print("✅ Success! Changes are live.")
        except Exception as e:
            print(f"⚠️ Saved locally, but Push failed: {e}")
    else:
        print("✨ Database is already up to date.")

if __name__ == "__main__":
    main()
