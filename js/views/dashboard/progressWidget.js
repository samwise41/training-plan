// js/views/dashboard/progressWidget.js
import { getSportColorVar } from './utils.js';

// --- HELPER: Strict Date String (YYYY-MM-DD) ---
// Prevents timezone shifting bugs by ignoring time components entirely
function toLocalYMD(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return "INVALID";
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Internal Helper: Streak Calculators ---
function calculateDailyStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;

    // 1. Align to Current Week Start (Monday)
    const today = new Date(); 
    const dayNum = today.getDay(); 
    const currentWeekStart = new Date(today); 
    currentWeekStart.setDate(today.getDate() - (dayNum === 0 ? 6 : dayNum - 1));
    const currentWeekStr = toLocalYMD(currentWeekStart);

    // 2. Group by Week (Monday Strings)
    const weeksMap = {};
    
    fullLogData.forEach(item => {
        if (!item.date) return;
        const d = new Date(item.date);
        const day = d.getDay(); 
        const weekStart = new Date(d); 
        weekStart.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        const weekKey = toLocalYMD(weekStart);
        
        // Ignore current incomplete week
        if (weekKey >= currentWeekStr) return; 
        
        if (!weeksMap[weekKey]) weeksMap[weekKey] = { failed: false };
        
        // If a workout was planned but not completed (and no actual duration), mark week as failed
        if ((item.plannedDuration || 0) > 0) {
            const hasData = (item.actualDuration || 0) > 0;
            const isCompleted = item.completed === true;
            if (!isCompleted && !hasData) weeksMap[weekKey].failed = true;
        }
    });

    // 3. Count Backwards
    let streak = 0; 
    let checkDate = new Date(currentWeekStart); 
    checkDate.setDate(checkDate.getDate() - 7); 

    for (let i = 0; i < 260; i++) { // Check last 5 years max
        const key = toLocalYMD(checkDate);
        const weekData = weeksMap[key];
        
        // If no data for this week, or the week failed, streak ends
        if (!weekData || weekData.failed) break; 
        
        streak++; 
        checkDate.setDate(checkDate.getDate() - 7);
    }
    return streak;
}

function calculateVolumeStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;

    const today = new Date(); 
    const dayNum = today.getDay(); 
    const currentWeekStart = new Date(today); 
    currentWeekStart.setDate(today.getDate() - (dayNum === 0 ? 6 : dayNum - 1));
    const currentWeekStr = toLocalYMD(currentWeekStart);

    const weeksMap = {};
    fullLogData.forEach(item => {
        if (!item.date) return;
        const d = new Date(item.date);
        const day = d.getDay(); 
        const weekStart = new Date(d); 
        weekStart.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        const weekKey = toLocalYMD(weekStart);
        
        if (weekKey >= currentWeekStr) return;

        if (!weeksMap[weekKey]) weeksMap[weekKey] = { planned: 0, actual: 0 };
        weeksMap[weekKey].planned += (item.plannedDuration || 0);
        weeksMap[weekKey].actual += (item.actualDuration || 0);
    });

    let streak = 0; 
    let checkDate = new Date(currentWeekStart); 
    checkDate.setDate(checkDate.getDate() - 7); 

    for (let i = 0; i < 260; i++) { 
        const key = toLocalYMD(checkDate); 
        const stats = weeksMap[key];
        if (!stats) break; // Break on empty week
        
        // Pass if 0 planned (Rest Week) OR >95% compliance
        if (stats.planned === 0) {
            streak++; 
        } else { 
            const ratio = stats.actual / stats.planned; 
            if (ratio >= 0.95) streak++; else break; 
        }
        checkDate.setDate(checkDate.getDate() - 7);
    }
    return streak;
}

