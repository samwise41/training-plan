import pandas as pd
import numpy as np
import json
import os
import re
import ast
from datetime import datetime
from . import config # Import settings from config.py

def load_master_db():
    if not os.path.exists(config.MASTER_DB): 
        return pd.DataFrame(columns=config.MASTER_COLUMNS)
    
    with open(config.MASTER_DB, 'r', encoding='utf-8') as f: 
        lines = f.readlines()
    
    if len(lines) < 3: 
        return pd.DataFrame(columns=config.MASTER_COLUMNS)
    
    header = [h.strip() for h in lines[0].strip('|').split('|')]
    data = []
    for line in lines[2:]:
        if '|' not in line: continue
        row = [c.strip() for c in line.strip('|').split('|')]
        # Ensure row fits header
        if len(row) < len(header): 
            row += [''] * (len(header) - len(row))
        data.append(dict(zip(header, row)))
    
    return pd.DataFrame(data)

def clean_corrupt_data(df):
    """Fixes JSON-like strings that sometimes appear in activityType."""
    if 'activityType' in df.columns:
        def fix_type(val):
            val = str(val).strip()
            if val.startswith("{") and "typeKey" in val:
                try:
                    d = ast.literal_eval(val)
                    return d.get('typeKey', '')
                except:
                    match = re.search(r"'typeKey':\s*'([^']+)'", val)
                    return match.group(1) if match else val
            return val
        df['activityType'] = df['activityType'].apply(fix_type)
    return df

def extract_ftp(text):
    if not text: return None
    pattern = r"Cycling FTP[:\*]*\s*(\d+)"
    match = re.search(pattern, text, re.IGNORECASE)
    if match: return int(match.group(1))
    return None

def get_current_ftp():
    if not os.path.exists(config.PLAN_FILE): return None
    try:
        with open(config.PLAN_FILE, 'r', encoding='utf-8') as f: 
            content = f.read()
        return extract_ftp(content)
    except Exception as e:
        print(f"⚠️ Could not read FTP from plan: {e}")
        return None

def extract_weekly_table():
    if not os.path.exists(config.PLAN_FILE): return pd.DataFrame()
    
    with open(config.PLAN_FILE, 'r', encoding='utf-8') as f: 
        lines = f.readlines()
    
    table_lines, found_header = [], False
    for line in lines:
        s = line.strip()
        if not found_header:
            if s.startswith('#') and 'weekly schedule' in s.lower(): 
                found_header = True
            continue
        # Stop at next section
        if (s.startswith('# ') or s.startswith('## ')) and len(table_lines) > 2: 
            break
        if '|' in s: 
            table_lines.append(s)
            
    if not found_header or not table_lines: 
        return pd.DataFrame()
    
    # Parse Header
    raw_header = [h.strip() for h in table_lines[0].strip('|').split('|')]
    col_map = {}
    for i, h in enumerate(raw_header):
        clean_h = h.lower().replace(' ', '')
        if 'date' in clean_h: col_map['Date'] = i
        elif 'day' in clean_h: col_map['Day'] = i
        elif 'plannedworkout' in clean_h: col_map['Planned Workout'] = i
        elif 'plannedduration' in clean_h or 'dur(min)' in clean_h: col_map['Planned Duration'] = i
        elif 'notes' in clean_h: col_map['Notes'] = i
        
    data = []
    for line in table_lines[1:]:
        if '---' in line: continue
        row_vals = [c.strip() for c in line.strip('|').split('|')]
        row_dict = {}
        for col_name, idx in col_map.items():
            if idx < len(row_vals): 
                row_dict[col_name] = row_vals[idx]
            else: 
                row_dict[col_name] = ""
        data.append(row_dict)
        
    return pd.DataFrame(data)

def detect_sport(text):
    t = text.upper()
    if '[RUN]' in t or 'RUN' in t or 'JOG' in t: return 'RUN'
    if '[BIKE]' in t or 'BIKE' in t or 'CYCLE' in t or 'RIDE' in t or 'ZWIFT' in t: return 'BIKE'
    if '[SWIM]' in t or 'SWIM' in t or 'POOL' in t: return 'SWIM'
    return 'OTHER'

