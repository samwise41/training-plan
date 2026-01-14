import sys
from modules import config, fetch_garmin, sync_database, analyze_trends, update_visuals, git_ops

def main():
    print("🚀 STARTING DAILY UPDATE WORKFLOW")

    # Step 1: Get Data
    try:
        fetch_garmin.main() # Updates JSON
    except Exception as e:
        print(f"⚠️ Fetch warning: {e}")

    # Step 2: Process Data
    # (Matches Plan vs Actuals, Calculates RPE/Feeling/TSS)
    sync_database.main() 

    # Step 3: Analytics
    # (Generates the Coach Briefing)
    analyze_trends.main()

    # Step 4: Visuals
    # (Updates the checkmarks in your endurance_plan.md)
    update_visuals.main()

    # Step 5: Save
    git_ops.push_changes()

    print("✅ WORKFLOW COMPLETE")

if __name__ == "__main__":
    main()
