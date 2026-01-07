// --- NEW HELPER: CALCULATE STREAK (Strict Daily Compliance) ---
function calculateStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;

    // 1. Identify "Current Week" Start (Sunday) to exclude it
    const today = new Date();
    today.setHours(0,0,0,0);
    const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - dayOfWeek); // Back to Sunday

    // 2. Group data by Week (Key: "YYYY-MM-DD" of Sunday)
    const weeksMap = {};

    fullLogData.forEach(item => {
        if (!item.date) return;
        
        // Determine week start (Sunday) for this item
        const d = new Date(item.date);
        d.setHours(0,0,0,0);
        const day = d.getDay();
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - day);
        
        // Skip current/future weeks
        if (weekStart >= currentWeekStart) return;

        const key = weekStart.toISOString().split('T')[0];
        
        // Initialize week entry if missing
        if (!weeksMap[key]) {
            weeksMap[key] = { failed: false };
        }

        // 3. STRICT CHECK: If ANY planned day is missed, the whole week fails
        if (item.plannedDuration > 0) {
            const actual = item.actualDuration || 0;
            const ratio = actual / item.plannedDuration;
            
            // If any single workout is below 95%, mark week as failed
            if (ratio < 0.95) {
                weeksMap[key].failed = true;
            }
        }
    });

    // 4. Count backwards from "Last Week"
    let streak = 0;
    // Start checking from the week immediately prior to currentWeekStart
    let checkDate = new Date(currentWeekStart);
    checkDate.setDate(checkDate.getDate() - 7); // Previous Sunday

    // Check up to 5 years back (safety limit)
    for (let i = 0; i < 260; i++) { 
        const key = checkDate.toISOString().split('T')[0];
        const weekData = weeksMap[key];

        // If we run out of data history, stop
        if (!weekData) {
            break; 
        }

        // If the week is marked as failed, the streak breaks
        if (weekData.failed) {
            break; 
        }
        
        // If we get here, the week existed and had NO failures
        streak++;
        
        // Move back one week
        checkDate.setDate(checkDate.getDate() - 7);
    }

    return streak;
}