// --- Main Component ---
export function renderProgressWidget(workouts, fullLogData) {
    // 1. Define Current Week Bucket (Monday-Sunday Strings)
    const today = new Date();
    const dayNum = today.getDay(); 
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayNum === 0 ? 6 : dayNum - 1));
    
    // Create Set of 7 target dates (YYYY-MM-DD)
    const weekBucket = new Set();
    for(let i=0; i<7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekBucket.add(toLocalYMD(d));
    }

    const todayStr = toLocalYMD(today);

    // 2. Initialize Stats
    const sportStats = { 
        Bike: { planned: 0, actual: 0, dailyMarkers: {} }, 
        Run: { planned: 0, actual: 0, dailyMarkers: {} }, 
        Swim: { planned: 0, actual: 0, dailyMarkers: {} },
        Other: { planned: 0, actual: 0, dailyMarkers: {} } 
    };
    
    let totalPlanned = 0; 
    let totalActual = 0; 
    let expectedSoFar = 0; 
    const totalDailyMarkers = {};

    // 3. Process PLANNED Data (Future/Scheduled)
    if (workouts) {
        workouts.forEach(w => {
            const wDateStr = toLocalYMD(w.date);
            if (weekBucket.has(wDateStr)) {
                const planDur = w.plannedDuration || 0;
                totalPlanned += planDur;
                
                // Add to Expected if date is today or in past
                if (wDateStr <= todayStr) expectedSoFar += planDur;

                // Markers
                if (!totalDailyMarkers[wDateStr]) totalDailyMarkers[wDateStr] = 0;
                totalDailyMarkers[wDateStr] += planDur;

                // Detect Planned Sport (Use 'type' from parser, fallback to Other)
                let sport = w.type || 'Other';
                // Normalize casing just in case
                if (sport.match(/Run/i)) sport = 'Run';
                else if (sport.match(/Bike|Cycle/i)) sport = 'Bike';
                else if (sport.match(/Swim|Pool/i)) sport = 'Swim';
                else sport = 'Other';

                if (sportStats[sport]) {
                    sportStats[sport].planned += planDur;
                    if (!sportStats[sport].dailyMarkers[wDateStr]) sportStats[sport].dailyMarkers[wDateStr] = 0;
                    sportStats[sport].dailyMarkers[wDateStr] += planDur;
                }
            }
        });
    }

    // 4. Process ACTUAL Data (History from JSON)
    if (fullLogData) {
        fullLogData.forEach(item => {
            if (!item.date) return;
            const itemDateStr = toLocalYMD(item.date);
            
            // STRICT FILTER: Is this item in the current week bucket?
            if (weekBucket.has(itemDateStr)) {
                const actDur = item.actualDuration || 0;
                
                if (actDur > 0) {
                    totalActual += actDur;
                    
                    // --- CHANGED: Use Strict 'actualType' from Database ---
                    // No more guessing from name strings!
                    let sport = item.actualType || item.type || 'Other';
                    
                    // Normalize to ensure it hits the keys
                    if (sport === 'Running') sport = 'Run';
                    if (sport === 'Cycling') sport = 'Bike';
                    if (sport === 'Swimming') sport = 'Swim';

                    // Fallback to Other if unknown
                    if (!sportStats[sport]) sport = 'Other';

                    sportStats[sport].actual += actDur;
                }
            }
        });
    }

    // 5. HTML Generation (Visuals)
    const generateBarHtml = (label, iconClass, actual, planned, dailyMap, isMain = false, sportType = 'All') => {
        // Prevent Divide by Zero
        const safePlanned = planned || 1; 
        const rawPct = planned > 0 ? Math.round((actual / safePlanned) * 100) : (actual > 0 ? 100 : 0);
        
        const displayPct = planned > 0 ? Math.round((actual / planned) * 100) : "";
        const barWidth = Math.min(rawPct, 100); 
        
        const actualHrs = (actual / 60).toFixed(1); 
        const plannedHrs = (planned / 60).toFixed(1);
        
        // Generate Daily Markers (Little black ticks on the bar)
        let markersHtml = ''; 
        let runningTotal = 0; 
        const sortedDays = Object.keys(dailyMap).sort();
        
        if (planned > 0) { 
            for (let i = 0; i < sortedDays.length - 1; i++) { 
                runningTotal += dailyMap[sortedDays[i]]; 
                const pct = (runningTotal / planned) * 100; 
                markersHtml += `<div class="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10" style="left: ${pct}%"></div>`; 
            } 
        }
        
        const labelHtml = isMain ? `<span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">${label}</span>` : ''; 
        const colorStyle = `style="color: ${getSportColorVar(sportType)}"`;
        const iconHtml = iconClass ? `<i class="fa-solid ${iconClass} mr-2 w-4 text-center" ${colorStyle}></i>` : ''; 
        const heightClass = isMain ? 'h-3' : 'h-2.5'; 
        const mbClass = isMain ? 'mb-4' : 'mb-3'; 
        
        let pctColor = 'text-slate-500';
        if (planned > 0) {
            pctColor = rawPct > 100 ? 'text-emerald-400' : 'text-blue-400';
        }

        const barBgStyle = `style="width: ${barWidth}%; background-color: ${getSportColorVar(sportType)}"`;

        // Hide empty rows (except Main Goal)
        if (!isMain && planned === 0 && actual === 0) return '';

        return `
        <div class="flex-1 w-full ${mbClass}">
            <div class="flex justify-between items-end mb-1">
                <div class="flex flex-col">
                    ${labelHtml}
                    <div class="flex items-center">
                        ${iconHtml}
                        <span class="text-sm font-bold text-white flex items-baseline gap-1">
                            ${Math.round(actual)} / ${Math.round(planned)} mins
                            <span class="text-xs text-slate-400 font-normal ml-1">(${actualHrs} / ${plannedHrs} hrs)</span>
                        </span>
                    </div>
                </div>
                <span class="text-xs font-bold ${pctColor}">${displayPct}%</span>
            </div>
            <div class="relative w-full ${heightClass} bg-slate-700 rounded-full overflow-hidden">
                ${markersHtml}
                <div class="absolute top-0 left-0 h-full transition-all duration-1000 ease-out" ${barBgStyle}></div>
            </div>
        </div>`;
    };
    
    // Pacing Logic
    const pacingDiff = totalActual - expectedSoFar; 
    let pacingLabel = "On Track"; 
    let pacingColor = "text-slate-400"; 
    let pacingIcon = "fa-check";
    
    if (pacingDiff >= 15) { 
        pacingLabel = `${Math.round(pacingDiff)}m Ahead`; 
        pacingColor = "text-emerald-400"; 
        pacingIcon = "fa-arrow-trend-up"; 
    } else if (pacingDiff <= -15) { 
        pacingLabel = `${Math.abs(Math.round(pacingDiff))}m Behind`; 
        pacingColor = "text-orange-400"; 
        pacingIcon = "fa-triangle-exclamation"; 
    }
    
    const totalActualHrsPacing = (totalActual / 60).toFixed(1); 
    const expectedHrs = (expectedSoFar / 60).toFixed(1);

    // Streaks
    const dailyStreak = calculateDailyStreak(fullLogData);
    const volumeStreak = calculateVolumeStreak(fullLogData);

    const getStreakColor = (val) => {
        if (val >= 8) return "text-red-500";
        if (val >= 3) return "text-orange-400";
        return "text-slate-500";
    };
    
    return `
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-8 flex flex-col md:flex-row items-start gap-6 shadow-sm">
        <div class="flex-1 w-full">
            ${generateBarHtml('Weekly Goal', null, totalActual, totalPlanned, totalDailyMarkers, true, 'All')}
            ${generateBarHtml('Bike', 'fa-bicycle', sportStats.Bike.actual, sportStats.Bike.planned, sportStats.Bike.dailyMarkers, false, 'Bike')}
            ${generateBarHtml('Run', 'fa-person-running', sportStats.Run.actual, sportStats.Run.planned, sportStats.Run.dailyMarkers, false, 'Run')}
            ${generateBarHtml('Swim', 'fa-person-swimming', sportStats.Swim.actual, sportStats.Swim.planned, sportStats.Swim.dailyMarkers, false, 'Swim')}
        </div>
        <div class="w-full md:w-auto md:border-l md:border-slate-700 md:pl-6 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start gap-6 md:gap-4 self-center">
            <div>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Pacing</span>
                <div class="flex items-center gap-2">
                    <i class="fa-solid ${pacingIcon} ${pacingColor}"></i>
                    <span class="text-lg font-bold ${pacingColor}">${pacingLabel}</span>
                </div>
                <div class="text-right md:text-left flex flex-col items-end md:items-start mt-1">
                    <span class="text-[10px] text-slate-300 font-mono">Act: ${Math.round(totalActual)}m <span class="text-slate-500">(${totalActualHrsPacing}h)</span></span>
                    <span class="text-[10px] text-slate-300 font-mono">Tgt: ${Math.round(expectedSoFar)}m <span class="text-slate-500">(${expectedHrs}h)</span></span>
                </div>
            </div>
            <div>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Daily Streak</span>
                <div class="flex items-center gap-2" title="Consecutive weeks where every single workout was Completed">
                    <i class="fa-solid fa-calendar-day ${getStreakColor(dailyStreak)}"></i>
                    <span class="text-lg font-bold ${getStreakColor(dailyStreak)}">${dailyStreak} Wks</span>
                </div>
            </div>
            <div>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Volume Streak</span>
                <div class="flex items-center gap-2" title="Consecutive weeks where total volume was >95%">
                    <i class="fa-solid fa-fire ${getStreakColor(volumeStreak)}"></i>
                    <span class="text-lg font-bold ${getStreakColor(volumeStreak)}">${volumeStreak} Wks</span>
                </div>
            </div>
        </div>
    </div>`;
}
