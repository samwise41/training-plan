import re
import json
import uuid
import datetime
from pathlib import Path

# --- CONFIGURATION ---
PLAN_FILE = Path("endurance_plan.md")
OUTPUT_FILE = Path("data/planned.json")

# STRICT TAG MAPPING
TAG_MAP = {
    "RUN": "Run",
    "BIKE": "Bike",
    "SWIM": "Swim",
    "REST": "Rest",
    "STRENGTH": "Strength"
}

def parse_duration(duration_str):
    """Parses '40', '1h 30m', '45m' into minutes."""
    if not duration_str or str(duration_str).strip() == "-":
        return 0
    
    s = str(duration_str).lower().strip()
    total = 0
    
    h_match = re.search(r'(\d+)\s*h', s)
    m_match = re.search(r'(\d+)\s*m', s)
    
    if h_match: total += int(h_match.group(1)) * 60
    if m_match: total += int(m_match.group(1))
    
    if total == 0 and ':' in s:
        try:
            parts = s.split(':')
            total += int(parts[0]) * 60 + int(parts[1])
        except: pass
        
    if total == 0:
        num_match = re.search(r'(\d+)', s)
        if num_match:
            total = int(num_match.group(1))
            
    return total

def get_sport_from_tag(text):
    if not text: return "Other"
    match = re.search(r'\[\s*(\w+)\s*\]', str(text), re.IGNORECASE)
    if match:
        tag = match.group(1).upper()
        if tag in TAG_MAP:
            return TAG_MAP[tag]
    return "Other"

def parse_plan():
    print(f"📖 Reading {PLAN_FILE}...")
    
    if not PLAN_FILE.exists():
        print(f"❌ Error: {PLAN_FILE} not found.")
        return

    with open(PLAN_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()

    json_output = []
    in_schedule = False
    
    col_day = -1
    col_date = -1
    col_workout = -1
    col_duration = -1
    col_notes = -1

    for line in lines:
        stripped = line.strip()
        
        if "weekly schedule" in stripped.lower() and stripped.startswith("##"):
            in_schedule = True
            continue
        
        if in_schedule and stripped.startswith("##") and "weekly schedule" not in stripped.lower():
            in_schedule = False
            continue

        if not in_schedule: continue

        # Header Row Detection
        if stripped.startswith("|") and "planned workout" in stripped.lower():
            headers = [h.strip().lower() for h in stripped.strip("|").split("|")]
            for idx, h in enumerate(headers):
                if "date" in h: col_date = idx
                elif "day" in h: col_day = idx
                elif "planned workout" in h: col_workout = idx
                elif "planned duration" in h: col_duration = idx
                elif "notes" in h: col_notes = idx
            
            print(f"   -> Columns: Date[{col_date}], Day[{col_day}], Workout[{col_workout}], Dur[{col_duration}], Notes[{col_notes}]")
            continue

        if stripped.startswith("|") and not "---" in stripped and col_workout > -1:
            cols = [c.strip() for c in stripped.strip("|").split("|")]
            if len(cols) <= max(col_workout, col_duration): continue

            raw_workout = cols[col_workout]
            raw_duration = cols[col_duration] if col_duration > -1 else "0"
            raw_date = cols[col_date] if col_date > -1 and len(cols) > col_date else ""
            raw_notes = cols[col_notes] if col_notes > -1 and len(cols) > col_notes else ""
            raw_day = cols[col_day] if col_day > -1 and len(cols) > col_day else ""

            sport = get_sport_from_tag(raw_workout)
            dur = parse_duration(raw_duration)

            final_date = raw_date
            try:
                dt = datetime.datetime.strptime(raw_date, "%Y-%m-%d")
                final_date = dt.strftime("%Y-%m-%d")
            except: pass

            if final_date:
                json_output.append({
                    "id": str(uuid.uuid4()),
                    "date": final_date,
                    "day": raw_day,
                    "activityName": raw_workout,
                    "activityType": sport,
                    "plannedDuration": dur,
                    "notes": raw_notes,
                    "status": "PLANNED"
                })

    print(f"✅ Parsed {len(json_output)} workouts.")
    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(json_output, f, indent=4)
    print(f"💾 Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    parse_plan()
