import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()

INPUT_FILE = "activity_ids.txt"
PROCESSED_LOG = "processed_log.txt"
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
    return f"{m:02d}:{s:02d}"

def get_medal(rank):
    if rank == 1: return "🥇"
    if rank == 2: return "🥈"
    if rank == 3: return "🥉"
    return ""

def scan_activities():
    if not os.path.exists(INPUT_FILE): return

    # 1. Load Processed IDs
    processed_ids = set()
    if os.path.exists(PROCESSED_LOG):
        with open(PROCESSED_LOG, "r") as f:
            processed_ids = set(line.strip() for line in f)

    # 2. Load Existing PRs (To prevent duplicates)
    existing_entries = set()
    if os.path.exists(OUTPUT_MD):
        with open(OUTPUT_MD, "r", encoding="utf-8") as f:
            for line in f:
                # Store the whole line to check for duplicates
                existing_entries.add(line.strip())

    # 3. Find New Activities
    to_scan = []
    with open(INPUT_FILE, "r") as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) >= 1 and parts[0] not in processed_ids:
                to_scan.append(line.strip())

    if not to_scan:
        print("✅ No new runs to scan.")
        return

    print(f"🏃 Scanning {len(to_scan)} new activities for PRs...")
    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    new_prs = []
    new_processed = []
    
    for line in to_scan[:BATCH_SIZE]:
        parts = line.split(',')
        act_id, act_type, act_date = parts[0], parts[1], parts[2]
        new_processed.append(act_id)
        
        if act_type != "Run": continue

        try:
            detail_url = f"https://www.strava.com/api/v3/activities/{act_id}"
            response = requests.get(detail_url, headers=headers)
            if response.status_code != 200: continue
            data = response.json()
            
            if 'best_efforts' in data:
                for effort in data['best_efforts']:
                    rank = effort.get('pr_rank')
                    if rank in [1, 2, 3]:
                        medal = get_medal(rank)
                        effort_name = effort['name']
                        time_str = format_time(effort['elapsed_time'])
                        
                        # Create row string
                        row = f"| {medal} | {effort_name} | {time_str} | {act_date} | [View Run](https://www.strava.com/activities/{act_id}) |"
                        
                        # CHECK FOR DUPLICATE
                        if row not in existing_entries:
                            new_prs.append(row)
                            existing_entries.add(row) # Add to memory so we don't add it twice in this same run
                            print(f"   🏆 Found: {effort_name}")

        except Exception as e:
            print(f"Error on {act_id}: {e}")

    # 4. Append to File
    if new_prs:
        print(f"Writing {len(new_prs)} new PRs...")
        file_exists = os.path.exists(OUTPUT_MD)
        with open(OUTPUT_MD, "a", encoding="utf-8") as f:
            if not file_exists:
                f.write("# 🏃 My Best Efforts\n\n")
                f.write("| Rank | Distance | Time | Date | Link |\n")
                f.write("|:---:|---|---|---|---|\n")
            for pr in new_prs:
                f.write(f"{pr}\n")

    # 5. Update Log
    with open(PROCESSED_LOG, "a") as f:
        for pid in new_processed:
            f.write(f"{pid}\n")

if __name__ == "__main__":
    scan_activities()
