import requests
import os
from dotenv import load_dotenv

load_dotenv()

INPUT_FILE = "activity_ids.txt"
LOG_FILE = "processed_log.txt"
OUTPUT_MD = "my_prs.md"
BATCH_SIZE = 50 

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
    return f"{m:02d}:{s:02d}"

def get_medal(rank):
    if rank == 1: return "🥇"
    if rank == 2: return "🥈"
    if rank == 3: return "🥉"
    return ""

def scan_activities():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Error: {INPUT_FILE} not found.")
        return

    # 1. Load Processed History
    processed_ids = set()
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "r") as f:
            processed_ids = set(line.strip() for line in f)

    # 2. Find Unprocessed items
    to_scan = []
    with open(INPUT_FILE, "r") as f:
        for line in f:
            parts = line.strip().split(',')
            # Check if ID is valid and NOT in the log
            if len(parts) >= 1 and parts[0] not in processed_ids:
                to_scan.append(line.strip())

    if not to_scan:
        print("✅ No new activities to scan.")
        return

    print(f"🔍 Found {len(to_scan)} new activities. Processing...")

    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    prs_found = []
    processed_in_this_run = []
    
    # Process batch
    batch = to_scan[:BATCH_SIZE]

    for line in batch:
        parts = line.split(',')
        act_id, act_type, act_date = parts[0], parts[1], parts[2]
        
        try:
            processed_in_this_run.append(act_id) # Mark as seen

            # Only scan Runs for "Best Efforts"
            if act_type != "Run": 
                continue

            detail_url = f"https://www.strava.com/api/v3/activities/{act_id}"
            response = requests.get(detail_url, headers=headers)
            if response.status_code != 200: continue
                
            data = response.json()
            
            # --- EXTRACT BEST EFFORTS ---
            if 'best_efforts' in data:
                for effort in data['best_efforts']:
                    rank = effort.get('pr_rank')
                    if rank in [1, 2, 3]:
                        medal = get_medal(rank)
                        row = f"| {medal} | {effort['name']} | {format_time(effort['elapsed_time'])} | {act_date} | [Link](https://www.strava.com/activities/{act_id}) |"
                        prs_found.append(row)
                        print(f"   {medal} Found {effort['name']}!")

        except Exception as e:
            print(f"Error: {e}")
            continue

    # 3. Append New PRs
    if prs_found:
        print(f"\n🏆 Found {len(prs_found)} new Best Efforts!")
        with open(OUTPUT_MD, "a", encoding="utf-8") as f:
            for pr in prs_found:
                f.write(f"{pr}\n")

    # 4. Update Log
    with open(LOG_FILE, "a") as f:
        for pid in processed_in_this_run:
            f.write(f"{pid}\n")

if __name__ == "__main__":
    scan_activities()
