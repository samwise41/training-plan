import os
import datetime
import time
from garminconnect import Garmin

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
HEALTH_FILE = os.path.join(PROJECT_ROOT, 'garmind_data', 'garmin_health.md')
BRIEFING_FILE = os.path.join(PROJECT_ROOT, 'COACH_BRIEFING.md')

# Look back this many days to fill gaps. 
HISTORY_WINDOW_DAYS = 30  # Increased to catch recent history

def get_credentials():
    return os.environ.get('GARMIN_EMAIL'), os.environ.get('GARMIN_PASSWORD')

def parse_existing_health_db():
    """Reads the Markdown table and returns a dict of {date_str: data_dict}."""
    if not os.path.exists(HEALTH_FILE):
        return {}
    
    existing_data = {}
    with open(HEALTH_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for line in lines:
        if not line.strip().startswith('|'): continue
        if 'Date' in line or '---' in line: continue
        
        # Parse Row: | Date | RHR | HRV | Sleep | BB | Status |
        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 7: continue
        
        date_str = parts[1]
        try:
            # Validate date format
            datetime.datetime.strptime(date_str, '%Y-%m-%d')
            
            # Helper to parse int or None
            def parse_val(v):
                return int(v) if v and v != '--' and v.isdigit() else None

            existing_data[date_str] = {
                'date': date_str,
                'rhr': parse_val(parts[2]),
                'hrv': parse_val(parts[3]),
                'sleep': parse_val(parts[4]),
                'bb': parse_val(parts[5])
            }
        except:
            continue
            
    return existing_data

def generate_health_table(data_dict):
    """Converts dict of data back to Markdown table."""
    lines = ["# Daily Health & Readiness", "", "| Date | RHR | HRV (ms) | Sleep Score | Body Battery | Status |", "|---|---|---|---|---|---|"]
    
    # Sort descending by date
    sorted_dates = sorted(data_dict.keys(), reverse=True)
    
    for d_str in sorted_dates:
        row = data_dict[d_str]
        
        rhr = row.get('rhr')
        hrv = row.get('hrv')
        sleep = row.get('sleep')
        bb = row.get('bb')
        
        # Status Logic
        status = "Balanced"
        if hrv and hrv < 35: status = "Strained"
        elif sleep and sleep < 50: status = "Tired"
        elif bb and bb < 25: status = "Drained"
        elif rhr and rhr > 60: status = "Elevated" # Example threshold
        
        # Format
        r_str = str(rhr) if rhr is not None else "--"
        h_str = str(hrv) if hrv is not None else "--"
        s_str = str(sleep) if sleep is not None else "--"
        b_str = str(bb) if bb is not None else "--"
        
        lines.append(f"| {d_str} | {r_str} | {h_str} | {s_str} | {b_str} | {status} |")
    
    return "\n".join(lines)

def update_coach_briefing(latest_health):
    """Injects the latest health stats into the Coach Briefing."""
    if not os.path.exists(BRIEFING_FILE): return

    with open(BRIEFING_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    rhr = latest_health.get('rhr') or 0
    hrv = latest_health.get('hrv') or 0
    sleep = latest_health.get('sleep') or 0
    bb = latest_health.get('bb') or 0
    
    readiness_level = "HIGH"
    advice = "Green light for Key Workouts."
    
    # Simple Readiness Logic
    warnings = []
    if rhr > 60: warnings.append("Elevated RHR")
    if hrv > 0 and hrv < 35: warnings.append("Low HRV")
    if sleep > 0 and sleep < 60: warnings.append("Poor Sleep")
    if bb > 0 and bb < 30: warnings.append("Low Body Battery")

    if len(warnings) >= 1:
        readiness_level = "MODERATE"
        advice = f"Monitor fatigue ({', '.join(warnings)})."
    if len(warnings) >= 2 or (hrv > 0 and hrv < 25):
        readiness_level = "LOW"
        advice = "⚠️ RECOVERY PRIORITY. Downgrade intensity."

    section = f"""
## 🏥 Health & Readiness (Latest: {latest_health['date']})
* **Resting HR:** {rhr if rhr > 0 else '--'} bpm
* **HRV Status:** {hrv if hrv > 0 else '--'} ms
* **Sleep Score:** {sleep if sleep > 0 else '--'}/100
* **Body Battery:** {bb if bb > 0 else '--'}/100
* ** AI Auto-Regulation:** **{readiness_level}** - {advice}
"""

    if "## 🏥 Health & Readiness" in content:
        pre, post = content.split("## 🏥 Health & Readiness", 1)
        next_header_idx = post.find("\n#")
        if next_header_idx == -1: next_header_idx = len(post)
        new_content = pre + section.strip() + "\n\n" + post[next_header_idx:].strip()
    else:
        new_content = section + "\n" + content

    with open(BRIEFING_FILE, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("   📝 Updated Coach Briefing.")

def main():
    email, password = get_credentials()
    if not email or not password:
        print("❌ Credentials missing.")
        return

    print(f"🏥 Syncing Health Data (Last {HISTORY_WINDOW_DAYS} Days)...")
    
    # 1. Load History
    db = parse_existing_health_db()
    print(f"   - Loaded {len(db)} existing days.")

    try:
        client = Garmin(email, password)
        client.login()
        
        today = datetime.date.today()
        
        for i in range(HISTORY_WINDOW_DAYS):
            d = today - datetime.timedelta(days=i)
            d_str = d.isoformat()
            
            # Skip if we already have full data (RHR+HRV+Sleep+BB)
            if d_str in db:
                entry = db[d_str]
                if entry.get('rhr') and entry.get('hrv') and entry.get('sleep') and entry.get('bb'):
                    continue 

            print(f"   🔎 Fetching {d_str}...")
            
            # --- FETCH RHR ---
            rhr = None
            try:
                rhr_data = client.get_rhr_day(d_str)
                # Try common keys
                if rhr_data:
                    rhr = rhr_data.get('restingHeartRate')
            except: pass

            # --- FETCH HRV ---
            hrv = None
            try:
                hrv_data = client.get_hrv_data(d_str)
                if hrv_data:
                    # Priority 1: Last Night Avg
                    hrv = hrv_data.get('hrvSummary', {}).get('lastNightAvg')
                    # Priority 2: Weekly Avg
                    if not hrv: hrv = hrv_data.get('hrvSummary', {}).get('weeklyAverage')
            except: pass

            # --- FETCH SLEEP ---
            sleep = None
            try:
                sleep_data = client.get_sleep_data(d_str)
                if sleep_data:
                    # Priority 1: Overall Score
                    sleep = sleep_data.get('dailySleepDTO', {}).get('sleepScores', {}).get('overall', {}).get('value')
                    # Priority 2: Calculated from quality if score missing
                    if not sleep: 
                        # Sometimes score isn't there, check for raw sleep time to confirm data exists at least
                        if sleep_data.get('dailySleepDTO', {}).get('sleepTimeSeconds'):
                             # Can't fake a score, but we know data exists. Leave None or partial.
                             pass
            except: pass

            # --- FETCH BODY BATTERY ---
            bb = None
            try:
                # Body Battery is often a list of values throughout the day. We want the MAX or LAST.
                # Standard endpoint: get_body_battery(date)
                bb_data = client.get_body_battery(d_str) 
                if bb_data:
                    # It usually returns a list of dictionaries [{'date':..., 'bodyBattery':...}, ...]
                    # We want the highest value of the day (Morning recharge)
                    vals = [x.get('value', 0) for x in bb_data if x.get('value')]
                    if vals: bb = max(vals)
            except: pass

            # Update DB if we found ANYTHING
            if rhr or hrv or sleep or bb:
                db[d_str] = {
                    'date': d_str,
                    'rhr': rhr,
                    'hrv': hrv,
                    'sleep': sleep,
                    'bb': bb
                }
                print(f"      -> RHR:{rhr} | HRV:{hrv} | Sleep:{sleep} | BB:{bb}")
            else:
                print("      -> No data found.")

            # Respect rate limits
            time.sleep(1)

        # Save
        md_content = generate_health_table(db)
        with open(HEALTH_FILE, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print("   💾 Saved to garmin_health.md")

        # Briefing
        sorted_keys = sorted(db.keys(), reverse=True)
        if sorted_keys:
            update_coach_briefing(db[sorted_keys[0]])

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
