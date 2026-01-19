// js/views/dashboard/progressWidget.js
import { getSportColorVar } from './utils.js';

function calculateDailyStreak(fullLogData) {
    if (!fullLogData || fullLogData.length === 0) return 0;

    const today = new Date(); today.setHours(0,0,0,0);
    const dayOfWeek = today.getDay(); 
    const currentWeekStart = new Date(today); 
    currentWeekStart.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    
    const weeksMap = {};
    fullLogData.forEach(item => {
        if (!item.date) return;
        const d = new Date(item.date); d.setHours(0,0,0,0);
        
        // Skip future/current week for streak calculation
        if (d >= currentWeekStart) return;

        const day = d.getDay(); 
        const weekStart = new Date(d); 
        weekStart.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
        const key = weekStart.toISOString().split('T')[0];
        
        if (!weeksMap[key]) weeksMap[key] = { failed: false };
        
        // Logic: If planned duration exists but not completed
        // Note: app.js doesn't import 'plannedDuration' for historical records by default unless mapped.
        // Assuming we rely on 'duration' > 0 for actuals.
        if (item.status !== 'COMPLETED' && (!item.duration || item.duration === 0)) {
             // In pure log mode, we might not know if it was planned-but-missed unless we merge plan vs actuals.
             // For now, assume if it's in the log, it happened.
        }
    });
    
    // Simplified: Just count weeks with activity
    // (Real streak logic needs merged plan+actual data which we might not have fully historically)
    return 0; // Placeholder until strict historical plan merging is added
}

function calculateVolumeStreak(fullLogData) {
    // Simplified volume streak
    return 0; 
}

export function renderProgressWidget(workouts, fullLogData) {
    // 1. Define Current Week
    const today = new Date(); today.setHours(0,0,0,0);
    const currentDay = today.getDay(); 
    const distToMon = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today); monday.setDate(today.getDate() - distToMon); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);

    // 2. Init Stats
    const sportStats = { 
        Bike: { planned: 0, actual: 0, dailyMarkers: {} }, 
        Run: { planned: 0, actual: 0, dailyMarkers: {} }, 
        Swim: { planned: 0, actual: 0, dailyMarkers: {} },
        Other: { planned: 0, actual: 0, dailyMarkers: {} } 
    };
    
    let totalPlanned = 0; 
    let totalActual = 0; 
    const totalDailyMarkers = {};

    // 3. Process PLANNED (from Schedule Markdown)
    if (workouts) {
        workouts.forEach(w => {
            const d = new Date(w.date);
            if (d >= monday && d <= sunday) {
                const planDur = w.plannedDuration || 0;
                const dateKey = w.date.toISOString().split('T')[0];
                
                totalPlanned += planDur;
                if (!totalDailyMarkers[dateKey]) totalDailyMarkers[dateKey] = 0;
                totalDailyMarkers[dateKey] += planDur;

                // Detect Sport from Plan Name
                let sport = 'Other';
                const name = (w.planName || '').toUpperCase();
                if (name.includes('RUN')) sport = 'Run';
                else if (name.includes('BIKE')) sport = 'Bike';
                else if (name.includes('SWIM')) sport = 'Swim';

                if (sportStats[sport]) {
                    sportStats[sport].planned += planDur;
                    if (!sportStats[sport].dailyMarkers[dateKey]) sportStats[sport].dailyMarkers[dateKey] = 0;
                    sportStats[sport].dailyMarkers[dateKey] += planDur;
                }
            }
        });
    }

    // 4. Process ACTUAL (from Clean App Data)
    if (fullLogData) {
        fullLogData.forEach(item => {
            const d = new Date(item.date);
            if (d >= monday && d <= sunday) {
                const actDur = item.duration || 0; // Use clean 'duration'
                if (actDur > 0) {
                    totalActual += actDur;
                    // Use clean 'sport'
                    const sport = sportStats[item.sport] ? item.sport : 'Other';
                    sportStats[sport].actual += actDur;
                }
            }
        });
    }

    // 5. Generate HTML (Helper)
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

    return `
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-8 flex flex-col md:flex-row items-start gap-6 shadow-sm">
        <div class="flex-1 w-full">
            ${generateBarHtml('Weekly Goal', null, totalActual, totalPlanned, totalDailyMarkers, true, 'All')}
            ${generateBarHtml('Bike', 'fa-bicycle', sportStats.Bike.actual, sportStats.Bike.planned, sportStats.Bike.dailyMarkers, false, 'Bike')}
            ${generateBarHtml('Run', 'fa-person-running', sportStats.Run.actual, sportStats.Run.planned, sportStats.Run.dailyMarkers, false, 'Run')}
            ${generateBarHtml('Swim', 'fa-person-swimming', sportStats.Swim.actual, sportStats.Swim.planned, sportStats.Swim.dailyMarkers, false, 'Swim')}
        </div>
    </div>`;
}
