# 🏃‍♂️ Endurance Training Data Pipeline SOP

## 1. Purpose
This document outlines the standard operating procedure for managing, migrating, and archiving endurance training data using the automated Python/Git pipeline.
Files locations in C:\Users\samwi\Documents\Training Plan

---

## 2. System Architecture
The system operates as a "distributed truth" model where GitHub serves as the primary repository.
* **Source:** `endurance_plan.md` (Planned workouts)
* **Telemetry:** Garmin Connect (Actual performance data)
* **Automation:** `migrate_weekly_data.py` & `hydrate_master_db.py`
* **Archive:** `MASTER_TRAINING_DATABASE.md` (Permanent history)

---

## 3. Weekly Workflow

### Step A: Mark Workouts as Completed
During the week, update your progress in `endurance_plan.md`.
1. Open the file (locally or via GitHub web interface).
2. Locate the table under **## 5. Weekly Schedule**.
3. Change the **Status** column to `COMPLETED`.
4. (Optional) Add your manual **Actual Duration** or **Notes**.
5. Save/Commit the changes.

### Step B: Execute Migration
Run the migration script on your local machine once or twice a week.
1. Open your terminal in the project folder.
2. Run: `python migrate_weekly_data.py`.
3. The script will:
    * **Pull:** Sync with GitHub to get your latest edits.
    * **Fetch:** Download latest Garmin activity JSON.
    * **Link:** Match your plan to your watch data.
    * **Push:** Upload the updated Master Database to GitHub.

---

## 4. Manual Data Correction (Hydration)
If a workout is archived but labeled as `Match Status: Manual`, it means the auto-matcher couldn't find the Garmin file.

### How to Fix:
1. Log in to **Garmin Connect** on the web.
2. Open the specific activity and copy the **Activity ID** from the URL (e.g., `garmin.com/../activity/123456789`).
3. Open `MASTER_TRAINING_DATABASE.md`.
4. Paste the ID into the `activityId` column for that workout row.
5. Run the repair script: `python hydrate_master_db.py`.
6. This script will pull the telemetry (HR, Power, TSS) for that ID and update the record.

---

## 5. Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `fatal: not a git repository` | Folder is unlinked | Run `git init`, `git remote add origin [URL]`, and `git reset --hard origin/main`. |
| `FileNotFoundError` | Path mismatch | Ensure the script is running in the same folder as your `.md` files. |
| `Match Status: Manual` | Date/Type mismatch | Manually add `activityId` to the Master DB and run the Hydrator script. |
| Files not updating | Git Conflict | Run `git fetch --all` then `git reset --hard origin/main`. |

---

## 6. Maintenance
* **Google Drive:** Ensure the Google Drive app is running to keep local files synced, but always trust the **Git Push** confirmation as the final word.
* **JSON Growth:** The `my_garmin_data_ALL.json` will grow over time. This is normal and provides the backup for your entire history.
