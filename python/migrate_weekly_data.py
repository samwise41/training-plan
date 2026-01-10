import json

# --- CONFIGURATION ---

# Define the Sport Type IDs you want to keep.
# Common mapping examples (these vary by platform, e.g., Garmin vs Strava):
# 1: Running
# 2: Cycling
# 10: Strength Training
TARGET_SPORT_IDS = [1, 2, 5, 255] 

def filter_activities(activities):
    """
    Filters a list of activity dictionaries.
    1. Keeps only activities with sportTypeId in TARGET_SPORT_IDS.
    2. Removes activities marked as rest days or having 0 duration.
    """
    filtered_list = []

    for activity in activities:
        # --- CRITERIA 1: Check Sport Type ---
        # We use .get() to avoid errors if the key is missing
        sport_id = activity.get('sportTypeId')
        
        if sport_id not in TARGET_SPORT_IDS:
            continue  # Skip: Wrong sport type

        # --- CRITERIA 2: Check for Rest Days ---
        # Different APIs denote rest days differently.
        # We check a specific flag, or if duration/distance is effectively zero.
        is_rest_flag = activity.get('isRestDay', False)
        duration = activity.get('duration', 0)
        distance = activity.get('distance', 0)

        # If it is explicitly a rest day OR has no duration, we skip it.
        if is_rest_flag or duration <= 0:
            continue # Skip: It is a rest day or empty entry

        # If we passed all checks, keep the activity
        filtered_list.append(activity)

    return filtered_list

# --- MAIN EXECUTION ---

if __name__ == "__main__":
    # 1. Mock Data (Replace this with your API response or file load)
    raw_data = [
        # Valid Run
        {'id': 101, 'name': 'Morning Run', 'sportTypeId': 1, 'duration': 3600, 'distance': 5000, 'isRestDay': False},
        # Valid Ride
        {'id': 102, 'name': 'Evening Ride', 'sportTypeId': 2, 'duration': 5400, 'distance': 20000, 'isRestDay': False},
        # Invalid: Rest Day (Explicit flag)
        {'id': 103, 'name': 'Rest Day', 'sportTypeId': 1, 'duration': 0, 'distance': 0, 'isRestDay': True},
        # Invalid: Wrong Sport Type (Swimming = 3)
        {'id': 104, 'name': 'Pool Swim', 'sportTypeId': 3, 'duration': 1800, 'distance': 1000, 'isRestDay': False},
        # Invalid: Zero Duration (Implicit rest day)
        {'id': 105, 'name': 'Skipped Workout', 'sportTypeId': 1, 'duration': 0, 'distance': 0, 'isRestDay': False},
    ]

    print("Processing data...")

    # 2. Run the filter
    clean_data = filter_activities(raw_data)

    # 3. Output results
    print("-" * 30)
    print(f"Total Activities Found: {len(raw_data)}")
    print(f"Valid Activities Kept:  {len(clean_data)}")
    print("-" * 30)

    # Pretty print the clean data
    print(json.dumps(clean_data, indent=4))
