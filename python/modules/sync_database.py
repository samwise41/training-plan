import json
import os
from datetime import datetime
from modules.config import DATA_DIR  # Assuming config has DATA_DIR

def load_json(filepath):
    """Helper to load JSON data."""
    if not os.path.exists(filepath):
        return []
    with open(filepath, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_json(filepath, data):
    """Helper to save JSON data."""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=4)

def sync_planned_to_log():
    """
    Syncs planned workouts from planned.json to training_log.json
    and updates the status based on duration logic.
    """
    planned_path = os.path.join(DATA_DIR, 'planned.json')
    log_path = os.path.join(DATA_DIR, 'training_log.json')

    planned_data = load_json(planned_path)
    log_data = load_json(log_path)

    # Convert log_data to a dictionary keyed by date for easy access
    # Assuming the date field is named "date" in format YYYY-MM-DD
    log_map = {entry['date']: entry for entry in log_data}
    
    # Track if we made any changes
    updates_made = False

    for plan in planned_data:
        date = plan.get('date')
        if not date:
            continue

        # Get or create the log entry for this date
        if date not in log_map:
            log_map[date] = {
                "date": date,
                "actualDuration": 0,
                "type": "Run", # Default or derived
                "distance": 0,
                "calories": 0,
                "status": "REST"
            }
            updates_made = True
        
        log_entry = log_map[date]

        # --- 1. Map Fields ---
        # Map activityName -> plannedWorkout
        if 'activityName' in plan:
            log_entry['plannedWorkout'] = plan['activityName']
            updates_made = True
        
        # Map exact matches
        if 'plannedDuration' in plan:
            log_entry['plannedDuration'] = plan['plannedDuration']
            updates_made = True
        
        if 'note' in plan:
            log_entry['note'] = plan['note']
            updates_made = True

        # --- 2. Update Status Logic ---
        # Ensure values are numbers for comparison
        p_dur = float(log_entry.get('plannedDuration', 0))
        a_dur = float(log_entry.get('actualDuration', 0))

        original_status = log_entry.get('status')
        new_status = original_status

        if p_dur > 0 and a_dur > 0:
            new_status = "COMPLETED"
        elif p_dur > 0 and a_dur == 0:
            new_status = "MISSED"
        elif p_dur == 0 and a_dur > 0:
            new_status = "UNPLANNED"
        # Optional: Handle Rest days (both 0) if needed, otherwise leave as is

        if new_status != original_status:
            log_entry['status'] = new_status
            updates_made = True

    # Convert map back to list and sort by date
    if updates_made:
        updated_log = list(log_map.values())
        updated_log.sort(key=lambda x: x['date'])
        save_json(log_path, updated_log)
        print(f"Successfully synced {len(planned_data)} planned items to training log.")
    else:
        print("No updates required.")

if __name__ == "__main__":
    sync_planned_to_log()
