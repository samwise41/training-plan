import pandas as pd
import numpy as np
import json
import os
import re
import ast
from datetime import datetime, timedelta
from . import config

# --- HELPER FUNCTIONS ---

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
        if len(row) < len(header): 
            row += [''] * (len(header) - len(row))
        data.append(dict(zip(header, row)))
    
    return pd.DataFrame(data)

def clean_corrupt_data(df):
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

def extract_weekly_table():
    if not os.path.exists(config.PLAN_FILE): return pd.DataFrame()
    with open(config.PLAN_FILE, 'r', encoding='utf-8') as f: lines = f.readlines()
    
    table_lines, found_header = [], False
    for line in lines:
        s = line.strip()
        if not found_header:
            if s.startswith('#') and 'weekly schedule' in s.lower(): found_header = True
            continue
        if (s.startswith('# ') or s.startswith('## ')) and len(table_lines) > 2: break
        if '|' in s: table_lines.append(s)
            
    if not found_header or not table_lines: return pd.DataFrame()
    
    raw_header = [h.strip() for h in table_lines[0].strip('|').split('|')]
    col_map = {}
    for i, h in enumerate(raw_header):
        clean_h = h.lower().replace(' ', '')
        if 'date' in clean_h: col_map['Date'] = i
        elif 'day' in clean_h: col_map['Day'] = i
        elif 'plannedworkout' in clean_h: col_map['Planned Workout'] = i
        elif 'plannedduration' in clean_h: col_map['Planned Duration'] = i
        elif 'notes' in clean_h: col_map['Notes'] = i
        
    data = []
    for line in table_lines[1:]:
        if '---' in line: continue
        row_vals = [c.strip() for c in line.strip('|').split('|')]
        row_dict = {}
        for col_name, idx in col_map.items():
            if idx < len(row_vals): row_dict[col_name] = row_vals[idx]
            else: row_dict[col_name] = ""
        data.append(row_dict)
    return pd.DataFrame(data)

def detect_sport(text):
    t = text.upper()
    if '[RUN]' in t or 'RUN' in t: return 'RUN'
    if '[BIKE]' in t or 'BIKE' in t or 'CYCLE' in t or 'ZWIFT' in t: return 'BIKE'
    if '[SWIM]' in t or 'SWIM' in t: return 'SWIM'
    return 'OTHER'

def get_garmin_sport(act):
    # Normalize Garmin types
    t = act.get('activityType', {}).get('typeKey', '').lower()
    if 'running' in t: return 'RUN'
    if 'cycling' in t or 'biking' in t or 'virtual_ride' in t: return 'BIKE'
    if 'swimming' in t: return 'SWIM'
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

# --- AGGREGATION LOGIC ---
def bundle_activities(activities):
    if not activities: return None
    if len(activities) == 1: return activities[0]
    
    # Sort by duration descending
    activities.sort(key=lambda x: x.get('duration', 0), reverse=True)
    main_act = activities[0]
    combined = main_act.copy()
    
    # 1. Sum Volume
    combined['duration'] = sum(a.get('duration', 0) for a in activities)
    combined['distance'] = sum(a.get('distance', 0) for a in activities)
    combined['calories'] = sum(a.get('calories', 0) for a in activities)
    combined['elevationGain'] = sum(a.get('elevationGain', 0) for a in activities)
    
    # 2. Weighted Averages
    def weighted_avg(key):
        num, den = 0, 0
        for a in activities:
            val = a.get(key)
            dur = a.get('duration', 0)
            if val is not None and dur > 0:
                num += val * dur
                den += dur
        return num / den if den > 0 else None

    combined['avgPower'] = weighted_avg('avgPower')
    combined['normPower'] = weighted_avg('normPower') 
    combined['averageHR'] = weighted_avg('averageHR')
    combined['averageSpeed'] = weighted_avg('averageSpeed')
    combined['averageBikingCadenceInRevPerMinute'] = weighted_avg('averageBikingCadenceInRevPerMinute')
    combined['averageRunningCadenceInStepsPerMinute'] = weighted_avg('averageRunningCadenceInStepsPerMinute')
    
    # 3. Maxima
    combined['maxHR'] = max((a.get('maxHR', 0) for a in activities), default=0)
    combined['maxPower'] = max((a.get('maxPower', 0) for a in activities), default=0)
    
    # 4. Metadata (Combine IDs)
    combined['activityName'] = f"{main_act.get('activityName')} (+{len(activities)-1})"
    combined['activityId'] = ",".join(str(a.get('activityId')) for a in activities)

    # 5. RPE/Feeling
    if 'perceivedEffort' not in combined and 'perceivedEffort' in main_act:
        combined['perceivedEffort'] = main_act['perceivedEffort']
    if 'feeling' not in combined and 'feeling' in main_act:
        combined['feeling'] = main_act['feeling']

    return combined

