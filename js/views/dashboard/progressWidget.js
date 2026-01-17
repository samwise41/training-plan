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

    // Strict Boundary Check
    if (newOffset < s.minOffset || newOffset > s.maxOffset) return;

    s.offset = newOffset;
    
    const container = document.getElementById('progress-widget-inner');
    if (container) {
        container.innerHTML = generateWidgetContent();
    }
};

// --- HELPER: DATE FORMATTING ---
// Safely converts any date input to a local "YYYY-MM-DD" string for comparison
function toLocalYMD(input) {
    if (!input) return "0000-00-00";
    const d = new Date(input);
    if (isNaN(d.getTime())) return "0000-00-00";
    
    // Adjust for local timezone to prevent UTC shift
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
}

// --- HELPER: STREAK CALCULATORS ---
function calculateDailyStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;

    // Normalize "Current Week Start" to Monday
    const today = new Date(); 
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const currentWeekStartStr = toLocalYMD(new Date(today.setDate(diff)));

    const weeksMap = {};
    
    fullLogData.forEach(item => {
        if (!item.date) return;
        const itemYMD = toLocalYMD(item.date);
        
        // Determine the Monday of the item's week
        const d = new Date(item.date);
        const dDay = d.getDay();
        const dDiff = d.getDate() - dDay + (dDay === 0 ? -6 : 1);
        const wStartStr = toLocalYMD(new Date(d.setDate(dDiff)));

        if (wStartStr >= currentWeekStartStr) return; // Skip current/future weeks

        if (!weeksMap[wStartStr]) weeksMap[wStartStr] = { failed: false };
        
        if (item.plannedDuration > 0) {
            const statusStr = (item.status || '').toUpperCase();
            const isCompleted = item.completed === true || statusStr === 'COMPLETED';
            const hasDuration = (item.actualDuration || 0) > 0;
            if (!isCompleted && !hasDuration) weeksMap[wStartStr].failed = true;
        }
    });

    let streak = 0; 
    // Start checking from Last Week
    const checkDate = new Date(currentWeekStartStr);
    checkDate.setDate(checkDate.getDate() - 7);

    for (let i = 0; i < 260; i++) { // Max 5 years check
        const key = toLocalYMD(checkDate);
        const weekData = weeksMap[key];
        if (!weekData) break; // Week missing (break streak)
        if (weekData.failed) break; // Failed workout (break streak)
        
        streak++;
        checkDate.setDate(checkDate.getDate() - 7);
    }
    return streak;
}

function calculateVolumeStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;
    
    const today = new Date(); 
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const currentWeekStartStr = toLocalYMD(new Date(today.setDate(diff)));

    const weeksMap = {};
    fullLogData.forEach(item => {
        if (!item.date) return;
        
        const d = new Date(item.date);
        const dDay = d.getDay();
        const dDiff = d.getDate() - dDay + (dDay === 0 ? -6 : 1);
        const wStartStr = toLocalYMD(new Date(d.setDate(dDiff)));
        
        if (wStartStr >= currentWeekStartStr) return;

        if (!weeksMap[wStartStr]) weeksMap[wStartStr] = { planned: 0, actual: 0 };
        weeksMap[wStartStr].planned += (item.plannedDuration || 0);
        weeksMap[wStartStr].actual += (item.actualDuration || 0);
    });

    let streak = 0; 
    const checkDate = new Date(currentWeekStartStr);
    checkDate.setDate(checkDate.getDate() - 7);

    for (let i = 0; i < 260; i++) { 
        const key = toLocalYMD(checkDate);
        const stats = weeksMap[key];
        if (!stats) break;
        if (stats.planned === 0) {
            streak++; // Rest weeks count if planned is 0
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
    s.offset = 0; 

    // Calculate Streaks
    s.streaks.daily = calculateDailyStreak(s.logs);
    s.streaks.volume = calculateVolumeStreak(s.logs);

    // --- BOUNDS CALCULATION ---
    const todayTs = new Date().getTime();
    let minTs = todayTs;

    // 1. Scan History (Logs) for earliest date
    if (s.logs.length > 0) {
        s.logs.forEach(l => {
            const t = new Date(l.date).getTime();
            if (!isNaN(t) && t < minTs) minTs = t;
        });
    }
    // 2. Scan Plan for earliest date
    if (s.workouts.length > 0) {
        s.workouts.forEach(p => {
            const t = new Date(p.date).getTime();
            if (!isNaN(t) && t < minTs) minTs = t;
        });
    }

    // Convert Time difference to Weeks
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const diffMs = minTs - todayTs;
    s.minOffset = Math.floor(diffMs / oneWeekMs) - 1; // Extra buffer week
    s.maxOffset = 0; // STRICTLY Current Week (0)

    return `
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-8 shadow-sm">
        <div id="progress-widget-inner" class="flex flex-col md:flex-row items-start gap-6">
            ${generateWidgetContent()}
        </div>
    </div>`;
}

// --- CONTENT GENERATOR ---
function generateWidgetContent() {
    const s = window.DashboardProgressState;
    
    // 1. Determine Week Date Range
    const today = new Date();
    // Shift by offset
    const viewDate = new Date(today.getTime() + (s.offset * 7 * 24 * 60 * 60 * 1000));
    
    const day = viewDate.getDay();
    const diffToMon = viewDate.getDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(viewDate);
    monday.setDate(diffToMon);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Create Strings for Comparison
    const startStr = toLocalYMD(monday);
    const endStr = toLocalYMD(sunday);
    const nowStr = toLocalYMD(new Date());

    // 2. Aggregate Data
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

    // Planned
    s.workouts.forEach(w => {
        const wDateStr = toLocalYMD(w.date);
        
        if (wDateStr >= startStr && wDateStr <= endStr) {
            const planDur = w.plannedDuration || 0;
            totalPlanned += planDur;
            
            // Pacing: Count expected if day is today or past
            if (wDateStr <= nowStr) expectedSoFar += planDur;

            if (!totalDailyMarkers[wDateStr]) totalDailyMarkers[wDateStr] = 0;
            totalDailyMarkers[wDateStr] += planDur;

            const planSport = detectSport(w.planName);
            if (sportStats[planSport]) {
                sportStats[planSport].planned += planDur;
                if (!sportStats[planSport].dailyMarkers[wDateStr]) sportStats[planSport].dailyMarkers[wDateStr] = 0;
                sportStats[planSport].dailyMarkers[wDateStr] += planDur;
            }
        }
    });

    // Actuals
    s.logs.forEach(item => {
        if (!item.date) return;
        const actDateStr = toLocalYMD(item.date);
        
        if (actDateStr >= startStr && actDateStr <= endStr) {
            const actDur = parseFloat(item.actualDuration) || 0;
            if (actDur > 0) {
                totalActual += actDur;
                
                // If past/today, count toward total. If future (weird?), count.
                // Note: Pacing only subtracts 'expectedSoFar', doesn't filter actuals.
                
                const actSport = detectSport(item.actualName || "");
                if (sportStats[actSport]) sportStats[actSport].actual += actDur;
                else sportStats.Other.actual += actDur;
            }
        }
    });

    // 3. UI Generator
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

    // 4. Header UI
    const dateOpts = { month: 'short', day: 'numeric' };
    const dateRangeLabel = `${monday.toLocaleDateString('en-US', dateOpts)} - ${sunday.toLocaleDateString('en-US', dateOpts)}`;
    
    let weekLabel = "THIS WEEK";
    if (s.offset === -1) weekLabel = "LAST WEEK";
    else if (s.offset !== 0) weekLabel = `${Math.abs(s.offset)} WEEKS AGO`;

    // Arrows
    const canLeft = s.offset > s.minOffset;
    const canRight = s.offset < s.maxOffset;
    const btnClass = "text-slate-400 hover:text-white transition-colors p-1 cursor-pointer";
    const btnDisabled = "text-slate-700 opacity-30 cursor-not-allowed p-1 pointer-events-none";

    const mainPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
    
    // Pacing
    const pacingDiff = totalActual - expectedSoFar; 
    let pacingLabel = "On Track"; 
    let pacingColor = "text-slate-400"; 
    let pacingIcon = "fa-check";
    
    if (pacingDiff >= 15) { 
        pacingLabel = `${Math.round(pacingDiff)}m Ahead`; pacingColor = "text-emerald-400"; pacingIcon = "fa-arrow-trend-up"; 
    } else if (pacingDiff <= -15) { 
        pacingLabel = `${Math.abs(Math.round(pacingDiff))}m Behind`; pacingColor = "text-orange-400"; pacingIcon = "fa-triangle-exclamation"; 
    }
    
    // Streak Colors
    const getStreakColor = (val) => val >= 8 ? "text-red-500" : (val >= 3 ? "text-orange-400" : "text-slate-500");

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
