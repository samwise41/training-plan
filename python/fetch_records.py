import os
import sys
import json
from garminconnect import Garmin

# --- CREDENTIALS (Reusing your existing setup) ---
EMAIL = os.environ.get('GARMIN_EMAIL')
PASSWORD = os.environ.get('GARMIN_PASSWORD')

def init_garmin():
    if not EMAIL or not PASSWORD:
        print("❌ Error: Credentials missing. Set GARMIN_EMAIL and GARMIN_PASSWORD.")
        sys.exit(1)
    
    try:
        print("🔐 Authenticating with Garmin Connect...")
        client = Garmin(EMAIL, PASSWORD)
        client.login()
        return client
    except Exception as e:
        print(f"❌ Login Failed: {e}")
        sys.exit(1)

def fetch_personal_records(client):
    print("🏆 Fetching Personal Records...")
    
    try:
        # This returns a dictionary with keys usually like 'running', 'cycling', etc.
        records = client.get_personal_record()
        
        # Save raw JSON for inspection
        with open('garmind_data/my_personal_records.json', 'w', encoding='utf-8') as f:
            json.dump(records, f, indent=4)
            
        print("\n=== 🏃 RUNNING RECORDS ===")
        print_records(records, 'running')

        print("\n=== 🚴 CYCLING RECORDS ===")
        print_records(records, 'cycling')

        print("\n=== 🏊 SWIMMING RECORDS ===")
        print_records(records, 'swimming')
        
        print(f"\n💾 Full data saved to 'my_personal_records.json'")

    except Exception as e:
        print(f"❌ Failed to fetch records: {e}")

def print_records(data, sport_key):
    if sport_key not in data:
        print("   (No records found)")
        return

    # Garmin usually returns a list of records for the sport
    sport_records = data[sport_key]
    
    for r in sport_records:
        type_name = r.get('typeId', 'Unknown')
        
        # Determine the display value (Time vs Distance)
        value_str = ""
        if 'value' in r:
            # If it's a duration record (like 5k), value is usually seconds
            seconds = r['value']
            # Format nicely (HH:MM:SS)
            m, s = divmod(seconds, 60)
            h, m = divmod(m, 60)
            if h > 0:
                value_str = f"{int(h)}h {int(m)}m {int(s)}s"
            else:
                value_str = f"{int(m)}m {int(s)}s"
        elif 'distance' in r:
            # If it's a distance record (like Longest Run), value is meters
            dist_km = r['distance'] / 1000
            value_str = f"{dist_km:.2f} km"

        # Lookup friendly names for common IDs if needed, 
        # but Garmin often provides a 'typeKey' or similar you can print.
        label = r.get('typeKey', type_name).replace('_', ' ').title()
        
        # Date of the record
        date_str = r.get('activityDate', 'Unknown Date')[:10]

        print(f"   🏅 {label}: {value_str} ({date_str})")

def main():
    client = init_garmin()
    fetch_personal_records(client)

if __name__ == "__main__":
    main()
