import os
import datetime
from garminconnect import Garmin

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
HEALTH_FILE = os.path.join(PROJECT_ROOT, 'garmind_data', 'garmin_health.md')
BRIEFING_FILE = os.path.join(PROJECT_ROOT, 'COACH_BRIEFING.md')
DAYS_TO_FETCH = 14

def get_credentials():
    return os.environ.get('GARMIN_EMAIL'), os.environ.get('GARMIN_PASSWORD')

def generate_health_table(data):
    """Converts list of dicts to Markdown table."""
    lines = ["# Daily Health & Readiness", "", "| Date | RHR | HRV (ms) | Sleep Score | Body Battery | Status |", "|---|---|---|---|---|---|"]
    
    # Sort descending
    data.sort(key=lambda x: x['date'], reverse=True)
    
    for d in data:
        # Simple status logic
        status = "Balanced"
        if d['hrv'] and d['hrv'] < 35: status = "Strained"
        elif d['sleep'] and d['sleep'] < 50: status = "Tired"
        
        row = f"| {d['date']} | {d['rhr'] or '--'} | {d['hrv'] or '--'} | {d['sleep'] or '--'} | {d['bb'] or '--'} | {status} |"
        lines.append(row)
    
    return "\n".join(lines)

def update_coach_briefing(latest_health):
    """Injects the latest health stats into the Coach Briefing."""
    if not os.path.exists(BRIEFING_FILE): return

    with open(BRIEFING_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Construct the Readiness Section
    rhr = latest_health.get('rhr', 0)
    hrv = latest_health.get('hrv', 0)
    sleep = latest_health.get('sleep', 0)
    
    readiness_level = "HIGH"
    advice = "Green light for Key Workouts."
    
    if (rhr and rhr > 55) or (hrv and hrv < 35) or (sleep and sleep < 60):
        readiness_level = "MODERATE"
        advice = "Consider reducing intensity if feeling fatigue."
    if (sleep and sleep < 40) or (hrv and hrv < 25):
        readiness_level = "LOW"
        advice = "⚠️ RECOVERY MODE: Downgrade Key Workouts to Z2."

    section = f"""
## 🏥 Health & Readiness (Latest: {latest_health['date']})
* **Resting HR:** {rhr} bpm
* **HRV Status:** {hrv} ms
* **Sleep Score:** {sleep}/100
* ** AI Auto-Regulation:** **{readiness_level}** - {advice}
"""

    # Replace or Append
    if "## 🏥 Health & Readiness" in content:
        # Regex replacement could be safer, but simple split works for fixed headers
        pre, post = content.split("## 🏥 Health & Readiness", 1)
        # Find end of section (next header)
        next_header_idx = post.find("\n#")
        if next_header_idx == -1: next_header_idx = len(post)
        
        new_content = pre + section.strip() + "\n\n" + post[next_header_idx:].strip()
    else:
        new_content = section + "\n" + content

    with open(BRIEFING_FILE, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("   📝 Updated Coach Briefing with latest health stats.")

def main():
    email, password = get_credentials()
    if not email or not password:
        print("❌ Credentials missing.")
        return

    print(f"🏥 Fetching Health Data (Last {DAYS_TO_FETCH} Days)...")
    try:
        client = Garmin(email, password)
        client.login()
        
        health_data = []
        today = datetime.date.today()
        
        for i in range(DAYS_TO_FETCH):
            d = today - datetime.timedelta(days=i)
            d_str = d.isoformat()
            
            try:
                # 1. RHR
                rhr_data = client.get_rhr_day(d_str)
                rhr = rhr_data.get('restingHeartRate') if rhr_data else None
                
                # 2. HRV (Summary)
                # Note: HRV endpoints vary by device. Using generic approach.
                hrv = None
                try:
                    hrv_data = client.get_hrv_data(d_str)
                    if hrv_data and 'hrvSummary' in hrv_data:
                        hrv = hrv_data['hrvSummary'].get('weeklyAverage') # or lastNightAvg
                except: pass

                # 3. Sleep
                sleep_data = client.get_sleep_data(d_str)
                sleep = sleep_data.get('dailySleepDTO', {}).get('sleepScores', {}).get('overall', {}).get('value')
                
                # 4. Body Battery (Stress)
                bb = None # Add logic if API supports it easily
                
                health_data.append({
                    'date': d_str,
                    'rhr': rhr,
                    'hrv': hrv,
                    'sleep': sleep,
                    'bb': bb
                })
                print(f"   - {d_str}: RHR={rhr}, Sleep={sleep}")
                
            except Exception as e:
                print(f"   x Failed for {d_str}: {e}")

        # Save to Markdown
        md_content = generate_health_table(health_data)
        with open(HEALTH_FILE, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print("   💾 Saved to garmin_health.md")

        # Update Briefing
        if health_data:
            update_coach_briefing(health_data[0])

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
