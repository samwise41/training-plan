import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import matplotlib.dates as mdates
import matplotlib.patches as mpatches

# --- CONFIGURATION ---
START_DATE = datetime(2025, 12, 29)
END_DATE = datetime(2026, 9, 13)

# Sport Colors (Matches your Dashboard)
C_SWIM = "#06b6d4"  # Cyan
C_RUN  = "#f59e0b"  # Amber
C_BIKE = "#3b82f6"  # Blue
C_SAT  = "#ffffff"  # White line for Sat ride

# Phase Background Colors (Subtle)
PHASE_COLORS = {
    "Base":    "#1e293b", # Slate 800
    "Build":   "#312e81", # Indigo 900
    "Peak":    "#064e3b", # Emerald 900
    "Century": "#451a03", # Amber 900
    "70.3":    "#450a0a"  # Red 900
}

RACE_DATES = {
    datetime(2026, 6, 20): "Jordanelle",
    datetime(2026, 8, 15): "Century",
    datetime(2026, 9, 11): "70.3"
}

# --- HELPER FUNCTIONS ---
def get_phase_name(date):
    d = date.month * 100 + date.day
    if d <= 228: return "Base"
    elif d <= 515: return "Build"
    elif d <= 620: return "Peak"
    elif d <= 816: return "Century"
    else: return "70.3"

def get_sat_volume(date, phase):
    # Returns Saturday Ride Hours based on Phase rules
    if phase == "Base": return 2.0
    if phase == "Build":
        if date.month == 3: return 3.0
        if date.month == 4: return 3.5
        return 4.0
    if phase == "Peak": return 4.0
    if phase == "Century": return 5.0
    return 4.5

# --- SIMULATION LOOP ---
weeks = []
current_date = START_DATE
week_num = 1

while current_date <= END_DATE:
    phase = get_phase_name(current_date)
    sat_hours = get_sat_volume(current_date, phase)
    
    # Check Modifiers
    week_end = current_date + timedelta(days=6)
    is_race_week = any(current_date <= r <= week_end for r in RACE_DATES)
    is_deload = (week_num % 4 == 0)
    
    # Load Modifier (1.0 = Normal, 0.6 = Deload, 0.5 = Race)
    load_mod = 1.0
    note = ""
    
    if is_race_week:
        load_mod = 0.5
        note = "RACE"
    elif is_deload:
        load_mod = 0.6
        note = "Deload"
    
    # --- CALCULATE SPLITS (Projected) ---
    # 1. Swim: Approx 2 sessions x 45m = 1.5h base
    swim_vol = 1.5 * load_mod
    
    # 2. Run: Approx 2-3 sessions = 2.0h base
    run_vol = 2.0 * load_mod
    
    # 3. Bike: Weekday Base (2.5h) + Saturday Long Ride
    # The bike takes the brunt of the volume scaling
    weekday_bike = 2.5 * load_mod
    sat_bike = sat_hours * load_mod # Saturday scales with deloads too
    bike_vol = weekday_bike + sat_bike
    
    total_vol = swim_vol + run_vol + bike_vol

    weeks.append({
        "date": current_date,
        "label": f"{current_date.month}/{current_date.day}",
        "phase": phase,
        "swim": swim_vol,
        "run": run_vol,
        "bike": bike_vol,
        "total": total_vol,
        "sat_raw": sat_bike, # Actual duration of Sat ride
        "note": note
    })
    
    current_date += timedelta(days=7)
    week_num += 1

# --- PLOTTING ---
df = pd.DataFrame(weeks)
fig, ax1 = plt.subplots(figsize=(15, 8), facecolor='#0f172a')
ax1.set_facecolor('#0f172a')

# 1. DRAW BACKGROUND PHASES
# We need to find the index where phases change
phase_changes = df['phase'].ne(df['phase'].shift()).cumsum()
for group_id, group in df.groupby(phase_changes):
    start_idx = group.index[0] - 0.5
    end_idx = group.index[-1] + 0.5
    phase_name = group.iloc[0]['phase']
    color = PHASE_COLORS.get(phase_name, "#1e293b")
    
    # Draw Rectangle
    ax1.axvspan(start_idx, end_idx, color=color, alpha=0.6, zorder=0)
    
    # Add Label at top
    mid_point = (start_idx + end_idx) / 2
    ax1.text(mid_point, df['total'].max() + 1.5, phase_name.upper(), 
             color=color, ha='center', fontweight='bold', fontsize=10, 
             bbox=dict(facecolor='white', alpha=0.8, edgecolor='none', pad=2))

# 2. STACKED BARS
# Order: Swim (bottom), Run (middle), Bike (top)
p1 = ax1.bar(df.index, df['swim'], width=0.7, color=C_SWIM, label='Swim', alpha=0.9, zorder=3)
p2 = ax1.bar(df.index, df['run'], bottom=df['swim'], width=0.7, color=C_RUN, label='Run', alpha=0.9, zorder=3)
p3 = ax1.bar(df.index, df['bike'], bottom=df['swim']+df['run'], width=0.7, color=C_BIKE, label='Bike', alpha=0.9, zorder=3)

# 3. SATURDAY LINE (Secondary Axis)
ax2 = ax1.twinx()
ax2.plot(df.index, df['sat_raw'], color=C_SAT, marker='o', linewidth=1.5, markersize=4, linestyle='--', label='Sat Long Ride', zorder=4)

# 4. FORMATTING
ax1.set_ylabel('Weekly Hours', color='white', fontsize=12)
ax2.set_ylabel('Sat Ride Hours', color=C_SAT, fontsize=12)
ax1.set_title('2026 Training Load Projection (Stacked by Sport)', color='white', fontsize=16, fontweight='bold', pad=30)

# X-Axis Labels (Show every 2nd week to avoid clutter)
ax1.set_xticks(df.index[::2])
ax1.set_xticklabels(df['label'][::2], rotation=45, color='#94a3b8')

# Y-Axis Styling
ax1.tick_params(axis='y', colors='#94a3b8')
ax2.tick_params(axis='y', colors=C_SAT)
ax1.grid(color='#334155', linestyle=':', linewidth=0.5, axis='y', alpha=0.5, zorder=0)

# Spines
for ax in [ax1, ax2]:
    ax.spines['top'].set_visible(False)
    ax.spines['bottom'].set_color('#334155')
    ax.spines['left'].set_visible(False)
    ax.spines['right'].set_visible(False)

# 5. LEGEND & ANNOTATIONS
# Custom Legend
handles = [
    mpatches.Patch(color=C_BIKE, label='Bike'),
    mpatches.Patch(color=C_RUN, label='Run'),
    mpatches.Patch(color=C_SWIM, label='Swim'),
    plt.Line2D([], [], color=C_SAT, linestyle='--', marker='o', label='Sat Long Ride')
]
ax1.legend(handles=handles, loc='upper left', frameon=False, labelcolor='white', bbox_to_anchor=(0, 1.02), ncol=4)

# Note Labels (Race/Deload)
for i, row in df.iterrows():
    if row['note']:
        # Position text just above the bar
        y_pos = row['total'] + 0.2
        txt = row['note']
        color = 'white' if txt == "Step Up" else '#f472b6' if txt == "RACE" else '#94a3b8'
        weight = 'bold' if txt == "RACE" else 'normal'
        ax1.text(i, y_pos, txt, ha='center', va='bottom', color=color, fontsize=7, rotation=90, fontweight=weight)

plt.tight_layout()
plt.savefig('projected_volume_2026.png', dpi=300, bbox_inches='tight')
print("✅ Stacked Chart Generated")
