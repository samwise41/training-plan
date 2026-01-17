import { getSportColorVar } from './utils.js';

// --- GLOBAL STATE ---
window.DashboardProgressState = {
    workouts: [],
    logs: [],
    offset: 0,      // 0 = Current Week
    minOffset: 0,
    maxOffset: 0,   // Locked to 0 (Current Week)
    streaks: { daily: 0, volume: 0 }
};

// --- GLOBAL HANDLER ---
window.moveProgressWeek = (direction) => {
    const s = window.DashboardProgressState;
    const newOffset = s.offset + direction;

    // Boundary Check
    if (newOffset < s.minOffset || newOffset > s.maxOffset) return;

    s.offset = newOffset;
    
    // Re-render only the inner content
    const container = document.getElementById('progress-widget-inner');
    if (container) {
        container.innerHTML = generateWidgetContent();
    }
};

// --- HELPERS: DATE & STREAKS ---

// Helper: Normalize any date input to local "YYYY-MM-DD" string for safe comparison
function toYMD(dateInput) {
    if (!dateInput) return "0000-00-00";
    const d = new Date(dateInput);
    // Adjust for timezone offset to ensure we get the LOCAL date string, not UTC
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split('T')[0];
}

function calculateDailyStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;

    const today = new Date(); 
    const currentWeekStart = new Date(today); 
    const day = currentWeekStart.getDay();
    const diff = currentWeekStart.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0,0,0,0);
    
    const weeksMap = {};
    fullLogData.forEach(item => {
        if (!item.date) return;
        // Find week start for this item
        const d = new Date(item.date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day == 0 ? -6 : 1);
        const wStart = new Date(d);
        wStart.setDate(diff);
        wStart.setHours(0,0,0,0);
        
        if (wStart >= currentWeekStart) return; 
        
        const key = wStart.toISOString().split('T')[0];
        if (!weeksMap[key]) weeksMap[key] = { failed: false };
        
        if (item.plannedDuration > 0) {
            const statusStr = (item.status || '').toUpperCase();
            const isCompleted = item.completed === true || statusStr === 'COMPLETED';
            const hasDuration = (item.actualDuration || 0) > 0;
            if (!isCompleted && !hasDuration) weeksMap[key].failed = true;
        }
    });

    let streak = 0; 
    let checkDate = new Date(currentWeekStart); 
    checkDate.setDate(checkDate.getDate() - 7); 

    for (let i = 0; i < 260; i++) { 
        const key = checkDate.toISOString().split('T')[0]; 
        const weekData = weeksMap[key];
        if (!weekData) break; 
        if (weekData.failed) break; 
        streak++; 
        checkDate.setDate(checkDate.getDate() - 7);
    }
    return streak;
}

function calculateVolumeStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;
    
    const today = new Date(); 
    const currentWeekStart = new Date(today); 
    const day = currentWeekStart.getDay();
    const diff = currentWeekStart.getDate() - day + (day == 0 ? -6 : 1);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0,0,0,0);

    const weeksMap = {};
    fullLogData.forEach(item => {
        if (!item.date) return;
        const d = new Date(item.date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day == 0 ? -6 : 1);
        const wStart = new Date(d);
        wStart.setDate(diff);
        wStart.setHours(0,0,0,0);
        
        if (wStart >= currentWeekStart) return;

        const key = wStart.toISOString().split('T')[0];
        if (!weeksMap[key]) weeksMap[key] = { planned: 0, actual: 0 };
        weeksMap[key].planned += (item.plannedDuration || 0);
        weeksMap[key].actual += (item.actualDuration || 0);
    });

    let streak = 0; 
    let checkDate = new Date(currentWeekStart); 
    checkDate.setDate(checkDate.getDate() - 7); 

    for (let i = 0; i < 260; i++) { 
        const key = checkDate.toISOString().split('T')[0]; 
        const stats = weeksMap[key];
        if (!stats) break;
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

// --- MAIN EXPORT ---
export function renderProgressWidget(workouts, fullLogData) {
    const s = window.DashboardProgressState;
    s.workouts = workouts || [];
    s.logs = fullLogData || [];
    s.offset = 0; // Reset to current week on reload

    // Pre-calculate streaks (Global metrics)
    s.streaks.daily = calculateDailyStreak(s.logs);
    s.streaks.volume = calculateVolumeStreak(s.logs);

    // --- FIX: CALCULATE BOUNDS FROM BOTH LOGS AND PLAN ---
    const today = new Date();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    let minTs = today.getTime();
    
    // Check Plans
    if (s.workouts.length > 0) {
        const earliestPlan = Math.min(...s.workouts.map(p => new Date(p.date).getTime()));
        if (!isNaN(earliestPlan)) minTs = Math.min(minTs, earliestPlan);
    }
    // Check Logs (History)
    if (s.logs.length > 0) {
        const earliestLog = Math.min(...s.logs.map(l => new Date(l.date).getTime()));
        if (!isNaN(earliestLog)) minTs = Math.min(minTs, earliestLog);
    }

    // Calculate how many weeks back we can go
    const minDate = new Date(minTs);
    s.minOffset = Math.floor((minDate - today) / oneWeek);
    s.maxOffset = 0; // Lock to current week (no future surfing)

    return `
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-8 shadow-sm">
        <div id="progress-widget-inner" class="flex flex-col md:flex-row items-start gap-6">
            ${generateWidgetContent()}
        </div>
    </div>`;
}

// --- INTERNAL CONTENT GENERATOR ---
function generateWidgetContent() {
    const s = window.DashboardProgressState;
    
    // 1. Determine Current View Week (Monday - Sunday)
    const today = new Date();
    const viewTarget = new Date(today.getTime() + (s.offset * 7 * 24 * 60 * 60 * 1000));
    
    // Get Monday of that week
    const currentDay = viewTarget.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(viewTarget);
    monday.setDate(viewTarget.getDate() - distanceToMonday);
    
    // Get Sunday
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Format strings for strict comparison
    const startStr = toYMD(monday);
    const endStr = toYMD(sunday);

    // 2. Filter Data for Window
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

    const detectSport = (txt) => {
        if (!txt) return 'Other';
        const t = txt.toUpperCase();
        if (t.includes('[RUN]')) return 'Run';
        if (t.includes('[BIKE]')) return 'Bike';
        if (t.includes('[SWIM]')) return 'Swim';
        return 'Other';
    };

    const nowStr = toYMD(new Date());

    // Process Planned Workouts
    s.workouts.forEach(w => {
        const dateStr = toYMD(w.date);
        
        // String comparison is safer for dates
        if (dateStr >= startStr && dateStr <= endStr) {
            const planDur = w.plannedDuration || 0;
            totalPlanned += planDur;
            
            // Pacing: If date is today or past, count it
            if (dateStr <= nowStr) expectedSoFar += planDur;

            if (!totalDailyMarkers[dateStr]) totalDailyMarkers[dateStr] = 0;
            totalDailyMarkers[dateStr] += planDur;

            const planSport = detectSport(w.planName);
            if (sportStats[planSport]) {
                sportStats[planSport].planned += planDur;
                if (!sportStats[planSport].dailyMarkers[dateStr]) sportStats[planSport].dailyMarkers[dateStr] = 0;
                sportStats[planSport].dailyMarkers[dateStr] += planDur;
            }
        }
    });

    // Process Actual Logs
    s.logs.forEach(item => {
        if (!item.date) return;
        const dateStr = toYMD(item.date);
        
        if (dateStr >= startStr && dateStr <= endStr) {
            const actDur = parseFloat(item.actualDuration) || 0;
            if (actDur > 0) {
                totalActual += actDur;
                const actSport = detectSport(item.actualName || "");
                if (sportStats[actSport]) sportStats[actSport].actual += actDur;
                else sportStats.Other.actual += actDur;
            }
        }
    });

    // 3. UI Helpers
    const generateBarHtml = (label, iconClass, actual, planned, dailyMap, isMain = false, sportType = 'All') => {
        const rawPct = planned > 0 ? Math.round((actual / planned) * 100) : 0; 
        const displayPct = rawPct; 
        const barWidth = Math.min(rawPct, 100); 
        const actualHrs = (actual / 60).toFixed(1); 
        const plannedHrs = (planned / 60).toFixed(1);
        
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
        
        if (isMain) return ''; 
        if (planned === 0 && actual === 0) return '';

        const colorStyle = `style="color: ${getSportColorVar(sportType)}"`;
        const iconHtml = iconClass ? `<i class="fa-solid ${iconClass} mr-2 w-4 text-center" ${colorStyle}></i>` : ''; 
        const pctColor = displayPct > 100 ? 'text-emerald-400' : 'text-blue-400';
        const barBgStyle = `style="width: ${barWidth}%; background-color: ${getSportColorVar(sportType)}"`;

        return `
        <div class="flex-1 w-full mb-3">
            <div class="flex justify-between items-end mb-1">
                <div class="flex flex-col">
                    <div class="flex items-center">
                        ${iconHtml}
                        <span class="text-xs font-bold text-white uppercase">${label}</span>
                        <span class="text-[10px] text-slate-400 font-normal ml-2 font-mono">
                            ${Math.round(actual)}/${Math.round(planned)}m
                        </span>
                    </div>
                </div>
                <span class="text-xs font-bold ${pctColor}">${displayPct}%</span>
            </div>
            <div class="relative w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                ${markersHtml}
                <div class="absolute top-0 left-0 h-full transition-all duration-1000 ease-out" ${barBgStyle}></div>
            </div>
        </div>`;
    };

    // 4. Header & Navigation UI
    const dateOpts = { month: 'short', day: 'numeric' };
    const dateRangeLabel = `${monday.toLocaleDateString('en-US', dateOpts)} - ${sunday.toLocaleDateString('en-US', dateOpts)}`;
    
    let weekLabel = "THIS WEEK";
    if (s.offset === -1) weekLabel = "LAST WEEK";
    else if (s.offset === 1) weekLabel = "NEXT WEEK"; 
    else if (s.offset !== 0) weekLabel = `${Math.abs(s.offset)} WEEKS ${s.offset > 0 ? 'AHEAD' : 'AGO'}`;

    // Nav State
    const canLeft = s.offset > s.minOffset;
    const canRight = s.offset < s.maxOffset;
    const btnClass = "text-slate-400 hover:text-white transition-colors p-1 cursor-pointer";
    const btnDisabled = "text-slate-700 opacity-30 cursor-not-allowed p-1 pointer-events-none";

    const mainPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
    
    // Pacing Logic
    const pacingDiff = totalActual - expectedSoFar; 
    let pacingLabel = "On Track"; 
    let pacingColor = "text-slate-400"; 
    let pacingIcon = "fa-check";
    
    if (pacingDiff >= 15) { 
        pacingLabel = `${Math.round(pacingDiff)}m Ahead`; pacingColor = "text-emerald-400"; pacingIcon = "fa-arrow-trend-up"; 
    } else if (pacingDiff <= -15) { 
        pacingLabel = `${Math.abs(Math.round(pacingDiff))}m Behind`; pacingColor = "text-orange-400"; pacingIcon = "fa-triangle-exclamation"; 
    }
    
    const pacingHtml = `
        <div>
            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Pacing</span>
            <div class="flex items-center gap-2">
                <i class="fa-solid ${pacingIcon} ${pacingColor}"></i>
                <span class="text-lg font-bold ${pacingColor}">${pacingLabel}</span>
            </div>
            <div class="text-right md:text-left flex flex-col items-end md:items-start mt-1">
                <span class="text-[10px] text-slate-300 font-mono">Act: ${Math.round(totalActual)}m</span>
                <span class="text-[10px] text-slate-300 font-mono">Tgt: ${Math.round(expectedSoFar)}m</span>
            </div>
        </div>
    `;

    const getStreakColor = (val) => val >= 8 ? "text-red-500" : (val >= 3 ? "text-orange-400" : "text-slate-500");

    // 5. Construct Final HTML
    return `
        <div class="flex-1 w-full">
            <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-700/50">
                <div class="flex items-center gap-2">
                    <button onclick="window.moveProgressWeek(-1)" class="${canLeft ? btnClass : btnDisabled}">
                        <i class="fa-solid fa-chevron-left text-xs"></i>
                    </button>
                    <div class="text-center w-24">
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">${weekLabel}</div>
                        <div class="text-[9px] text-slate-500 font-mono leading-none mt-1">${dateRangeLabel}</div>
                    </div>
                    <button onclick="window.moveProgressWeek(1)" class="${canRight ? btnClass : btnDisabled}">
                        <i class="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                </div>
                <div class="text-right">
                    <span class="text-2xl font-black text-white">${mainPct}%</span>
                    <span class="text-[9px] text-slate-500 font-bold uppercase block -mt-1">Goal</span>
                </div>
            </div>

            <div class="relative w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-4">
                <div class="absolute top-0 left-0 h-full transition-all duration-1000" 
                     style="width: ${Math.min(mainPct,100)}%; background-color: var(--color-all)">
                </div>
            </div>

            ${generateBarHtml('Bike', 'fa-bicycle', sportStats.Bike.actual, sportStats.Bike.planned, sportStats.Bike.dailyMarkers, false, 'Bike')}
            ${generateBarHtml('Run', 'fa-person-running', sportStats.Run.actual, sportStats.Run.planned, sportStats.Run.dailyMarkers, false, 'Run')}
            ${generateBarHtml('Swim', 'fa-person-swimming', sportStats.Swim.actual, sportStats.Swim.planned, sportStats.Swim.dailyMarkers, false, 'Swim')}
        </div>

        <div class="w-full md:w-auto md:border-l md:border-slate-700 md:pl-6 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start gap-6 md:gap-4 self-center">
            ${pacingHtml}
            <div>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Daily Streak</span>
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-calendar-day ${getStreakColor(s.streaks.daily)}"></i>
                    <span class="text-lg font-bold ${getStreakColor(s.streaks.daily)}">${s.streaks.daily} Wks</span>
                </div>
            </div>
            <div>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Volume Streak</span>
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-fire ${getStreakColor(s.streaks.volume)}"></i>
                    <span class="text-lg font-bold ${getStreakColor(s.streaks.volume)}">${s.streaks.volume} Wks</span>
                </div>
            </div>
        </div>
    `;
}
