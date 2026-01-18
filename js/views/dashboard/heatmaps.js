// js/views/dashboard/heatmaps.js
import { toLocalYMD } from './utils.js';

// --- Helper: Parse Event Schedule from MD ---
function parseEvents(planMd) {
    const eventMap = {};
    if (!planMd) return eventMap;
    
    const lines = planMd.split('\n');
    let inEventSection = false;

    lines.forEach(line => {
        if (line.includes('1. Event Schedule')) inEventSection = true;
        if (line.includes('2. User Profile')) inEventSection = false;

        if (inEventSection && line.trim().startsWith('|') && !line.includes('---')) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length > 2) {
                const col1 = parts[1];
                const col2 = parts[2];
                const d1 = new Date(col1);
                if (!isNaN(d1.getTime()) && d1.getFullYear() > 2020) {
                    eventMap[toLocalYMD(d1)] = col2;
                }
            }
        }
    });
    return eventMap;
}

// --- Internal Helper: CSS Vars for Activity Heatmap ---
const getSportColorVar = (type) => {
    if (type === 'Bike') return 'var(--color-bike)';
    if (type === 'Run') return 'var(--color-run)';
    if (type === 'Swim') return 'var(--color-swim)';
    return 'var(--color-other)'; 
};

// --- Internal Builder: Generic Heatmap (Consistency) ---
function buildGenericHeatmap(fullLog, eventMap, startDate, endDate, title, dateToKeyFn, containerId = null) {
    const dataMap = {}; 
    fullLog.forEach(item => { 
        const dateKey = dateToKeyFn(item.date); 
        if (!dataMap[dateKey]) dataMap[dateKey] = []; 
        dataMap[dateKey].push(item); 
    });
    
    const today = new Date(); today.setHours(0,0,0,0);
    
    const getHexColor = (cls) => {
        if (cls.includes('emerald-500')) return '#10b981';
        if (cls.includes('yellow-500')) return '#eab308';
        if (cls.includes('red-500')) return '#ef4444';
        if (cls.includes('purple-500')) return '#a855f7';
        if (cls.includes('slate-700')) return '#334155';
        return '#94a3b8';
    };

    const startDay = startDate.getDay(); 
    let cellsHtml = ''; 
    for (let i = 0; i < startDay; i++) { 
        cellsHtml += `<div class="w-3 h-3 m-[1px] opacity-0"></div>`; 
    }
    
    let currentDate = new Date(startDate);
    const maxLoops = 400; let loops = 0;
    
    while (currentDate <= endDate && loops < maxLoops) {
        loops++; 
        const dateKey = dateToKeyFn(currentDate); 
        const dayOfWeek = currentDate.getDay(); 
        const dayData = dataMap[dateKey]; 
        const eventName = eventMap && eventMap[dateKey];
        
        let colorClass = 'bg-slate-800'; 
        let statusLabel = "Empty"; 
        let inlineStyle = ""; 
        
        // --- LOGIC START ---
        let finalPlannedDur = 0; 
        let finalActualDur = 0;
        let isPlanMode = false;
        let isRestDay = false;
        
        let detailList = [];
        let sportLabel = "--";
        const uniqueTypes = new Set();

        if (dayData && dayData.length > 0) {
            // 1. Detect Plan Mode
            dayData.forEach(d => {
                if (d.plannedWorkout && d.plannedWorkout.length > 0) {
                    isPlanMode = true;
                    if (d.plannedWorkout.toLowerCase().includes('rest')) isRestDay = true;
                }
            });

            // 2. Calculate Totals
            dayData.forEach(d => {
                const isItemPlanned = (d.plannedWorkout && d.plannedWorkout.length > 0);
                
                // Strict Filter: Ignore Unplanned items if Plan Mode is active
                if (isPlanMode && !isItemPlanned) return; 

                // Data Repair: Fix null duration in Plan
                let pDur = d.plannedDuration || 0;
                let aDur = d.actualDuration || 0;
                if (isItemPlanned && pDur === 0 && aDur > 0) pDur = aDur;

                finalPlannedDur += pDur;
                finalActualDur += aDur;

                if (d.type && d.type !== 'Rest') uniqueTypes.add(d.type);
                
                const name = (d.actualName || d.planName || 'Workout').replace(/['"]/g, ""); 
                detailList.push(`${name} (${Math.round(aDur)}/${Math.round(pDur)}m)`);
            });

            if (uniqueTypes.size > 0) sportLabel = Array.from(uniqueTypes).join(' + ');
            else if (isRestDay) sportLabel = "Rest Day";
        }
        // --- LOGIC END ---

        const detailStr = detailList.join('<br>');
        if (eventName) sportLabel = "Event";

        const hasActivity = (finalPlannedDur > 0 || finalActualDur > 0 || isRestDay || eventName); 
        const isFuture = currentDate > today;

        // --- COLOR ASSIGNMENT ---
        if (eventName) { 
            colorClass = 'bg-purple-500'; statusLabel = `${eventName}`; 
        }
        else if (isPlanMode) {
            if (isRestDay) {
                // VISUAL FIX: 
                // Future Rest = Neutral Grey (Planned)
                // Past/Today Rest = Green 50%
                if (isFuture) {
                    colorClass = 'bg-slate-700/50'; statusLabel = "Rest Day";
                } else {
                    colorClass = 'bg-emerald-500/50'; statusLabel = "Rest Day";
                }
            } else if (finalActualDur === 0) {
                if (isFuture || toLocalYMD(currentDate) === toLocalYMD(today)) {
                    colorClass = 'bg-slate-700'; statusLabel = "Planned";
                } else {
                    colorClass = 'bg-red-500/80'; statusLabel = "Missed";
                }
            } else {
                const ratio = finalPlannedDur > 0 ? (finalActualDur / finalPlannedDur) : 1.0;
                if (ratio >= 0.90) { 
                    colorClass = 'bg-emerald-500'; statusLabel = "Completed"; 
                } else { 
                    colorClass = 'bg-yellow-500'; statusLabel = `Partial (${Math.round(ratio*100)}%)`; 
                }
            }
        }
        else if (finalActualDur > 0) {
            // VISUAL FIX: Unplanned = Green 50% (No more stripes)
            colorClass = 'bg-emerald-500/50'; statusLabel = "Unplanned";
        }
        else if (isFuture) {
            colorClass = 'bg-slate-800'; statusLabel = "Future";
        }

        if (dayOfWeek === 0 && !hasActivity && !eventName) { colorClass = ''; inlineStyle = 'opacity: 0;'; }

        const hexColor = getHexColor(colorClass);
        const clickAttr = hasActivity || isFuture ? 
            `onclick="window.showDashboardTooltip(event, '${dateKey}', ${Math.round(finalPlannedDur)}, ${Math.round(finalActualDur)}, '${statusLabel.replace(/'/g, "\\'")}', '${hexColor}', '${sportLabel}', '${detailStr}')"` : '';
        const cursorClass = (hasActivity || isFuture) ? 'cursor-pointer hover:opacity-80' : '';

        cellsHtml += `<div class="w-3 h-3 rounded-sm ${colorClass} ${cursorClass} m-[1px]" style="${inlineStyle}" ${clickAttr}></div>`;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let monthsHtml = '';
    let loopDate = new Date(startDate);
    loopDate.setDate(loopDate.getDate() - loopDate.getDay());
    let lastMonth = -1;
    while (loopDate <= endDate) {
        const m = loopDate.getMonth();
        let label = "";
        if (m !== lastMonth) {
            label = loopDate.toLocaleDateString('en-US', { month: 'short' });
            lastMonth = m;
        }
        monthsHtml += `<div class="w-3 m-[1px] text-[9px] font-bold text-slate-500 overflow-visible whitespace-nowrap">${label}</div>`;
        loopDate.setDate(loopDate.getDate() + 7);
    }

    const idAttr = containerId ? `id="${containerId}"` : '';

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <i class="fa-solid fa-calendar-check text-slate-400"></i> ${title}
            </h3>
            <div ${idAttr} class="overflow-x-auto pb-4 flex-grow">
                <div class="grid grid-rows-1 grid-flow-col gap-1 w-max mx-auto mb-1">
                    ${monthsHtml}
                </div>
                <div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">
                    ${cellsHtml}
                </div>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-4 mt-2 text-[10px] text-slate-400 font-mono">
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-purple-500"></div> Event</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-slate-700"></div> Planned</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-emerald-500"></div> Done</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-yellow-500"></div> Partial</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-red-500/80"></div> Missed</div>
            </div>
        </div>
    `;
}

// --- Internal Builder: Activity Heatmap (Sport Types) ---
function buildActivityHeatmap(fullLog, startDate, endDate, title, dateToKeyFn, containerId = null) {
    if (!fullLog) fullLog = [];

    // --- SPORT DETECTION LOGIC (STRICT) ---
    const detectSport = (item) => {
        let s = item.actualType || item.type || 'Other';
        if (s === 'Running') return 'Run';
        if (s === 'Cycling') return 'Bike';
        if (s === 'Swimming') return 'Swim';
        
        if (s.includes('Run')) return 'Run';
        if (s.includes('Bike') || s.includes('Cycle')) return 'Bike';
        if (s.includes('Swim') || s.includes('Pool')) return 'Swim';
        
        return 'Other';
    };
    
    const activityMap = {};
    fullLog.forEach(item => {
        if (item.actualDuration > 0) {
            const key = dateToKeyFn(item.date);
            if (!activityMap[key]) activityMap[key] = { sports: new Set(), totalAct: 0, details: [] };
            
            const detected = detectSport(item);
            activityMap[key].sports.add(detected);
            activityMap[key].totalAct += item.actualDuration;

            const name = (item.activityName || item.actualName || 'Activity').replace(/['"]/g, "");
            activityMap[key].details.push(`${name} (${item.actualDuration}m)`);
        }
    });

    const startDay = startDate.getDay();
    let cellsHtml = '';
    
    for (let i = 0; i < startDay; i++) {
        cellsHtml += `<div class="w-3 h-3 m-[1px] opacity-0"></div>`;
    }

    let currentDate = new Date(startDate);
    const maxLoops = 400; let loops = 0;

    while (currentDate <= endDate && loops < maxLoops) {
        loops++;
        const dateKey = dateToKeyFn(currentDate);
        const dayOfWeek = currentDate.getDay();
        const entry = activityMap[dateKey];
        
        let style = '';
        let colorClass = 'bg-slate-800'; 
        let detailStr = '';
        let totalMinutes = 0;
        let hasActivity = false;

        if (entry) {
            hasActivity = true;
            totalMinutes = entry.totalAct;
            const sports = Array.from(entry.sports);
            detailStr = entry.details.join('<br>'); // Combine workouts

            if (sports.length === 1) {
                const color = getSportColorVar(sports[0]);
                style = `background-color: ${color};`;
                colorClass = ''; 
            } else if (sports.length > 1) {
                const step = 100 / sports.length;
                let gradientStr = 'linear-gradient(135deg, ';
                sports.forEach((s, idx) => {
                    const c = getSportColorVar(s);
                    const startPct = idx * step;
                    const endPct = (idx + 1) * step;
                    gradientStr += `${c} ${startPct}% ${endPct}%,`;
                });
                style = `background: ${gradientStr.slice(0, -1)});`;
                colorClass = '';
            }
            
            if (totalMinutes > 90) style += " opacity: 1.0;";
            else if (totalMinutes > 60) style += " opacity: 0.8;";
            else if (totalMinutes > 30) style += " opacity: 0.6;";
            else style += " opacity: 0.4;";
        }

        if (dayOfWeek === 0 && !hasActivity) {
            style = 'opacity: 0;';
            colorClass = '';
        }

        const clickAttr = hasActivity ? 
            `onclick="window.showDashboardTooltip(event, '${dateKey}', 0, ${totalMinutes}, 'Completed', '#fff', 'Activity', '${detailStr}')"` : '';
        const cursorClass = hasActivity ? 'cursor-pointer hover:opacity-100 hover:ring-1 hover:ring-white' : '';

        cellsHtml += `<div class="w-3 h-3 rounded-sm ${colorClass} ${cursorClass} m-[1px]" style="${style}" ${clickAttr}></div>`;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let monthsHtml = '';
    let loopDate = new Date(startDate);
    loopDate.setDate(loopDate.getDate() - loopDate.getDay());
    let lastMonth = -1;
    while (loopDate <= endDate) {
        const m = loopDate.getMonth();
        let label = "";
        if (m !== lastMonth) {
            label = loopDate.toLocaleDateString('en-US', { month: 'short' });
            lastMonth = m;
        }
        monthsHtml += `<div class="w-3 m-[1px] text-[9px] font-bold text-slate-500 overflow-visible whitespace-nowrap">${label}</div>`;
        loopDate.setDate(loopDate.getDate() + 7);
    }

    const idAttr = containerId ? `id="${containerId}"` : '';

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <i class="fa-solid fa-heart-pulse text-slate-400"></i> ${title}
            </h3>
            <div ${idAttr} class="overflow-x-auto pb-4 flex-grow">
                <div class="grid grid-rows-1 grid-flow-col gap-1 w-max mx-auto mb-1">
                    ${monthsHtml}
                </div>
                <div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">
                    ${cellsHtml}
                </div>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-4 mt-2 text-[10px] text-slate-400 font-mono">
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm" style="background-color: var(--color-swim)"></div> Swim</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm" style="background-color: var(--color-bike)"></div> Bike</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm" style="background-color: var(--color-run)"></div> Run</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm" style="background: linear-gradient(135deg, var(--color-run) 50%, var(--color-bike) 50%)"></div> Multi</div>
            </div>
        </div>
    `;
}

// --- Main Render Function ---
export function renderHeatmaps(fullLogData, planMd) {
    const eventMap = parseEvents(planMd);
    const today = new Date();
    today.setHours(0,0,0,0);

    // --- DATA CONSOLIDATION ---
    const consolidatedMap = {};
    
    fullLogData.forEach(item => {
        if (!item.date) return;
        const dKey = toLocalYMD(item.date);
        let sportKey = item.actualType || item.type || "Any";
        
        if (sportKey.includes('Bike')) sportKey = "Bike";
        else if (sportKey.includes('Run')) sportKey = "Run";
        else if (sportKey.includes('Swim')) sportKey = "Swim";
        
        const compositeKey = `${dKey}_${sportKey}`;
        
        if (!consolidatedMap[compositeKey]) {
            consolidatedMap[compositeKey] = { ...item }; 
        } else {
            const existing = consolidatedMap[compositeKey];
            existing.plannedDuration = Math.max(existing.plannedDuration || 0, item.plannedDuration || 0);
            existing.actualDuration = Math.max(existing.actualDuration || 0, item.actualDuration || 0);
            
            if (item.status === 'COMPLETED') existing.status = 'COMPLETED';
            if (item.actualWorkout) existing.actualWorkout = item.actualWorkout;
            if (item.plannedWorkout) existing.plannedWorkout = item.plannedWorkout;
        }
    });
    
    const processedLog = Object.values(consolidatedMap);

    const endOfWeek = new Date(today); 
    const dayOfWeek = endOfWeek.getDay(); 
    const distToSaturday = 6 - dayOfWeek;
    endOfWeek.setDate(endOfWeek.getDate() + distToSaturday); 

    const startTrailing = new Date(endOfWeek); 
    startTrailing.setMonth(startTrailing.getMonth() - 6);
    
    const startYear = new Date(today.getFullYear(), 0, 1); 
    const endYear = new Date(today.getFullYear(), 11, 31);
    
    const heatmapTrailingHtml = buildGenericHeatmap(processedLog, eventMap, startTrailing, endOfWeek, "Recent Consistency (Trailing 6 Months)", toLocalYMD, "heatmap-trailing-scroll");
    const heatmapActivityHtml = buildActivityHeatmap(processedLog, startTrailing, endOfWeek, "Activity Log (Workout Types)", toLocalYMD, "heatmap-activity-scroll");
    const heatmapYearHtml = buildGenericHeatmap(processedLog, eventMap, startYear, endYear, `Annual Overview (${today.getFullYear()})`, toLocalYMD, null);

    setTimeout(() => {
        const scrollIds = ['heatmap-trailing-scroll', 'heatmap-activity-scroll'];
        scrollIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.scrollLeft = el.scrollWidth;
        });
    }, 50);

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            ${heatmapTrailingHtml}
            ${heatmapActivityHtml}
        </div>
        <div class="mt-8">
            ${heatmapYearHtml}
        </div>
    `;
}
