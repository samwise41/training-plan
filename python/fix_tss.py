import os
from datetime import datetime

# --- CONFIGURATION ---
# Adjust path if your structure is different
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MASTER_DB = os.path.join(SCRIPT_DIR, '..', 'MASTER_TRAINING_DATABASE.md')
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

def main():
    print(f"📂 Reading: {MASTER_DB}")
    if not os.path.exists(MASTER_DB):
        print("❌ File not found!"); return

    with open(MASTER_DB, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    if len(lines) < 3: print("❌ File empty"); return

    # Parse Header
    header_line = lines[0].strip().strip('|')
    headers = [h.strip() for h in header_line.split('|')]
    print(f"📊 Found Columns: {headers}")

    # Indicies
    try:
        idx_tss = headers.index('trainingStressScore')
        idx_np = headers.index('normPower')
        idx_dur = headers.index('duration')
        idx_act_dur = headers.index('Actual Duration')
        idx_date = headers.index('Date')
    except ValueError as e:
        print(f"❌ Missing Column: {e}"); return

    ftp_hist = get_ftp_history()
    print(f"💪 FTP History Loaded: {len(ftp_hist)} entries")

    updated_lines = lines[:2] # Keep header/separator
    updates = 0

    # Process Data
    for i, line in enumerate(lines[2:]):
        if '|' not in line: 
            updated_lines.append(line)
            continue

        cols = [c.strip() for c in line.strip().strip('|').split('|')]
        
        # Pad columns if short
        if len(cols) < len(headers):
            cols += [''] * (len(headers) - len(cols))

        # Get Values
        date_val = cols[idx_date]
        tss_val = cols[idx_tss]
        np_val = cols[idx_np]
        dur_val = cols[idx_dur]
        act_dur_val = cols[idx_act_dur]

        # DEBUG: Check specific problematic date
        if date_val == '2026-01-05':
            print(f"\n🔍 DEBUG ROW ({date_val}):")
            print(f"   Current TSS: '{tss_val}'")
            print(f"   NP: '{np_val}'")
            print(f"   Duration (sec): '{dur_val}'")
            print(f"   Act Duration (min): '{act_dur_val}'")

        # LOGIC: If TSS is bad AND we have NP
        is_bad_tss = (tss_val in ['', 'nan', 'NaN', '0', '0.0', 'None'])
        
        if is_bad_tss and np_val and np_val not in ['nan', '']:
            try:
                # 1. Get Duration (Seconds)
                sec = 0
                if dur_val and dur_val != 'nan':
                    sec = float(dur_val)
                elif act_dur_val and act_dur_val != 'nan':
                    sec = float(act_dur_val) * 60 # Convert min to sec

                # 2. Calculate
                if sec > 0:
                    ftp = get_ftp(date_val, ftp_hist)
                    np = float(np_val)
                    if ftp > 0:
                        intensity = np / ftp
                        new_tss = (sec * np * intensity) / (ftp * 3600) * 100
                        
                        cols[idx_tss] = f"{new_tss:.1f}"
                        updates += 1
                        print(f"   ✅ FIXED: {date_val} -> TSS {cols[idx_tss]} (NP {np} / FTP {ftp})")
            except Exception as e:
                print(f"   ⚠️ Calc Failed for {date_val}: {e}")

        # Reconstruct Line
        updated_lines.append("| " + " | ".join(cols) + " |\n")

    if updates > 0:
        print(f"\n💾 Saving {updates} fixes...")
        with open(MASTER_DB, 'w', encoding='utf-8') as f:
            f.writelines(updated_lines)
        print("✅ File Updated.")
    else:
        print("\n✨ No updates needed.")

if __name__ == "__main__":
    main()
