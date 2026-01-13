import json
import os
import subprocess

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR) 
MASTER_DB = os.path.join(ROOT_DIR, 'MASTER_TRAINING_DATABASE.md')
GARMIN_JSON = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')

def load_master_db():
    if not os.path.exists(MASTER_DB):
        return None, []
    
    with open(MASTER_DB, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if len(lines) < 3: return None, []

    # Clean headers
    header = [h.strip() for h in lines[0].strip().strip('|').split('|')]
    data = []
    for line in lines[2:]:
        if '|' not in line: continue
        row_vals = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(row_vals) < len(header): 
            row_vals += [''] * (len(header) - len(row_vals))
        data.append(dict(zip(header, row_vals)))
        
    return header, data

def main():
    print("--- 💧 HYDRATING RPE & FEELING ---")
    
    header, rows = load_master_db()
    if not rows: return

    try:
        with open(GARMIN_JSON, 'r', encoding='utf-8') as f:
            garmin_lookup = {str(act['activityId']): act for act in json.load(f)}
    except:
        return

    updated_count = 0

    for row in rows:
        act_id = str(row.get('activityId', '')).strip()
        if not act_id or act_id not in garmin_lookup: continue

        match = garmin_lookup[act_id]
        row_modified = False

        for col in header:
            # 1. Map Columns to JSON Keys
            json_key = col
            if col == 'RPE': json_key = 'perceivedEffort'
            if col == 'Feeling': json_key = 'feeling'
            if col == 'Actual Duration': json_key = 'duration' # Special case

            # 2. Update if JSON has data and DB is empty
            if json_key in match and match[json_key] is not None:
                db_val = str(row.get(col, '')).strip()
                
                if not db_val:
                    val_to_write = match[json_key]
                    
                    # Formatting tweaks
                    if col == 'Actual Duration':
                        val_to_write = f"{float(val_to_write) / 60:.1f}"
                    
                    row[col] = str(val_to_write)
                    row_modified = True

        if row_modified:
            updated_count += 1

    if updated_count > 0:
        print(f"💾 Saving {updated_count} updates...")
        with open(MASTER_DB, 'w', encoding='utf-8') as f:
            f.write("| " + " | ".join(header) + " |\n")
            f.write("| " + " | ".join(['---'] * len(header)) + " |\n")
            for row in rows:
                vals = [str(row.get(c, "")).replace('\n', ' ').replace('|', '/') for c in header]
                f.write("| " + " | ".join(vals) + " |\n")
        
        # Git Push
        try:
            subprocess.run(f'git add "{MASTER_DB}"', shell=True, cwd=ROOT_DIR)
            subprocess.run('git commit -m "Hydrate: Added RPE and Feeling"', shell=True, cwd=ROOT_DIR)
            subprocess.run("git push", shell=True, cwd=ROOT_DIR)
            print("✅ Pushed to GitHub.")
        except: pass
    else:
        print("✨ No new data to merge.")

if __name__ == "__main__":
    main()
