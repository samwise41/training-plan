import json
import os
import subprocess
from datetime import datetime

# --- CONFIGURATION ---
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
    try:
        s = float(duration_sec)
        n = float(np)
        f = float(ftp)
        if f == 0 or s == 0 or n == 0: return ""
        intensity_factor = n / f
        tss = (s * n * intensity_factor) / (f * 3600) * 100
        return f"{tss:.1f}"
    except: return ""

def main():
    print(f"--- 💧 HYDRATION & TSS REPAIR STARTED ---")
    
    if not os.path.exists(MASTER_DB): return

    ftp_hist = get_ftp_history()
    try:
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_data = json.load(f)
        garmin_lookup = {str(act['activityId']): act for act in garmin_data}
    except: garmin_lookup = {}

    with open(MASTER_DB, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    if len(lines) < 3: return

    header_line = lines[0].strip().strip('|')
    headers = [h.strip() for h in header_line.split('|')]
    
    try:
        idx_id = headers.index('activityId')
        idx_date = headers.index('Date')
        idx_match = headers.index('Match Status')
        idx_tss = headers.index('trainingStressScore')
        idx_np = headers.index('normPower')
        idx_hr = headers.index('averageHR')
        idx_dur = headers.index('duration') 
        idx_act_dur = headers.index('Actual Duration')
        idx_act_name = headers.index('Actual Workout')
        # Check Sport Type to avoid Running TSS errors
        idx_sport = headers.index('sportTypeId') 
    except: return

    updated_lines = lines[:2]
    updates = 0

    for line in lines[2:]:
        if '|' not in line: updated_lines.append(line); continue
        cols = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cols) < len(headers): cols += [''] * (len(headers) - len(cols))
        
        act_id = cols[idx_id]
        date_val = cols[idx_date]
        
        # A. HYDRATE
        if act_id and act_id in garmin_lookup:
            match = garmin_lookup[act_id]
            if cols[idx_match] == 'Manual' or not cols[idx_hr] or not cols[idx_np]:
                cols[idx_match] = 'Linked'
                cols[idx_act_name] = match.get('activityName', cols[idx_act_name])
                for i, h in enumerate(headers):
                    if h in match and not cols[i]: cols[i] = str(match[h])
                if 'duration' in match and not cols[idx_act_dur]:
                    try: cols[idx_act_dur] = f"{float(match['duration']) / 60:.1f}"
                    except: pass
                updates += 1

        # B. CALCULATE TSS (BIKE ONLY)
        tss_val = cols[idx_tss]
        np_val = cols[idx_np]
        sport_type = cols[idx_sport]
        
        # Only calculate if Sport Type is 2 (Cycling) or 5 (Virtual Ride sometimes)
        # Assuming 1 is Run, 2 is Bike based on your data
        is_bike = sport_type in ['2', '2.0', '5', '5.0'] 
        
        is_bad_tss = (tss_val in ['', 'nan', 'NaN', '0', '0.0', 'None'])
        
        if is_bike and is_bad_tss and np_val and np_val not in ['nan', '']:
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
                    print(f"   🧮 Calculated Bike TSS: {date_val} = {new_tss}")
                    updates += 1

        updated_lines.append("| " + " | ".join(cols) + " |\n")

    if updates > 0:
        print(f"\n💾 Saving {updates} updates...")
        with open(MASTER_DB, 'w', encoding='utf-8') as f:
            f.writelines(updated_lines)
        
        try:
            print("🐙 Pushing to GitHub...")
            subprocess.run(["git", "add", MASTER_DB], check=True, shell=True, cwd=SCRIPT_DIR)
            subprocess.run(["git", "commit", "-m", "Auto: Hydrated DB & Calculated Bike TSS"], check=True, shell=True, cwd=SCRIPT_DIR)
            subprocess.run(["git", "push"], check=True, shell=True, cwd=SCRIPT_DIR)
            print("✅ Success!")
        except Exception as e: print(f"⚠️ Push failed: {e}")
    else:
        print("✨ Database up to date.")

if __name__ == "__main__":
    main()
