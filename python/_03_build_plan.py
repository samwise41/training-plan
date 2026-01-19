import re
import json
import uuid
import datetime
from pathlib import Path

# --- CONFIGURATION ---
PLAN_FILE = Path("endurance_plan.md")
OUTPUT_FILE = Path("data/planned.json")

# Mapping Sport Names to Standard Types
SPORT_MAP = {
    "RUN": "Run",
    "BIKE": "Bike",
    "RIDE": "Bike",
    "SWIM": "Swim",
    "STRENGTH": "Strength",
    "REST": "Rest"
}

def parse_duration(duration_str):
    """Parses '1h 30m', '45m', '1:30' into total minutes."""
    if not duration_str or duration_str.strip() == "-":
        return 0
    
    s = duration_str.lower().strip()
    total_minutes = 0
    
    # Format: 1h 30m
    h_match = re.search(r'(\d+)\s*h', s)
    m_match = re.search(r'(\d+)\s*m', s)
    
    if h_match:
        total_minutes += int(h_match.group(1)) * 60
    if m_match:
        total_minutes += int(m_match.group(1))
        
    # Format: 1:30
    if ":" in s and total_minutes == 0:
        try:
            parts = s.split(":")
            total_minutes += int(parts[0]) * 60 + int(parts[1])
        except:
            pass
            
    # Format: Just number (assume minutes)
    if total_minutes == 0 and s.isdigit():
        total_minutes = int(s)
        
    return total_minutes

def normalize_sport(sport_str):
    """Normalizes sport string to standard types."""
    if not sport_str:
        return "Other"
    
    # Clean up formatting (e.g. **Run**)
    clean = sport_str.replace("*", "").strip().upper()
    
    for key, val in SPORT_MAP.items():
        if key in clean:
            return val
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
    headers = []
    
    # 1. Find Section and Parse
    for line in lines:
        stripped = line.strip()
        
        # Detect Start of Section
        if "## Weekly Schedule" in line:
            in_schedule = True
            continue
        
        # Detect End of Section (Next Header)
        if in_schedule and line.startswith("## "):
            in_schedule = False
            continue
            
        if in_schedule and stripped.startswith("|"):
            # Header Row
            if "Date" in line and not headers:
                headers = [h.strip().lower() for h in stripped.strip("|").split("|")]
                continue
                
            # Skip Separator
            if "---" in line:
                continue
                
            # Data Row
            cols = [c.strip() for c in stripped.strip("|").split("|")]
            
            # Simple check to ensure row isn't empty or malformed
            if len(cols) < 3: 
                continue

            # Map Columns using Headers
            entry = {
                "id": str(uuid.uuid4()), # Generate ID
                "status": "PLANNED",
                "completed": False,
                # Default "Null" values for Log Schema fields
                "actualDuration": 0,
                "distance": 0,
                "averageHR": 0,
                "maxHR": 0,
                "avgPower": 0,
                "calories": 0,
                "RPE": 0,
                "Feeling": 0
            }

            # Map based on header position
            try:
                # DATE
                if "date" in headers:
                    date_idx = headers.index("date")
                    # Try to ensure YYYY-MM-DD format
                    raw_date = cols[date_idx]
                    try:
                        dt = datetime.datetime.strptime(raw_date, "%Y-%m-%d")
                        entry["date"] = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        # Fallback: leave as string if not strictly YYYY-MM-DD
                        entry["date"] = raw_date

                # ACTIVITY NAME
                if "activity" in headers:
                    entry["activityName"] = cols[headers.index("activity")]
                elif "workout" in headers:
                    entry["activityName"] = cols[headers.index("workout")]
                else:
                    entry["activityName"] = "Workout"

                # TYPE (Sport)
                if "type" in headers:
                    raw_type = cols[headers.index("type")]
                    entry["activityType"] = normalize_sport(raw_type)
                elif "sport" in headers:
                    raw_type = cols[headers.index("sport")]
                    entry["activityType"] = normalize_sport(raw_type)
                else:
                    entry["activityType"] = normalize_sport(entry["activityName"]) # Guess from name

                # DURATION
                if "duration" in headers:
                    dur_str = cols[headers.index("duration")]
                    entry["plannedDuration"] = parse_duration(dur_str)
                elif "time" in headers:
                    dur_str = cols[headers.index("time")]
                    entry["plannedDuration"] = parse_duration(dur_str)
                else:
                    entry["plannedDuration"] = 0

                # NOTES
                if "notes" in headers:
                    entry["notes"] = cols[headers.index("notes")]
                else:
                    entry["notes"] = ""

                # Only add if valid date
                if "date" in entry:
                    json_output.append(entry)

            except Exception as e:
                print(f"⚠️ Skipped Row: {cols} | Error: {e}")
                continue

    # 2. Write JSON
    print(f"✅ Parsed {len(json_output)} workouts.")
    
    # Ensure directory exists
    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(json_output, f, indent=4)
        
    print(f"💾 Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    parse_plan()
