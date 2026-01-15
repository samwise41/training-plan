import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()

# --- CONFIG ---
BASELINE_IDS = [
    16497718133, 
    16844864645
]

OUTPUT_ID_FILE = "activity_ids.txt"
OUTPUT_PR_FILE = "my_prs.md"
OUTPUT_LOG_FILE = "processed_log.txt"

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

def initialize():
    # 1. Remove Duplicates
    unique_ids = list(set(BASELINE_IDS))
    print(f"🧹 Cleaned list. Found {len(unique_ids)} unique activities.")

    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    activity_lines = []
    pr_rows = []
    processed_ids = []

    # 2. Process Each Baseline Activity
    print("🚀 Fetching baseline data...")
    
    for act_id in unique_ids:
        print(f"   ...Processing {act_id}")
        url = f"https://www.strava.com/api/v3/activities/{act_id}"
        res = requests.get(url, headers=headers)
        
        if res.status_code != 200:
            print(f"   ⚠️ Could not fetch {act_id} (Error {res.status_code})")
            continue
            
        data = res.json()
        
        # A. Prepare line for activity_ids.txt
        # Format: ID, Type, Date
        line = f"{data['id']},{data['type']},{data['start_date_local'][:10]}"
        activity_lines.append(line)
        processed_ids.append(str(data['id']))

        # B. Extract PRs immediately
        if 'best_efforts' in data:
            for effort in data['best_efforts']:
                rank = effort.get('pr_rank')
                if rank in [1, 2, 3]:
                    medal = get_medal(rank)
                    row = f"| {medal} | {effort['name']} | {format_time(effort['elapsed_time'])} | {data['start_date_local'][:10]} | [View Run](https://www.strava.com/activities/{act_id}) |"
                    pr_rows.append(row)

    # 3. Write Files
    
    # Write ID List
    with open(OUTPUT_ID_FILE, "w") as f:
        for line in activity_lines:
            f.write(f"{line}\n")
            
    # Write PRs to Markdown
    with open(OUTPUT_PR_FILE, "w", encoding="utf-8") as f:
        f.write("# 🏃 My Best Efforts\n\n")
        f.write("| Rank | Distance | Time | Date | Link |\n")
        f.write("|:---:|---|---|---|---|\n")
        for row in pr_rows:
            f.write(f"{row}\n")
            
    # Write Processed Log (So script 2 doesn't scan them again)
    with open(OUTPUT_LOG_FILE, "w") as f:
        for pid in processed_ids:
            f.write(f"{pid}\n")

    print("\n✅ BASELINE ESTABLISHED!")
    print(f"   - {OUTPUT_ID_FILE}: Created with {len(activity_lines)} entries.")
    print(f"   - {OUTPUT_PR_FILE}: Created with {len(pr_rows)} PRs.")
    print(f"   - {OUTPUT_LOG_FILE}: Updated.")

if __name__ == "__main__":
    initialize()