def cluster_activities_by_time(candidates, target_sport=None):
    """
    1. Filter by sport (Strictly).
    2. Cluster by time using Elapsed Duration (handles coffee stops).
    """
    if not candidates: return []

    # 1. Strict Sport Filter
    relevant = []
    for c in candidates:
        g_sport = get_garmin_sport(c)
        if target_sport:
            # STRICT MATCH
            if g_sport == target_sport: relevant.append(c)
        else:
            # For Unplanned: Include known sports only
            if g_sport in ['RUN', 'BIKE', 'SWIM']: relevant.append(c)

    if not relevant: return []

    # 2. Sort by Start Time
    relevant.sort(key=lambda x: x.get('startTimeLocal', ''))

    clusters = []
    current_cluster = []
    
    for act in relevant:
        if not current_cluster:
            current_cluster.append(act)
            continue
        
        # Check Gap using Elapsed Duration
        prev_act = current_cluster[-1]
        
        # Ensure only same-sport bundling
        if get_garmin_sport(prev_act) != get_garmin_sport(act):
             clusters.append(current_cluster)
             current_cluster = [act]
             continue

        prev_start = pd.to_datetime(prev_act.get('startTimeLocal'))
        # Use elapsedDuration for wall-clock time
        prev_dur = prev_act.get('elapsedDuration', prev_act.get('duration', 0))
        prev_end = prev_start + timedelta(seconds=prev_dur)
        
        curr_start = pd.to_datetime(act.get('startTimeLocal'))
        
        # Gap Calculation (Minutes)
        gap_minutes = (curr_start - prev_end).total_seconds() / 60.0
        
        # 60 Minute Chaining Window
        if gap_minutes <= 60:
            current_cluster.append(act)
        else:
            clusters.append(current_cluster)
            current_cluster = [act]
            
    if current_cluster: clusters.append(current_cluster)

    results = [bundle_activities(c) for c in clusters]
    return results

# --- MAIN SYNC ---

