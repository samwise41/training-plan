import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
from modules import config  # Import the shared config

def analyze_metric(df, col_name, conf):
    # ... (Keep existing helper functions like calculate_slope) ...
    pass 

def main():
    print("Starting Trend Analysis...")
    # Load from the SHARED config path
    if not os.path.exists(config.GARMIN_JSON):
        return

    # ... (Load Data Logic) ...

    # --- ADD THIS CALCULATION BLOCK ---
    # Subjective Efficiency: Power / RPE
    if 'perceivedEffort' in df.columns:
        df['rpe_numeric'] = pd.to_numeric(df['perceivedEffort'], errors='coerce')
        df['subjective_efficiency'] = np.where(
            (df['avgPower'] > 0) & (df['rpe_numeric'] > 0), 
            df['avgPower'] / df['rpe_numeric'], 
            np.nan
        )
    else:
        df['subjective_efficiency'] = np.nan

    # ... (Rest of the script generating the markdown) ...