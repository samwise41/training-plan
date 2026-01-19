import re
import json
import uuid
import datetime
from pathlib import Path

# --- CONFIGURATION ---
PLAN_FILE = Path("endurance_plan.md")
OUTPUT_FILE = Path("data/planned.json")

# User-defined Tags -> App Standard Types
TAG_MAP = {
    "RUN": "Run",
    "BIKE": "Bike",
    "SWIM": "Swim",
    "REST": "Rest",
    "STRENGTH": "Strength"
}

def parse_duration(duration_str):
    """Parses '1h 30m', '45m', '1:30', '45' into total minutes."""
    if not duration_str or str(duration_str).strip() == "-":
        return 0
    
    s = str(duration_str).lower().strip()
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
            
    # Format: Just number (assume minutes if reasonable)
    if total_minutes == 0:
        num_match = re.search(r'(\d+)', s)
        if num_match:
            total_minutes = int(num_match.group(1))
        
    return total_minutes

def extract_sport_from_tags(activity_name):
    """
    STRICT: Looks for [TAG] in the activity name string.
    Example: "[BIKE] Interval Session" -> "Bike"
    Returns "Other" if no valid tag is found.
    """
    if not activity_name:
        return "Other"
    
    # Regex: Find content inside square brackets
    # Handles [BIKE], [ RUN ], [Swim]
    match = re.search(r'\[\s*(\w+)\s*\]', str(activity_name), re.IGNORECASE)
    
    if match:
        tag_content = match.group(1).upper()
        if tag_content in TAG_MAP:
            return TAG_MAP[tag_content]
    
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
    header_map = {} 

    for line in lines:
        stripped = line.strip()
        
        # 1. Detect Section Start
        if "weekly schedule" in stripped.lower() and stripped.startswith("##"):
            in_schedule = True
            print("   -> Found 'Weekly Schedule' section.")
            continue
        
        # 2. Detect Section End
        if in_schedule and stripped.startswith("##") and "weekly schedule" not in stripped.lower():
            in_schedule = False
            continue

        if not in_schedule:
            continue

        # 3. Detect Table Header
        if stripped.startswith("|") and "date" in stripped.lower() and not headers:
            raw_headers = [h.strip() for h in stripped.strip("|").split("|")]
            headers = [h.lower() for h in raw_headers]
            
            print(f"   -> Raw Headers Found: {raw_headers}")

            # Map standard keys to column indices
            for idx, h in enumerate(headers):
                if "date" in h: header_map["date"] = idx
                elif "activity" in h or "workout" in h or "name" in h: header_map["activity"] = idx
                elif "duration" in h or "time" in h or "planned" in h: header_map["duration"] = idx
                elif "notes" in h or "desc" in h: header_map["notes"] = idx

            print(f"   -> Mapped Columns: {header_map}")
            continue

        # 4. Process Rows
        if stripped.startswith("|") and not "---" in stripped and headers:
            cols = [c.strip() for c in stripped.strip("|").split("|")]
            
            # Validation: Must have at least a date
            if "date" in header_map and len(cols) <= header_map["date"]:
                continue

            entry = {
                "id": str(uuid.uuid4()),
                "status": "PLANNED",
                "completed": False,
                # Default numeric fields for app compatibility
                "actualDuration": 0, "distance": 0, "averageHR": 0,
                "maxHR": 0, "avgPower": 0, "calories": 0, "RPE": 0, "Feeling": 0
            }

            try:
                # --- DATE ---
                if "date" in header_map and len(cols) > header_map["date"]:
                    raw_date = cols[header_map["date"]]
                    try:
                        dt = datetime.datetime.strptime(raw_date, "%Y-%m-%d")
                        entry["date"] = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        entry["date"] = raw_date
                else:
                    continue 

                # --- ACTIVITY NAME (Source of Truth for Type) ---
                if "activity" in header_map and len(cols) > header_map["activity"]:
                    entry["activityName"] = cols[header_map["activity"]]
                else:
                    entry["activityName"] = "Workout"

                # --- STRICT TYPE DETECTION ---
                # Only use the [TAG] from the name. No guessing.
                entry["activityType"] = extract_sport_from_tags(entry["activityName"])

                # --- DURATION ---
                if "duration" in header_map and len(cols) > header_map["duration"]:
                    dur_val = cols[header_map["duration"]]
                    entry["plannedDuration"] = parse_duration(dur_val)
                else:
                    entry["plannedDuration"] = 0

                # --- NOTES ---
                if "notes" in header_map and len(cols) > header_map["notes"]:
                    entry["notes"] = cols[header_map["notes"]]
                else:
                    entry["notes"] = ""

                json_output.append(entry)

            except Exception as e:
                print(f"⚠️ Error parsing row: {cols} | {e}")
                continue

    # 5. Output Results
    print(f"✅ Parsed {len(json_output)} workouts.")
    if len(json_output) > 0:
        print("   --- DEBUG: First 3 Rows Processed ---")
        for i, sample in enumerate(json_output[:3]):
            print(f"   {i+1}. Name: '{sample['activityName']}' -> Detected Type: {sample['activityType']}")
    
    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(json_output, f, indent=4)
        
    print(f"💾 Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    parse_plan()