def sync():
    print(f"🔄 SYNC: Merging Plan and Garmin Data...")
    
    df_master = load_master_db()
    df_master = clean_corrupt_data(df_master)
    
    # Ensure columns exist
    for col in config.MASTER_COLUMNS:
        if col not in df_master.columns:
            df_master[col] = ""
            
    df_plan = extract_weekly_table()
    
    if not os.path.exists(config.GARMIN_JSON):
        print("❌ Garmin JSON missing.")
        return None
        
    with open(config.GARMIN_JSON, 'r', encoding='utf-8') as f: 
        garmin_data = json.load(f)
        
    garmin_by_date = {}
    for g in garmin_data:
        d = g.get('startTimeLocal', '')[:10]
        if d not in garmin_by_date: garmin_by_date[d] = []
        garmin_by_date[d].append(g)

    # SAFETY CHECK: Only process recent data (7 days)
    CUTOFF_DATE = datetime.now() - timedelta(days=7)
    print(f"   (Restricted to updates after {CUTOFF_DATE.strftime('%Y-%m-%d')})")

    # 1. PRE-CLAIM EXISTING IDs (Prevention of Duplicates)
    claimed_ids = set()
    for ids in df_master['activityId'].dropna():
        ids_str = str(ids).strip()
        if ids_str and ids_str != 'nan':
            # Handle comma-separated lists (bundles)
            for single_id in ids_str.split(','):
                claimed_ids.add(single_id.strip())

    # 2. Sync Plan to Master
    if not df_plan.empty:
        count_added = 0
        df_master['Date_Norm'] = pd.to_datetime(df_master['Date'], errors='coerce').dt.strftime('%Y-%m-%d')
        df_plan['Date_Norm'] = pd.to_datetime(df_plan['Date'], errors='coerce').dt.strftime('%Y-%m-%d')
        
        existing_keys = set(zip(df_master['Date_Norm'], df_master['Planned Workout'].str.strip()))
        today_str = datetime.now().strftime('%Y-%m-%d')
        
        for _, p_row in df_plan.iterrows():
            p_date_norm = p_row['Date_Norm']
            p_workout = str(p_row.get('Planned Workout', '')).strip()
            
            if pd.isna(p_date_norm) or p_date_norm > today_str: continue
            if 'rest day' in p_workout.lower(): continue
            
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
                
        if 'Date_Norm' in df_master.columns: df_master.drop(columns=['Date_Norm'], inplace=True)
        if count_added > 0: print(f"   + Added {count_added} new planned workouts.")

    # 3. Match Planned Workouts
    cols_to_map = [
        'duration', 'distance', 'averageHR', 'maxHR', 
        'aerobicTrainingEffect', 'anaerobicTrainingEffect', 'trainingEffectLabel',
        'avgPower', 'maxPower', 'normPower', 'trainingStressScore', 'intensityFactor',
        'averageSpeed', 'maxSpeed', 'vO2MaxValue', 'calories', 'elevationGain',
        'activityName', 'sportTypeId',
        'averageBikingCadenceInRevPerMinute', 
        'averageRunningCadenceInStepsPerMinute',
        'avgStrideLength', 'avgVerticalOscillation', 'avgGroundContactTime'
    ]

    for idx, row in df_master.iterrows():
        date_str = str(row.get('Date', '')).strip()
        try: 
            date_obj = pd.to_datetime(date_str)
            date_key = date_obj.strftime('%Y-%m-%d')
            # SKIP OLD ROWS
            if date_obj < CUTOFF_DATE: continue
        except: continue
        
        candidates = garmin_by_date.get(date_key, [])
        if not candidates: continue

        planned_txt = str(row.get('Planned Workout', '')).upper()
        planned_sport = detect_sport(planned_txt)
        
        # Skip if row is manually linked (non-empty ID) and matches current logic
        current_id = str(row.get('activityId', '')).strip()
        if current_id and current_id != 'nan': continue 

        # Find Best Bundle
        daily_bundles = cluster_activities_by_time(candidates, planned_sport)
        
        best_match = None
        for bundle in daily_bundles:
            b_ids = str(bundle['activityId']).split(',')
            # If ANY part of this bundle is already claimed, we can't use it
            if any(bid in claimed_ids for bid in b_ids): continue
            
            best_match = bundle
            break
        
        if best_match:
            # Claim IDs immediately
            for bid in str(best_match['activityId']).split(','): claimed_ids.add(bid)

            # Update DB
            df_master.at[idx, 'Status'] = 'COMPLETED'
            df_master.at[idx, 'Match Status'] = 'Linked'
            df_master.at[idx, 'activityId'] = best_match['activityId']
            
            g_type = best_match.get('activityType', {}).get('typeKey', '').lower()
            prefix = f"[{planned_sport}]" 
            raw_name = best_match.get('activityName', 'Activity')
            if prefix not in raw_name: raw_name = f"{prefix} {raw_name}"
            df_master.at[idx, 'Actual Workout'] = raw_name
            df_master.at[idx, 'activityType'] = g_type
            
            try: df_master.at[idx, 'Actual Duration'] = f"{float(best_match.get('duration', 0))/60:.1f}"
            except: pass

            for col in cols_to_map:
                val = best_match.get(col, '')
                if val is not None: df_master.at[idx, col] = val
            
            # RPE/Feeling
            rpe_val = best_match.get('perceivedEffort')
            if rpe_val is None and 'summaryDTO' in best_match:
                raw = best_match['summaryDTO'].get('directWorkoutRpe')
                if raw: rpe_val = int(raw / 10)
            if rpe_val: df_master.at[idx, 'RPE'] = str(rpe_val)
            
            feel_val = best_match.get('feeling')
            if feel_val is None and 'summaryDTO' in best_match:
                raw = best_match['summaryDTO'].get('directWorkoutFeel')
                if raw: feel_val = int((raw / 25) + 1)
            if feel_val: df_master.at[idx, 'Feeling'] = str(feel_val)

    # 4. Handle Unplanned (Bundled Leftovers)
    unplanned_rows = []
    
    for date_key, day_activities in garmin_by_date.items():
        try:
             dt_key = pd.to_datetime(date_key)
             if dt_key < CUTOFF_DATE: continue
        except: continue

        # Bundle everything by sport/time
        all_day_bundles = cluster_activities_by_time(day_activities, target_sport=None)
        
        for bundle in all_day_bundles:
            b_ids = str(bundle['activityId']).split(',')
            
            # If ANY part of this bundle is claimed, ignore it
            if any(bid in claimed_ids for bid in b_ids): continue
            
            # Create Unplanned Entry
            new_row = {c: "" for c in config.MASTER_COLUMNS}
            new_row['Status'] = 'COMPLETED'
            new_row['Match Status'] = 'Unplanned'
            new_row['Date'] = date_key
            new_row['activityId'] = bundle['activityId']
            new_row['Actual Workout'] = bundle.get('activityName', 'Unplanned')
            new_row['activityType'] = bundle.get('activityType', {}).get('typeKey', '')
            
            for col in cols_to_map:
                if col in bundle: new_row[col] = bundle[col]
            
            rpe_val = bundle.get('perceivedEffort')
            if rpe_val is None and 'summaryDTO' in bundle:
                 raw_rpe = bundle['summaryDTO'].get('directWorkoutRpe')
                 if raw_rpe: rpe_val = int(raw_rpe / 10)
            if rpe_val: new_row['RPE'] = str(rpe_val)

            try: new_row['Actual Duration'] = f"{float(bundle.get('duration', 0))/60:.1f}"
            except: pass
            
            unplanned_rows.append(new_row)
            
            # Mark as claimed
            for bid in b_ids: claimed_ids.add(bid)

    if unplanned_rows:
        print(f"   + Added {len(unplanned_rows)} unplanned activities (bundled).")
        df_master = pd.concat([df_master, pd.DataFrame(unplanned_rows)], ignore_index=True)

    # 5. Save
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
    
    return df_master
