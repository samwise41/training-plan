import json
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# --- CONFIG ---
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(REPO_ROOT, 'python', 'my_garmin_data_ALL.json')
OUTPUT_FILE = os.path.join(REPO_ROOT, 'COACH_BRIEFING.md')

# --- DEFINITIONS ---
METRICS = {
    'aerobic_efficiency': {'unit': 'EF', 'good': 'up', 'range': (1.3, 1.7)},
    'torque_efficiency':  {'unit': 'W/RPM', 'good': 'up', 'range': (2.5, 3.5)},
    'run_economy':        {'unit': 'm/beat', 'good': 'up', 'range': (1.0, 1.6)},
    'run_stiffness':      {'unit': 'ratio', 'good': 'up', 'range': (0.75, 0.95)},
    'swim_efficiency':    {'unit': 'm/beat', 'good': 'up', 'range': (0.3, 0.6)},
    'ground_contact':     {'unit': 'ms', 'good': 'down', 'range': (220, 260)},
    'vertical_osc':       {'unit': 'cm', 'good': 'down', 'range': (6.0, 9.0)},
    'vo2_max':            {'unit': 'ml/kg', 'good': 'up', 'range': (45, 60)},
    'anaerobic_impact':   {'unit': 'TE', 'good': 'up', 'range': (2.0, 4.0)},
    'weekly_tss':         {'unit': 'TSS', 'good': 'up', 'range': (300, 600)}
}

def load_data():
    if not os.path.exists(DATA_FILE):
        print(f"Error: Data file not found at {DATA_FILE}")
        return pd.DataFrame()
    with open(DATA_FILE, 'r') as f:
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

def analyze_metric(df, col_name, config):
    now = datetime.now()
    results = {}
    
    # Special Handling for Weekly TSS (Needs aggregation first)
    if col_name == 'weekly_tss':
        # Resample daily TSS to Weekly Sum
        if 'trainingStressScore' not in df.columns: return {'30d': 'No Data'}
        
        df_tss = df.dropna(subset=['trainingStressScore']).set_index('startTime_dt')
        # Resample to Weekly ('W-MON') and sum
        weekly_series = df_tss['trainingStressScore'].resample('W-MON').sum()
        
        # Analyze the weekly series
        for days in [30, 90, 180]:
            # Convert days to weeks for the cutoff
            cutoff = now - timedelta(days=days)
            subset = weekly_series[weekly_series.index >= cutoff]
            
            if len(subset) < 2: # Need at least 2 weeks for a trend
                results[f'{days}d'] = "Not enough data"
                continue

            slope = calculate_slope(subset)
            trend_desc = determine_trend(slope, config['good'])
            avg_val = subset.mean()
            results[f'{days}d'] = f"{trend_desc} (Avg: {avg_val:.0f})"
            if days == 30: results['current'] = avg_val
            
        return results

    # Standard Metrics (Activity Averages)
    if col_name not in df.columns:
        return {'30d': 'No Data', '90d': 'No Data', '6m': 'No Data'}

    df_clean = df.dropna(subset=[col_name]).sort_values('startTimeLocal')
    
    for days in [30, 90, 180]:
        cutoff = now - timedelta(days=days)
        subset = df_clean[df_clean['startTime_dt'] >= cutoff]
        
        if len(subset) < 3:
            results[f'{days}d'] = "Not enough data"
            continue

        slope = calculate_slope(subset[col_name])
        trend_desc = determine_trend(slope, config['good'])
        avg_val = subset[col_name].mean()
        
        results[f'{days}d'] = f"{trend_desc} (Avg: {avg_val:.2f})"
        if days == 30: results['current'] = avg_val

    return results

def main():
    print("Starting Trend Analysis...")
    df = load_data()
    
    if df.empty:
        with open(OUTPUT_FILE, 'w') as f:
            f.write("# Error: No Data Found\n")
        return

    df['startTime_dt'] = pd.to_datetime(df['startTimeLocal'])
    
    # --- 1. CALCULATE DERIVED METRICS ---
    
    # Aerobic Efficiency (Bike)
    df['aerobic_efficiency'] = np.where(
        (df['activityType'].apply(lambda x: x.get('typeKey') in ['virtual_ride', 'road_biking'])) & (df['averageHR'] > 0),
        df['avgPower'] / df['averageHR'], np.nan
    )
    
    # Torque Efficiency Proxy (Watts/RPM)
    df['torque_efficiency'] = np.where(
        (df['activityType'].apply(lambda x: x.get('typeKey') == 'virtual_ride')) & (df['averageBikingCadenceInRevPerMinute'] > 0),
        df['avgPower'] / df['averageBikingCadenceInRevPerMinute'], np.nan
    )

    # Run Economy (m/beat)
    df['run_speed_m_min'] = df['averageSpeed'] * 60
    df['run_economy'] = np.where(
        (df['activityType'].apply(lambda x: 'running' in x.get('typeKey'))) & (df['averageHR'] > 0),
        df['run_speed_m_min'] / df['averageHR'], np.nan
    )

    # Run Stiffness
    df['run_stiffness'] = np.where(
        (df['activityType'].apply(lambda x: 'running' in x.get('typeKey'))) & (df['avgPower'] > 0),
        (df['averageSpeed'] * 100) / df['avgPower'], np.nan
    )

    # Swim Efficiency (Broader Filter: looks for 'swimming' anywhere in typeKey)
    df['swim_speed_m_min'] = df['averageSpeed'] * 60
    df['swim_efficiency'] = np.where(
        (df['activityType'].apply(lambda x: 'swimming' in x.get('typeKey'))) & (df['averageHR'] > 0),
        df['swim_speed_m_min'] / df['averageHR'], np.nan
    )

    # Map raw columns
    df['ground_contact'] = df.get('avgGroundContactTime', np.nan)
    df['vertical_osc'] = df.get('avgVerticalOscillation', np.nan)
    df['vo2_max'] = df.get('vO2MaxValue', np.nan)
    df['anaerobic_impact'] = df.get('anaerobicTrainingEffect', np.nan)
    
    # Ensure TSS exists
    if 'trainingStressScore' not in df.columns:
        df['trainingStressScore'] = np.nan

    # --- 2. GENERATE REPORT ---
    print(f"Writing briefing to: {OUTPUT_FILE}")
    with open(OUTPUT_FILE, 'w') as f:
        f.write("# 🤖 AI Coach Context Briefing\n")
        f.write(f"**Last Updated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
        
        f.write("## 1. Physiological Trends\n")
        f.write("| Metric | Target | 30d Trend | 90d Trend | 6m Trend | Status |\n")
        f.write("| :--- | :--- | :--- | :--- | :--- | :--- |\n")

        alerts = []
        for key, conf in METRICS.items():
            stats = analyze_metric(df, key, conf)
            current = stats.get('current', 0)
            r_min, r_max = conf['range']
            
            status_icon = "✅"
            if current == 0:
                status_icon = "⚪ No Recent Data"
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
