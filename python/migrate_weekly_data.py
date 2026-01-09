# ... inside main() after indexing garmin_by_date ...
        print_header("PROCESSING ROWS")
        new_rows = []
        plan_updates = {} 

        for _, row in df_plan.iterrows():
            # Clean the date string to ensure it matches the Garmin JSON format (YYYY-MM-DD)
            date_str = str(row.get('Date', '')).strip()
            plan_workout = str(row.get('Planned Workout', '')).strip()
            
            print(f"Checking Plan Row: {date_str} - {plan_workout}") # Debug log

            if date_str in garmin_by_date:
                # Find the best match for the sport type (Run, Bike, Swim)
                candidates = garmin_by_date[date_str]
                match = None
                
                for act in candidates:
                    prefix = get_activity_prefix(act)
                    # If the plan says "Run" and we found a "[RUN]" activity, it's a match
                    if prefix and prefix.lower().strip('[]') in plan_workout.lower():
                        match = act
                        break
                
                # Fallback to the first activity of that day if no sport-specific match
                if not match:
                    match = candidates[0]

                prefix = get_activity_prefix(match)
                raw_name = match.get('activityName', 'Manual Activity')
                new_name = f"{prefix} {raw_name}" if prefix and prefix not in raw_name else raw_name
                new_dur = f"{float(match.get('duration', 0)) / 60:.1f}"
                
                print(f"   ✅ MATCH FOUND: {new_name} ({new_dur} mins)") # Debug log
                plan_updates[date_str] = {"name": new_name, "dur": new_dur}
                
                # Master DB Entry
                new_row = {c: "" for c in MASTER_COLUMNS}
                new_row.update({'Status': 'COMPLETED', 'Date': date_str, 'Actual Workout': new_name, 'Actual Duration': new_dur})
                for col in MASTER_COLUMNS:
                    if col in match: new_row[col] = str(match[col])
                new_rows.append(new_row)
            else:
                print(f"   ⏭️ No Garmin activity found for {date_str}")
