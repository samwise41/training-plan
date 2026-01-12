// js/views/dashboard/progressWidget.js
import { getSportColorVar } from './utils.js';

// --- Internal Helper: Streak Calculators ---
function calculateDailyStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const dayOfWeek = today.getDay(); 
    const currentWeekStart = new Date(today); currentWeekStart.setDate(today.getDate() - dayOfWeek);
    const weeksMap = {};
    fullLogData.forEach(item => {
        if (!item.date) return;
        const d = new Date(item.date); d.setHours(0,0,0,0);
        const day = d.getDay(); const weekStart = new Date(d); weekStart.setDate(d.getDate() - day);
        if (weekStart >= currentWeekStart) return;
        const key = weekStart.toISOString().split('T')[0];
        if (!weeksMap[key]) weeksMap[key] = { failed: false };
        if (item.plannedDuration > 0) {
            const statusStr = (item.status || '').toUpperCase();
            const isCompleted = item.completed === true || statusStr === 'COMPLETED';
            const hasDuration = (item.actualDuration || 0) > 0;
            if (!isCompleted && !hasDuration) weeksMap[key].failed = true;
        }
    });
    let streak = 0; let checkDate = new Date(currentWeekStart); checkDate.setDate(checkDate.getDate() - 7);
    for (let i = 0; i < 260; i++) { 
        const key = checkDate.toISOString().split('T')[0]; const weekData = weeksMap[key];
        if (!weekData) break; if (weekData.failed) break; 
        streak++; checkDate.setDate(checkDate.getDate() - 7);
    }
    return streak;
}

function calculateVolumeStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const dayOfWeek = today.getDay(); const currentWeekStart = new Date(today); currentWeekStart.setDate(today.getDate() - dayOfWeek);
    const weeksMap = {};
    fullLogData.forEach(item => {
        if (!item.date) return;
        const d = new Date(item.date); d.setHours(0,0,0,0);
        const day = d.getDay(); const weekStart = new Date(d); weekStart.setDate(d.getDate() - day);
        if (weekStart >= currentWeekStart) return;
        const key = weekStart.toISOString().split('T')[0];
        if (!weeksMap[key]) weeksMap[key] = { planned: 0, actual: 0 };
        weeksMap[key].planned += (item.plannedDuration || 0);
        weeksMap[key].actual += (item.actualDuration || 0);
    });
    let streak = 0; let checkDate = new Date(currentWeekStart); checkDate.setDate(checkDate.getDate() - 7); 
    for (let i = 0; i < 260; i++) { 
        const key = checkDate.toISOString().split('T')[0]; const stats = weeksMap[key];
        if (!stats) break;
        if (stats.planned === 0) streak++; 
        else { const ratio = stats.actual / stats.planned; if (ratio >= 0.95) streak++; else break; }
        checkDate.setDate(checkDate.getDate() - 7);
    }
    return streak;
}

// --- Main Export ---
export function renderProgressWidget(workouts, fullLogData) {
    if (!workouts || workouts.length === 0) return '';
    
    // Normalize dates to ensure we capture the whole range
    const dates = workouts.map(w => w.date.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    minDate.setHours(0,0,0,0);
    maxDate.setHours(23,59,59,999);

    const today = new Date(); today.setHours(23, 59, 59, 999); 
    let totalPlanned = 0; 
    let totalActual = 0; 
    let expectedSoFar = 0; 
    const totalDailyMarkers = {};
    
    const sportStats = { 
        Bike: { planned: 0, actual: 0, dailyMarkers: {} }, 
        Run: { planned: 0, actual: 0, dailyMarkers: {} }, 
        Swim: { planned: 0, actual: 0, dailyMarkers: {} } 
    };

    // Helper for strictly text-based detection
    const detectSport = (txt) => {
        if (!txt) return null;
        const t = txt.toLowerCase();
        if (t.includes('run') || t.includes('jog')) return 'Run';
        if (t.includes('bike') || t.includes('cycl') || t.includes('rid') || t.includes('zwift') || t.includes('mtb')) return 'Bike';
        if (t.includes('swim') || t.includes('pool')) return 'Swim';
        return 'Other';
    };

    workouts.forEach(w => {
        const plan = w.plannedDuration || 0; 
        const dateKey = w.date.toISOString().split('T')[0];
        
        totalPlanned += plan; 
        if (w.date <= today) expectedSoFar += plan; 
        
        if (!totalDailyMarkers[dateKey]) totalDailyMarkers[dateKey] = 0; 
        totalDailyMarkers[dateKey] += plan;

        const type = detectSport(w.planName) || 'Other';

        if (sportStats[type]) { 
            sportStats[type].planned += plan; 
            if (!sportStats[type].dailyMarkers[dateKey]) sportStats[type].dailyMarkers[dateKey] = 0; 
            sportStats[type].dailyMarkers[dateKey] += plan; 
        }
    });

    if (fullLogData) {
        fullLogData.forEach(item => {
            if (!item.date) return;
            const d = new Date(item.date);
            
            if (d >= minDate && d <= maxDate) {
                const act = parseFloat(item.actualDuration) || 0; 
                if (act > 0) {
                    totalActual += act;
                    const actualText = (item.actualWorkout || '').toLowerCase();
                    let type = detectSport(actualText);
                    if (!type) type = 'Other';
                    if (sportStats[type]) {
                        sportStats[type].actual += act;
                    }
                }
            }
        });
    }

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
        
        const labelHtml = isMain ? `<span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">${label}</span>` : ''; 
        const colorStyle = `style="color: ${getSportColorVar(sportType)}"`;
        const iconHtml = iconClass ? `<i class="fa-solid ${iconClass} mr-2 w-4 text-center" ${colorStyle}></i>` : ''; 
        const heightClass = isMain ? 'h-3' : 'h-2.5'; 
        const mbClass = isMain ? 'mb-4' : 'mb-3'; 
        const pctColor = displayPct > 100 ? 'text-emerald-400' : 'text-blue-400';
        const barBgStyle = `style="width: ${barWidth}%; background-color: ${getSportColorVar(sportType)}"`;

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
    
    const pacingDiff = totalActual - expectedSoFar; 
    let pacingLabel = "On Track"; 
    let pacingColor = "text-slate-400"; 
    let pacingIcon = "fa-check";
    if (pacingDiff >= 15) { pacingLabel = `${Math.round(pacingDiff)}m Ahead`; pacingColor = "text-emerald-400"; pacingIcon = "fa-arrow-trend-up"; } 
    else if (pacingDiff <= -15) { pacingLabel = `${Math.abs(Math.round(pacingDiff))}m Behind`; pacingColor = "text-orange-400"; pacingIcon = "fa-triangle-exclamation"; }
    
    const totalActualHrsPacing = (totalActual / 60).toFixed(1); 
    const expectedHrs = (expectedSoFar / 60).toFixed(1);

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
