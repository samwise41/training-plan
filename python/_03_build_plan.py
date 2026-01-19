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
    header_map = {} # Maps 'column name' -> index

    for line in lines:
        stripped = line.strip()
        
        # 1. Detect Section Start (Flexible)
        if "weekly schedule" in stripped.lower() and stripped.startswith("##"):
            in_schedule = True
            print("   -> Found 'Weekly Schedule' section.")
            continue
        
        # 2. Detect Section End
        if in_schedule and stripped.startswith("##") and "weekly schedule" not in stripped.lower():
            in_schedule = False
            print("   -> End of section reached.")
            continue

        if not in_schedule:
            continue

        # 3. Detect Table Header
        if stripped.startswith("|") and "date" in stripped.lower() and not headers:
            # Parse Headers
            raw_headers = [h.strip().lower() for h in stripped.strip("|").split("|")]
            headers = raw_headers
            
            # Map standard keys to column indices
            for idx, h in enumerate(headers):
                if "date" in h: header_map["date"] = idx
                elif "activity" in h or "workout" in h: header_map["activity"] = idx
                elif "type" in h or "sport" in h: header_map["type"] = idx
                elif "duration" in h or "time" in h: header_map["duration"] = idx
                elif "notes" in h: header_map["notes"] = idx

            print(f"   -> Found headers: {headers}")
            print(f"   -> Mapped columns: {header_map}")
            continue

        # 4. Process Rows
        if stripped.startswith("|") and not "---" in stripped and headers:
            cols = [c.strip() for c in stripped.strip("|").split("|")]
            
            # Ensure we have enough columns to match the headers
            if len(cols) != len(headers):
                # Sometimes splitting by pipe creates empty strings at edges if spacing is off
                # Try to adjust if length matches reasonably well
                pass 

            entry = {
                "id": str(uuid.uuid4()),
                "status": "PLANNED",
                "completed": False,
                # Default numeric fields for app.js compatibility
                "actualDuration": 0, "distance": 0, "averageHR": 0,
                "maxHR": 0, "avgPower": 0, "calories": 0, "RPE": 0, "Feeling": 0
            }

            try:
                # --- DATE ---
                if "date" in header_map:
                    raw_date = cols[header_map["date"]]
                    # Try converting YYYY-MM-DD
                    try:
                        dt = datetime.datetime.strptime(raw_date, "%Y-%m-%d")
                        entry["date"] = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        entry["date"] = raw_date
                else:
                    continue # No date, skip row

                # --- ACTIVITY NAME ---
                if "activity" in header_map:
                    entry["activityName"] = cols[header_map["activity"]]
                else:
                    entry["activityName"] = "Workout"

                # --- TYPE ---
                if "type" in header_map:
                    entry["activityType"] = normalize_sport(cols[header_map["type"]])
                else:
                    # Guess from Name
                    entry["activityType"] = normalize_sport(entry["activityName"])

                # --- DURATION ---
                if "duration" in header_map:
                    entry["plannedDuration"] = parse_duration(cols[header_map["duration"]])
                else:
                    entry["plannedDuration"] = 0

                # --- NOTES ---
                if "notes" in header_map:
                    entry["notes"] = cols[header_map["notes"]]
                else:
                    entry["notes"] = ""

                json_output.append(entry)

            except Exception as e:
                # print(f"⚠️ Skipped Row: {cols} | {e}")
                continue

    # 5. Output Results
    print(f"✅ Parsed {len(json_output)} workouts.")
    
    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(json_output, f, indent=4)
        
    print(f"💾 Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    parse_plan()
