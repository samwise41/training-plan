import os
import sys
import pandas as pd
from garminconnect import Garmin
from datetime import date, timedelta
import time

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_FILE = os.path.join(ROOT_DIR, 'garmind_data', 'garmin_health.md')
DAYS_TO_FETCH = 60  # How far back to look

# --- CREDENTIALS ---
EMAIL = os.environ.get('GARMIN_EMAIL')
PASSWORD = os.environ.get('GARMIN_PASSWORD')

def init_garmin():
    if not EMAIL or not PASSWORD:
        print("❌ Error: Credentials missing.")
        sys.exit(1)
    
    try:
        print("🔐 Authenticating with Garmin Connect...")
        client = Garmin(EMAIL, PASSWORD)
        client.login()
        return client
    except Exception as e:
        print(f"❌ Login Failed: {e}")
        sys.exit(1)

def fetch_daily_stats(client, start_date, end_date):
    print(f"📡 Fetching Health Data from {start_date} to {end_date}...")
    
    days = (end_date - start_date).days + 1
    data = []

    # Garmin API can be sensitive to rapid requests, so we loop carefully
    # Optimization: 'get_user_summary' usually works for a single date
    
    for i in range(days):
        current_date = end_date - timedelta(days=i)
        date_str = current_date.isoformat()
        
        try:
            # 1. Fetch Daily Summary (Contains RHR, Steps, Stress)
            summary = client.get_user_summary(date_str)
            
            # 2. Extract Key Metrics
            rhr = summary.get('restingHeartRate')
            total_steps = summary.get('totalSteps')
            avg_stress = summary.get('averageStressLevel')
            body_batt_max = summary.get('maxBodyBattery')
            body_batt_min = summary.get('minBodyBattery')
            
            # 3. Fetch Sleep Data (Separate Endpoint usually required for details, 
            # but summary often has 'sleepingSeconds')
            sleep_sec = summary.get('sleepingSeconds')
            sleep_hrs = round(sleep_sec / 3600, 1) if sleep_sec else None
            
            # 4. Sleep Score (If available)
            sleep_score = summary.get('sleepScore')

            # Only add if we have at least RHR or Sleep
            if rhr or sleep_hrs:
                print(f"   ✅ {date_str}: RHR {rhr} | Sleep {sleep_hrs}h | Stress {avg_stress}")
                data.append({
                    'Date': date_str,
                    'Resting HR': rhr if rhr else '--',
                    'Sleep Hours': sleep_hrs if sleep_hrs else '--',
                    'Sleep Score': sleep_score if sleep_score else '--',
                    'Stress Avg': avg_stress if avg_stress else '--',
                    'Body Batt Max': body_batt_max if body_batt_max else '--',
                    'Steps': total_steps if total_steps else '--'
                })
            else:
                print(f"   ⚠️ {date_str}: No significant health data.")
                
        except Exception as e:
            print(f"   ❌ {date_str}: Error fetching ({str(e)})")
        
        # Polite delay
        time.sleep(0.5)

    return data

def save_to_markdown(data):
    if not data:
        print("⚠️ No data to save.")
        return

    df = pd.DataFrame(data)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    print(f"💾 Saving {len(df)} records to {OUTPUT_FILE}...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("# Garmin Health & Biometrics\n\n")
        f.write(f"**Last Updated:** {date.today().isoformat()}\n\n")
        f.write(df.to_markdown(index=False))
        
    print("✅ Done.")

def main():
    client = init_garmin()
    
    today = date.today()
    start_date = today - timedelta(days=DAYS_TO_FETCH)
    
    health_data = fetch_daily_stats(client, start_date, today)
    save_to_markdown(health_data)

if __name__ == "__main__":
    main()
