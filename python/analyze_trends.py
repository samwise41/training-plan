import json
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# --- CONFIG ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(SCRIPT_DIR, 'my_garmin_data_ALL.json')
OUTPUT_FILE = os.path.join(os.path.dirname(SCRIPT_DIR), 'COACH_BRIEFING.md')

# --- DEFINITIONS (Must match metrics.js) ---
METRICS = {
    'aerobic_efficiency': {'unit': 'EF', 'good': 'up', 'range': (1.3, 1.7)},
    'torque_efficiency':  {'unit': 'W/RPM', 'good': 'up', 'range': (2.5, 3.5)},
    'run_economy':        {'unit': 'm/beat', 'good': 'up', 'range': (1.0, 1.6)},
    'run_stiffness':      {'unit': 'ratio', 'good': 'up', 'range': (0.75, 0.95)},
    'ground_contact':     {'unit': 'ms', 'good': 'down', 'range': (220, 260)},
    'vertical_osc':       {'unit': 'cm', 'good': 'down', 'range': (6.0, 9.0)},
    'vo2_max':            {'unit': 'ml/kg', 'good': 'up', 'range': (45, 60)}
}

def load_data():
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
    return pd.DataFrame(data)

def calculate_slope(series):
    """Calculates the slope of a linear regression line."""
    if len(series) < 3: return 0.0
    y = series.values
    x = np.arange(len(y))
    # Simple linear regression slope
    slope = np.polyfit(x, y, 1)[0]
    return slope

def determine_trend(slope, good_direction):
    """Returns trend icon and description."""
    if abs(slope) < 0.001: return "➡️ Stable"
    
    is_up = slope > 0
    if good_direction == 'up':
        return "↗️ Improving" if is_up else "↘️ Declining"
    else: # good == 'down'
        return "↗️ Worsening" if is_up else "↘️ Improving"

def analyze_metric(df, col_name, config):
    """Analyzes 30d, 90d, and 6m trends for a specific metric."""
    now = datetime.now()
    results = {}
    
    # Pre-filter for non-nulls
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
        
        # Capture latest for range check
        if days == 30:
            results['current'] = avg_val

    return results

def main():
    df = load_data()
    # Convert dates
    df['startTime_dt'] = pd.to_datetime(df['startTimeLocal'])
    
    # --- DERIVED METRICS (Matching metrics.js logic) ---
    # Aerobic Efficiency (Bike)
    df['aerobic_efficiency'] = np.where(
        (df['activityType'].apply(lambda x: x.get('typeKey') == 'virtual_ride' or x.get('typeKey') == 'road_biking')) & (df['averageHR'] > 0),
        df['avgPower'] / df['averageHR'],
        np.nan
    )
    
    # Torque (Bike)
    df['torque_efficiency'] = np.where(
        (df['activityType'].apply(lambda x: x.get('typeKey') == 'virtual_ride')) & (df['averageBikingCadenceInRevPerMinute'] > 0),
        df['avgPower'] / df['averageBikingCadenceInRevPerMinute'],
        np.nan
    )

    # Run Economy (Run) - m/min / HR
    df['run_speed_m_min'] = df['averageSpeed'] * 60
    df['run_economy'] = np.where(
        (df['activityType'].apply(lambda x: x.get('typeKey') == 'running')) & (df['averageHR'] > 0),
        df['run_speed_m_min'] / df['averageHR'],
        np.nan
    )

    # Stiffness (Run) - Speed / Power
    df['run_stiffness'] = np.where(
        (df['activityType'].apply(lambda x: x.get('typeKey') == 'running')) & (df['avgPower'] > 0),
        (df['averageSpeed'] * 100) / df['avgPower'],
        np.nan
    )

    # Map raw columns
    df['ground_contact'] = df['avgGroundContactTime']
    df['vertical_osc'] = df['avgVerticalOscillation']
    df['vo2_max'] = df['vO2MaxValue']

    # --- GENERATE REPORT ---
    with open(OUTPUT_FILE, 'w') as f:
        f.write("# 🤖 AI Coach Context Briefing\n")
        f.write(f"**Last Updated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
        f.write("> **System Note:** This file is auto-generated for the AI Coach. Do not edit manually.\n\n")
        
        f.write("## 1. Physiological Trends\n")
        f.write("| Metric | Target | 30d Trend | 90d Trend | 6m Trend | Status |\n")
        f.write("| :--- | :--- | :--- | :--- | :--- | :--- |\n")

        alerts = []

        for key, conf in METRICS.items():
            stats = analyze_metric(df, key, conf)
            
            # Check Range
            current = stats.get('current', 0)
            r_min, r_max = conf['range']
            
            status_icon = "✅"
            if current < r_min: 
                status_icon = "⚠️ Low"
                if conf['good'] == 'up': alerts.append(f"**{key}** is {current:.2f} (Target: >{r_min}). Focus on base work.")
            elif current > r_max: 
                status_icon = "⚠️ High"
                if conf['good'] == 'down': alerts.append(f"**{key}** is {current:.2f} (Target: <{r_max}). Focus on form drills.")
            
            # Write Row
            row = f"| **{key.replace('_', ' ').title()}** | {r_min}-{r_max} {conf['unit']} | {stats.get('30d', '--')} | {stats.get('90d', '--')} | {stats.get('6m', '--')} | {status_icon} |\n"
            f.write(row)

        f.write("\n## 2. Actionable Alerts\n")
        if alerts:
            for a in alerts:
                f.write(f"- {a}\n")
        else:
            f.write("- All systems Nominal. Maintain current progression.\n")

if __name__ == "__main__":
    main()
