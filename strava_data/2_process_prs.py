import requests
import os
from dotenv import load_dotenv

load_dotenv()

INPUT_FILE = "activity_ids.txt"
OUTPUT_MD = "my_prs.md"
AUTH_URL = "https://www.strava.com/oauth/token"
BATCH_SIZE = 80 

def get_access_token():
    payload = {
        'client_id': os.getenv('STRAVA_CLIENT_ID'),
        'client_secret': os.getenv('STRAVA_CLIENT_SECRET'),
        'refresh_token': os.getenv('STRAVA_REFRESH_TOKEN'),
        'grant_type': 'refresh_token',
        'f': 'json'
    }
    res = requests.post(AUTH_URL, data=payload, verify=True)
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

    with open(INPUT_FILE, "r") as f:
        lines = f.readlines()

    token = get_access_token()
    headers = {'Authorization': f"Bearer {token}"}
    
    prs_found = []
    count = 0
    
    print(f"🚦 Scanning {BATCH_SIZE} activities...")

    for line in lines:
        if count >= BATCH_SIZE: break

        parts = line.strip().split(',')
        if len(parts) < 3: continue
        
        act_id, act_type, act_date = parts[0], parts[1], parts[2]
        
        try:
            detail_url = f"https://www.strava.com/api/v3/activities/{act_id}"
            response = requests.get(detail_url, headers=headers)
            if response.status_code != 200: continue
            
            data = response.json()
            count += 1
            
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
                        
        except Exception:
            continue

    if prs_found:
        print(f"\n🏆 Found {len(prs_found)} PRs!")
        file_exists = os.path.exists(OUTPUT_MD)
        with open(OUTPUT_MD, "a", encoding="utf-8") as f:
            if not file_exists:
                f.write("# 🏆 Strava PRs\n\n| Type | Name | Time | Date | Link |\n|---|---|---|---|---|\n")
            for pr in prs_found:
                f.write(f"{pr}\n")
    else:
        print("\n🤷 No PRs in this batch.")

if __name__ == "__main__":
    scan_activities()
