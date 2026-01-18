import sys
import os

# Ensure we can import from local modules
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(SCRIPT_DIR)

# Import our new modular components
import _01_fetch_garmin
import _01_analyze_trends
from modules import config, sync_database, update_visuals, git_ops

def main():
    print("🚀 STARTING DAILY TRAINING SYNC")
    print("==================================================")

    # STEP 1: Fetch from Garmin
    # (Captures RPE, Feeling, and raw stats to JSON)
    try:
        _01_fetch_garmin.main()
    except Exception as e:
        print(f"⚠️ Garmin Fetch Warning: {e}")
        # We continue even if fetch fails, so we can re-process existing data

    # STEP 2: Sync Database
    # (Merges Plan + JSON -> Master DB)
    # Returns the List of Records (JSON)
    db_data = sync_database.sync()

    # STEP 3: Analyze Trends
    # (Generates Coach Briefing from the fresh DB)
    try:
        _01_analyze_trends.main()
    except Exception as e:
        print(f"⚠️ Analysis Warning: {e}")

    # STEP 4: Update Visuals
    # (Updates checkmarks in the Markdown Plan)
    # FIX: Check if list has items (db_data is a list, not a DataFrame)
    if db_data and len(db_data) > 0:
        update_visuals.update_weekly_plan(db_data)
    else:
        print("⚠️ No database data returned; skipping visual update.")

    # STEP 5: Save to GitHub
    try:
        git_ops.push_changes()
    except Exception as e:
        print(f"⚠️ Git Warning: {e}")

    print("\n==================================================")
    print("✅ DAILY SYNC COMPLETE")

if __name__ == "__main__":
    main()
