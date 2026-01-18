import os
import sys

# --- PATHS ---
# Assumes this file is in python/modules/config.py
MODULES_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON_DIR = os.path.dirname(MODULES_DIR) # python/
ROOT_DIR = os.path.dirname(PYTHON_DIR)    # Project Root

PLAN_FILE = os.path.join(ROOT_DIR, 'endurance_plan.md')
# CHANGED: Now points to the JSON database
MASTER_DB = os.path.join(ROOT_DIR, 'data', 'training_log.json')
BRIEF_FILE = os.path.join(ROOT_DIR, 'COACH_BRIEFING.md') 

# Point to the 'garmin_data' folder
GARMIN_JSON = os.path.join(ROOT_DIR, 'garmin_data', 'my_garmin_data_ALL.json')

# --- SETTINGS ---
# Strict Sport Types (Garmin IDs)
# 1=Run, 2=Bike, 5=Swim
ALLOWED_SPORT_TYPES = [1, 2, 5] 

# Sport Detection Helpers
SPORT_IDS = {
    'RUN': [1],
    'BIKE': [2],
    'SWIM': [5, 26, 18] 
}