def is_value_different(db_val, json_val):
    str_db = str(db_val).strip()
    if not str_db or str_db.lower() == 'nan': return False
    try:
        f_db = float(str_db)
        f_json = float(json_val)
        return abs(f_db - f_json) > 0.1
    except:
        return str_db != str(json_val).strip()

def sync():
    print(f"🔄 SYNC: Merging Plan and Garmin Data...")
    
    # 1. Load Data
    df_master = load_master_db()
    df_master = clean_corrupt_data(df_master)
    
    # Ensure all config columns exist
    for col in config.MASTER_COLUMNS:
        if col not in df_master.columns:
            df_master[col] = ""
            
    df_plan = extract_weekly_table()
    
    if not os.path.exists(config.GARMIN_JSON):
        print("❌ Garmin JSON missing.")
        return
        
    with open(config.GARMIN_JSON, 'r', encoding='utf-8') as f: 
        garmin_data = json.load(f)
        
    # Index Garmin data by date for faster lookup
    garmin_by_date = {}
    for g in garmin_data:
        d = g.get('startTimeLocal', '')[:10]
        if d not in garmin_by_date: garmin_by_date[d] = []
        garmin_by_date[d].append(g)

    # 2. Sync Plan to Master
    if not df_plan.empty:
        count_added = 0
        df_master['Date_Norm'] = pd.to_datetime(df_master['Date'], errors='coerce').dt.strftime('%Y-%m-%d')
        df_plan['Date_Norm'] = pd.to_datetime(df_plan['Date'], errors='coerce').dt.strftime('%Y-%m-%d')
        
        # Create set of existing (Date, Workout) tuples to prevent duplicates
        existing_keys = set(zip(df_master['Date_Norm'], df_master['Planned Workout'].str.strip()))
        today_str = datetime.now().strftime('%Y-%m-%d')
        
        for _, p_row in df_plan.iterrows():
            p_date_norm = p_row['Date_Norm']
            p_workout = str(p_row.get('Planned Workout', '')).strip()
            
            # Skip invalid dates or far future dates
            if pd.isna(p_date_norm) or p_date_norm > today_str: continue
            
            # Skip rest days
            p_clean = re.sub(r'[^a-zA-Z0-9\s]', '', p_workout.lower())
            if 'rest day' in p_clean or p_clean in ['rest', 'off', 'day off']: continue
            
            if (p_date_norm, p_workout) not in existing_keys:
                new_row = {c: "" for c in config.MASTER_COLUMNS}
                new_row.update({
                    'Date': p_date_norm,
                    'Day': p_row.get('Day', ''),
                    'Planned Workout': p_workout,
                    'Planned Duration': p_row.get('Planned Duration', ''),
                    'Notes / Targets': p_row.get('Notes', ''),
                    'Status': 'Pending'
                })
                df_master = pd.concat([df_master, pd.DataFrame([new_row])], ignore_index=True)
                existing_keys.add((p_date_norm, p_workout))
                count_added += 1
                
        if 'Date_Norm' in df_master.columns: 
            df_master.drop(columns=['Date_Norm'], inplace=True)
        print(f"   + Added {count_added} new planned workouts.")

    # 3. Link Garmin Data
    claimed_ids = set()
    
    for idx, row in df_master.iterrows():
        # Get date
        date_str = str(row.get('Date', '')).strip()
        try: 
            date_key = pd.to_datetime(date_str).strftime('%Y-%m-%d')
        except: 
            continue
            
        candidates = garmin_by_date.get(date_key, [])
        current_id = str(row.get('activityId', '')).strip()
        match = None
        
        # A. Try ID Match
        if current_id and current_id != 'nan':
             for cand in candidates:
                 if str(cand.get('activityId')) == current_id:
                     match = cand
                     break
        
        # B. Try Smart Matching (Sport Type)
        if not match and candidates and (not current_id or current_id == 'nan'):
            planned_txt = str(row.get('Planned Workout', '')).upper()
            planned_type = detect_sport(planned_txt)
            
            for cand in candidates:
                cand_id = str(cand.get('activityId'))
                if cand_id in claimed_ids: continue
                
                # Check sport type
                g_type_str = cand.get('activityType', {}).get('typeKey', '').lower()
                g_sport = 'OTHER'
                if 'running' in g_type_str: g_sport = 'RUN'
                elif 'cycling' in g_type_str or 'biking' in g_type_str or 'virtual' in g_type_str: g_sport = 'BIKE'
                elif 'swimming' in g_type_str: g_sport = 'SWIM'
                
                if planned_type != 'OTHER' and planned_type == g_sport:
                    match = cand
                    break
        
        if match:
            m_id = str(match.get('activityId'))
            claimed_ids.add(m_id)
            
            # Update Basic Info
            df_master.at[idx, 'Status'] = 'COMPLETED'
            if str(df_master.at[idx, 'Match Status']) != 'Linked (modified)':
                df_master.at[idx, 'Match Status'] = 'Linked'
            
            df_master.at[idx, 'activityId'] = m_id
            
            # Update Name if generic
            g_type = match.get('activityType', {}).get('typeKey', '').lower()
            prefix = "[RUN]" if 'run' in g_type else "[BIKE]" if 'cycl' in g_type or 'virt' in g_type else "[SWIM]" if 'swim' in g_type else ""
            raw_name = match.get('activityName', 'Activity')
            if prefix and prefix not in raw_name: new_name = f"{prefix} {raw_name}"
            else: new_name = raw_name
            df_master.at[idx, 'Actual Workout'] = new_name
            df_master.at[idx, 'activityType'] = g_type
            
            try:
                dur_sec = float(match.get('duration', 0))
                df_master.at[idx, 'Actual Duration'] = f"{dur_sec/60:.1f}"
            except: pass

            # Update Metrics (Only if empty or different)
            cols_to_map = [
                'duration', 'distance', 'averageHR', 'maxHR', 
                'aerobicTrainingEffect', 'anaerobicTrainingEffect', 'trainingEffectLabel',
                'avgPower', 'maxPower', 'normPower', 'trainingStressScore', 'intensityFactor',
                'averageSpeed', 'maxSpeed', 'vO2MaxValue', 'calories', 'elevationGain',
                'activityName', 'sportTypeId',
                'averageBikingCadenceInRevPerMinute', 
                'averageRunningCadenceInStepsPerMinute',
                'avgStrideLength', 
                'avgVerticalOscillation', 
                'avgGroundContactTime'
            ]
            
            is_row_modified = False
            for col in cols_to_map:
                val = match.get(col, '')
                current_db_val = str(df_master.at[idx, col]).strip()
                
                if (not current_db_val or current_db_val == 'nan') and val is not None and val != "":
                     df_master.at[idx, col] = val
                elif current_db_val and val is not None and val != "":
                    if is_value_different(current_db_val, val):
                        is_row_modified = True
            
            # --- RPE / FEELING MAPPING ---
            # 1. Root Level
            rpe_val = match.get('perceivedEffort')
            feel_val = match.get('feeling')
            
            # 2. SummaryDTO (Fallback)
            if rpe_val is None and 'summaryDTO' in match:
                raw = match['summaryDTO'].get('directWorkoutRpe')
                if raw: rpe_val = int(raw / 10)
            if feel_val is None and 'summaryDTO' in match:
                raw = match['summaryDTO'].get('directWorkoutFeel')
                if raw: feel_val = int((raw / 25) + 1)
                
            if rpe_val is not None: df_master.at[idx, 'RPE'] = str(rpe_val)
            if feel_val is not None: df_master.at[idx, 'Feeling'] = str(feel_val)

    # 4. Handle Unplanned Workouts
    unplanned_rows = []
    all_garmin = [item for sublist in garmin_by_date.values() for item in sublist]
    
    for g in all_garmin:
        g_id = str(g.get('activityId'))
        
        # Filter for valid sports
        c_type = g.get('activityType', {}).get('typeId')
        c_sport = g.get('sportTypeId')
        if c_type not in config.ALLOWED_SPORT_TYPES and c_sport not in config.ALLOWED_SPORT_TYPES:
            continue

        if g_id not in claimed_ids:
            new_row = {c: "" for c in config.MASTER_COLUMNS}
            new_row['Planned Workout'] = "" 
            new_row['Planned Duration'] = ""
            new_row['Status'] = 'COMPLETED'
            new_row['Match Status'] = 'Unplanned'
            new_row['Date'] = g.get('startTimeLocal', '')[:10]
            new_row['activityId'] = g_id
            new_row['Actual Workout'] = g.get('activityName', 'Unplanned')
            new_row['activityType'] = g.get('activityType', {}).get('typeKey', '')
            
            # Map all standard columns
            for col in cols_to_map:
                if col in g: new_row[col] = g[col]
            
            # Map RPE for unplanned
            if 'perceivedEffort' in g: new_row['RPE'] = g['perceivedEffort']
            elif 'summaryDTO' in g and g['summaryDTO'].get('directWorkoutRpe'):
                 new_row['RPE'] = int(g['summaryDTO']['directWorkoutRpe'] / 10)
                 
            if 'feeling' in g: new_row['Feeling'] = g['feeling']
            elif 'summaryDTO' in g and g['summaryDTO'].get('directWorkoutFeel'):
                 new_row['Feeling'] = int((g['summaryDTO']['directWorkoutFeel'] / 25) + 1)

            try: new_row['Actual Duration'] = f"{float(g.get('duration', 0))/60:.1f}"
            except: pass
            
            unplanned_rows.append(new_row)

    if unplanned_rows:
        print(f"   + Added {len(unplanned_rows)} unplanned activities.")
        df_master = pd.concat([df_master, pd.DataFrame(unplanned_rows)], ignore_index=True)

    # 5. Hydrate TSS/IF (Calculated Fields)
    current_ftp = get_current_ftp() or 241.0
    
    for idx, row in df_master.iterrows():
        act_type = str(row.get('activityType', '')).lower()
        if not ('run' in act_type or 'cycl' in act_type or 'bik' in act_type or 'virtual' in act_type):
            continue
            
        try:
            duration = float(row.get('duration', 0))
            np_val = float(row.get('normPower', 0))
        except: continue
        
        if duration > 0 and np_val > 0:
            intensity = np_val / current_ftp
            
            # Update IF if missing
            existing_if = str(row.get('intensityFactor', '')).strip()
            if not existing_if or existing_if == 'nan' or float(existing_if) == 0:
                 df_master.at[idx, 'intensityFactor'] = f"{intensity:.2f}"
            
            # Update TSS if missing
            existing_tss = str(row.get('trainingStressScore', '')).strip()
            if not existing_tss or existing_tss == 'nan' or float(existing_tss) == 0:
                tss = (duration * np_val * intensity) / (current_ftp * 3600) * 100
                df_master.at[idx, 'trainingStressScore'] = f"{tss:.1f}"

    # 6. Save
    df_master['Date_Sort'] = pd.to_datetime(df_master['Date'], errors='coerce')
    df_master = df_master.sort_values(by='Date_Sort', ascending=False).drop(columns=['Date_Sort'])
    
    print(f"💾 Saving {len(df_master)} rows to Master DB...")
    with open(config.MASTER_DB, 'w', encoding='utf-8') as f:
        f.write("| " + " | ".join(config.MASTER_COLUMNS) + " |\n")
        f.write("| " + " | ".join(['---'] * len(config.MASTER_COLUMNS)) + " |\n")
        for _, row in df_master.iterrows():
            vals = []
            for c in config.MASTER_COLUMNS:
                val = str(row.get(c, ""))
                val = val.replace('\n', ' ').replace('\r', '').replace('|', '/')
                vals.append(val)
            f.write("| " + " | ".join(vals) + " |\n")
    
    return df_master # Return DF for subsequent steps if needed
