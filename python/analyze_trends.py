import json
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from modules import config  # Import shared configuration

def load_data():
    if not os.path.exists(config.GARMIN_JSON):
        print(f"Error: Data file not found at {config.GARMIN_JSON}")
        return pd.DataFrame()
    with open(config.GARMIN_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return pd.DataFrame(data)

def calculate_slope(series):
    if len(series) < 3: return 0.0
    y = series.values
    x = np.arange(len(y))
    slope = np.polyfit(x, y, 1)[0]
    return slope

def determine_trend(slope, good_direction):
    if abs(slope) < 0.001: return "➡️ Stable"
    is_up = slope > 0
    if good_direction == 'up':
        return "↗️ Improving" if is_up else "↘️ Declining"
    else: 
        return "↗️ Worsening" if is_up else "↘️ Improving"

def analyze_metric(df, col_name, conf):
    now = datetime.now()
    results = {}
    
    if col_name == 'weekly_tss':
        if 'trainingStressScore' not in df.columns: return {'30d': 'No Data'}
        df_tss = df.dropna(subset=['trainingStressScore']).set_index('startTime_dt')
        weekly_series = df_tss['trainingStressScore'].resample('W-MON').sum()
        
        for days in [30, 90, 180]:
            cutoff = now - timedelta(days=days)
            subset = weekly_series[weekly_series.index >= cutoff]
            if len(subset) < 2:
                results[f'{days}d'] = "Not enough data"
                continue
            slope = calculate_slope(subset)
            trend_desc = determine_trend(slope, conf['good'])
            avg_val = subset.mean()
            results[f'{days}d'] = f"{trend_desc} (Avg: {avg_val:.0f})"
            if days == 30: results['current'] = avg_val
        return results

    if col_name not in df.columns:
        return {'30d': 'No Data', '90d': 'No Data', '6m': 'No Data'}

    # Filter out zeros or NaNs for the specific metric
    df_clean = df.dropna(subset=[col_name]).sort_values('startTimeLocal')
    df_clean = df_clean[df_clean[col_name] > 0] # Ensure positive values
    
    for days in [30, 90, 180]:
        cutoff = now - timedelta(days=days)
        subset = df_clean[df_clean['startTime_dt'] >= cutoff]
        if len(subset) < 3:
            results[f'{days}d'] = "Not enough data"
            continue
        slope = calculate_slope(subset[col_name])
        trend_desc = determine_trend(slope, conf['good'])
        avg_val = subset[col_name].mean()
        results[f'{days}d'] = f"{trend_desc} (Avg: {avg_val:.2f})"
        if days == 30: results['current'] = avg_val

    return results

def get_sport_filter(row, sport_type):
    act_type = row.get('activityType', {})
    if isinstance(act_type, str): return False 
    
    type_id = act_type.get('typeId')
    parent_id = act_type.get('parentTypeId')
    
    target_ids = config.SPORT_IDS.get(sport_type, [])
    if type_id in target_ids or parent_id in target_ids:
        return True
        
    key = act_type.get('typeKey', '').lower()
    parent_key = act_type.get('parentTypeKey', '').lower()
    
    if sport_type == 'RUN' and ('running' in key or 'running' in parent_key): return True
    if sport_type == 'BIKE' and ('cycling' in key or 'cycling' in parent_key): return True
    if sport_type == 'SWIM' and ('swimming' in key or 'swimming' in parent_key): return True
    
    return False

def main():
    print("Starting Trend Analysis...")
    df = load_data()
    
    if df.empty:
        print("DF Empty")
        return

    df['startTime_dt'] = pd.to_datetime(df['startTimeLocal'])
    
    is_run = df.apply(lambda x: get_sport_filter(x, 'RUN'), axis=1)
    is_bike = df.apply(lambda x: get_sport_filter(x, 'BIKE'), axis=1)
    is_swim = df.apply(lambda x: get_sport_filter(x, 'SWIM'), axis=1)

    # --- 1. Physiological Efficiency ---
    df['aerobic_efficiency'] = np.where(
        is_bike & (df.get('avgPower', 0) > 0) & (df.get('averageHR', 0) > 0),
        df['avgPower'] / df['averageHR'], np.nan
    )

    # --- 2. Subjective Efficiency (NEW) ---
    # Power / RPE. Requires RPE to be 1-10. 
    # Logic: High Power + Low RPE = High Efficiency
    if 'perceivedEffort' in df.columns:
        df['rpe_numeric'] = pd.to_numeric(df['perceivedEffort'], errors='coerce')
        df['subjective_efficiency'] = np.where(
            is_bike & (df.get('avgPower', 0) > 0) & (df['rpe_numeric'] > 0),
            df['avgPower'] / df['rpe_numeric'], np.nan
        )
    else:
        df['subjective_efficiency'] = np.nan
    
    # --- 3. Other Metrics ---
    df['torque_efficiency'] = np.where(
        is_bike & (df.get('avgPower', 0) > 0) & (df.get('averageBikingCadenceInRevPerMinute', 0) > 0),
        df['avgPower'] / df['averageBikingCadenceInRevPerMinute'], np.nan
    )

    df['run_speed_m_min'] = df.get('averageSpeed', 0) * 60
    df['run_economy'] = np.where(
        is_run & (df.get('averageHR', 0) > 0),
        df['run_speed_m_min'] / df['averageHR'], np.nan
    )

    df['run_stiffness'] = np.where(
        is_run & (df.get('avgPower', 0) > 0),
        (df.get('averageSpeed', 0) * 100) / df['avgPower'], np.nan
    )

    df['swim_speed_m_min'] = df.get('averageSpeed', 0) * 60
    df['swim_efficiency'] = np.where(
        is_swim & (df.get('averageHR', 0) > 0),
        df['swim_speed_m_min'] / df['averageHR'], np.nan
    )

    df['ground_contact'] = df.get('avgGroundContactTime', np.nan)
    df['vertical_osc'] = df.get('avgVerticalOscillation', np.nan)
    df['vo2_max'] = df.get('vO2MaxValue', np.nan)
    df['anaerobic_impact'] = df.get('anaerobicTrainingEffect', np.nan)
    
    if 'trainingStressScore' not in df.columns:
        df['trainingStressScore'] = np.nan

    print(f"Writing briefing to: {config.BRIEF_FILE}")
    
    with open(config.BRIEF_FILE, 'w', encoding='utf-8') as f:
        f.write("# 🤖 AI Coach Context Briefing\n")
        f.write(f"**Last Updated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
        
        f.write("## 1. Physiological Trends\n")
        f.write("| Metric | Target | 30d Trend | 90d Trend | 6m Trend | Status |\n")
        f.write("| :--- | :--- | :--- | :--- | :--- | :--- |\n")

        alerts = []
        for key, conf in config.METRICS.items():
            stats = analyze_metric(df, key, conf)
            current = stats.get('current', 0)
            r_min, r_max = conf['range']
            
            status_icon = "✅"
            if current == 0:
                status_icon = "⚪ No Data"
            elif current < r_min: 
                status_icon = "⚠️ Low"
                if conf['good'] == 'up': alerts.append(f"**{key}** is {current:.2f} (Target: >{r_min}).")
            elif current > r_max: 
                status_icon = "⚠️ High"
                if conf['good'] == 'down': alerts.append(f"**{key}** is {current:.2f} (Target: <{r_max}).")
            
            unit = conf['unit']
            f.write(f"| **{key.replace('_', ' ').title()}** | {r_min}-{r_max} {unit} | {stats.get('30d', '--')} | {stats.get('90d', '--')} | {stats.get('6m', '--')} | {status_icon} |\n")

        f.write("\n## 2. Actionable Alerts\n")
        if alerts:
            for a in alerts: f.write(f"- {a}\n")
        else:
            f.write("- All systems Nominal.\n")
            
    print("Briefing generated successfully.")

if __name__ == "__main__":
    main()