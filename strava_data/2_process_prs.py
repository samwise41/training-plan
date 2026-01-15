import requests
import os
from dotenv import load_dotenv

load_dotenv()

INPUT_FILE = "activity_ids.txt"
LOG_FILE = "processed_log.txt"  # New memory file
OUTPUT_MD = "my_prs.md"
BATCH_SIZE = 80 

def get_access_token():
    payload = {
        'client_id': os.getenv('STRAVA_CLIENT_ID'),
        'client_secret': os.getenv('STRAVA_CLIENT_SECRET'),
        'refresh_token': os.getenv('STRAVA_REFRESH_TOKEN'),
        'grant_type': 'refresh_token',
        'f': 'json'
    }
    res = requests.post("https://www.strava.com/oauth/token", data=payload, verify=True)
    return res.json()['access_token']

def format_time(seconds):
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h > 0: return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

def scan_activities():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Error: {INPUT_FILE} not found.")
        return

    # 1. Load History (Activities we have already scanned)
    processed_ids = set()
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            processed_ids = set(line.strip() for line in f)

    # 2. Identify what needs scanning
    to_scan = []
    with open(INPUT_FILE, "r") as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) >= 1 and parts[0] not in processed_ids:
                to_scan.append(line.strip())

    if not to_scan:
        print("✅ All activities up to date. Nothing to scan.")
        return

    print(f"🔍 Found {len(to_scan)} unscanned activities. Processing batch of {BATCH_SIZE}...")

    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    prs_found = []
    processed_in_this_run = []
    
    # Only process up to BATCH_SIZE
    batch = to_scan[:BATCH_SIZE]

    for line in batch:
        parts = line.split(',')
        act_id, act_type, act_date = parts[0], parts[1], parts[2]
        
        try:
            detail_url = f"https://www.strava.com/api/v3/activities/{act_id}"
            response = requests.get(detail_url, headers=headers)
            
            # Always mark as processed so we don't get stuck on a broken ID forever
            processed_in_this_run.append(act_id)

            if response.status_code != 200: continue
            data = response.json()
            
            # Check Running Best Efforts
            if 'best_efforts' in data:
                for effort in data['best_efforts']:
                    if effort.get('pr_rank') == 1:
                        prs_found.append(f"| 🏃 Run | {effort['name']} | {format_time(effort['moving_time'])} | {act_date} | [Link](https://www.strava.com/activities/{act_id}) |")

            # Check Cycling Segment Efforts
            if 'segment_efforts' in data:
                for effort in data['segment_efforts']:
                    if effort.get('pr_rank') == 1:
                        prs_found.append(f"| 🚴 Ride | {effort['name']} | {format_time(effort['moving_time'])} | {act_date} | [Link](https://www.strava.com/activities/{act_id}) |")
                        
        except Exception as e:
            print(f"Error on {act_id}: {e}")
            continue

    # 3. Save Results
    if prs_found:
        print(f"\n🏆 Found {len(prs_found)} NEW PRs!")
        file_exists = os.path.exists(OUTPUT_MD)
        with open(OUTPUT_MD, "a", encoding="utf-8") as f:
            if not file_exists:
                f.write("# 🏆 Strava PRs\n\n| Type | Name | Time | Date | Link |\n|---|---|---|---|---|\n")
            for pr in prs_found:
                f.write(f"{pr}\n")
    else:
        print("\n🤷 No PRs found in this batch.")

    # 4. Update the Log
    with open(LOG_FILE, "a") as f:
        for pid in processed_in_this_run:
            f.write(f"{pid}\n")
    print(f"💾 Marked {len(processed_in_this_run)} activities as processed.")

if __name__ == "__main__":
    scan_activities()
