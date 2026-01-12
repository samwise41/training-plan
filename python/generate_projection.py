import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import matplotlib.dates as mdates

# --- CONFIGURATION (Based on Endurance Plan Rules) ---
START_DATE = datetime(2025, 12, 29) # Start of the year's training logic
END_DATE = datetime(2026, 9, 13)    # Through the 70.3 Race
RACE_DATES = {
    datetime(2026, 6, 20): "Jordanelle",
    datetime(2026, 8, 15): "Century",
    datetime(2026, 9, 11): "70.3"
}

# Standard Weekday Volume (Mon-Fri) based on "Microcycle Templates"
# Mon(1h) + Tue(45m) + Wed(45m) + Thu(90m) + Fri(60m) = ~4.5 to 5 hours base
WEEKDAY_BASE_HOURS = 4.75 

def get_phase_info(date):
    """Returns Phase Name, Sat Duration, and Color based on date."""
    d = date.month * 100 + date.day
    
    # Phase 1: Base/Prep (Now - Feb 28)
    if d <= 228:
        # Winter Strategy: Sat capped at 2.0h
        return "Phase 1: Base", 2.0, "#3b82f6" # Blue
    
    # Phase 2: Tri-Build (Mar 1 - May 15)
    elif d <= 515:
        # Step Ladder: Increases 30m every month
        if date.month == 3: return "Phase 2: Build", 3.0, "#8b5cf6" # Purple
        if date.month == 4: return "Phase 2: Build", 3.5, "#8b5cf6"
        return "Phase 2: Build", 4.0, "#8b5cf6"

    # Phase 3: Peak/Taper (May 16 - June 20)
    elif d <= 620:
        return "Phase 3: Peak", 4.0, "#10b981" # Emerald

    # Phase 4: Century Pivot (June 21 - Aug 16)
    elif d <= 816:
        # Big volume jump for Century
        return "Phase 4: Century", 5.0, "#f59e0b" # Amber

    # Phase 5: 70.3 Final (Aug 17 - Sept 11)
    else:
        return "Phase 5: 70.3", 4.5, "#ef4444" # Red

# --- SIMULATION LOOP ---
weeks = []
current_date = START_DATE
week_num = 1

while current_date <= END_DATE:
    phase_name, sat_hours, color = get_phase_info(current_date)
    
    # Identify Race Week (Check if any race falls in this Mon-Sun window)
    week_end = current_date + timedelta(days=6)
    is_race_week = any(current_date <= r <= week_end for r in RACE_DATES)
    
    # Logic: 3 Weeks Load, 1 Week Deload
    # We reset the counter slightly for phases, but generally Week 4, 8, 12... are deloads
    is_deload = (week_num % 4 == 0)
    
    total_vol = WEEKDAY_BASE_HOURS + sat_hours
    note = ""

    if is_race_week:
        # Taper Protocol: 50% Volume
        total_vol *= 0.5
        sat_hours *= 0.5
        note = "RACE"
        bar_color = "#ec4899" # Pink for Race
    elif is_deload:
        # Deload Protocol: 60% Volume
        total_vol *= 0.6
        sat_hours *= 0.6
        note = "Deload"
        bar_color = "#64748b" # Slate for Deload
    else:
        # Normal Load
        bar_color = color
        if week_num % 4 == 1 and week_num > 1:
            note = "Step Up"

    weeks.append({
        "date": current_date,
        "week_label": f"{current_date.month}/{current_date.day}",
        "total": total_vol,
        "sat": sat_hours,
        "color": bar_color,
        "note": note,
        "phase": phase_name
    })
    
    current_date += timedelta(days=7)
    week_num += 1

# --- PLOTTING ---
df = pd.DataFrame(weeks)
fig, ax1 = plt.subplots(figsize=(14, 7), facecolor='#0f172a') # Dark background
ax1.set_facecolor('#0f172a')

# Bar Chart (Total Volume)
bars = ax1.bar(df['week_label'], df['total'], color=df['color'], alpha=0.9, width=0.6, label='Total Volume')

# Line Chart (Sat Ride)
ax2 = ax1.twinx()
ax2.plot(df['week_label'], df['sat'], color='#fbbf24', marker='o', linewidth=2, markersize=6, label='Sat Long Ride')

# Formatting
ax1.set_ylabel('Total Weekly Hours', color='white', fontsize=12)
ax2.set_ylabel('Long Ride Hours', color='#fbbf24', fontsize=12)
ax1.set_title('Projected Training Volume: Path to 70.3 (2026)', color='white', fontsize=16, fontweight='bold', pad=20)

# Axis Colors
ax1.tick_params(axis='x', colors='#94a3b8', rotation=45)
ax1.tick_params(axis='y', colors='#94a3b8')
ax2.tick_params(axis='y', colors='#fbbf24')
for spine in ax1.spines.values(): spine.set_edgecolor('#334155')
for spine in ax2.spines.values(): spine.set_visible(False)

# Grid
ax1.grid(color='#334155', linestyle='--', linewidth=0.5, axis='y', alpha=0.5)

# Annotations (Deloads / Races)
for i, row in df.iterrows():
    if row['note']:
        height = row['total'] + 0.2
        color = 'white' if row['note'] == 'Step Up' else '#ec4899' if row['note'] == 'RACE' else '#94a3b8'
        weight = 'bold' if row['note'] == 'RACE' else 'normal'
        ax1.text(i, height, row['note'], ha='center', va='bottom', color=color, fontsize=8, fontweight=weight)

# Legend
lines, labels = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax1.legend(lines + lines2, labels + labels2, loc='upper left', frameon=False, labelcolor='white')

# Phase Background Shading (Optional visual separation)
# We can calculate indices where phases change if needed, but color coding bars handles this well.

plt.tight_layout()
plt.savefig('projected_volume_2026.png', dpi=300, bbox_inches='tight')
print("✅ Chart generated: projected_volume_2026.png")
plt.show()
