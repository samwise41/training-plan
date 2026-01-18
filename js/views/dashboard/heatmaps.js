// js/views/dashboard/heatmaps.js

// --- INTERNAL HELPER: Date to YYYY-MM-DD ---
// Inlined to prevent import errors
function toLocalYMD(date) {
    if (!date) return '0000-00-00';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
}

// --- HELPER: Parse Event Schedule ---
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

// --- INTERNAL BUILDER: Generic Heatmap ---
function buildGenericHeatmap(fullLog, eventMap, startDate, endDate, title, containerId) {
    // Group Data by Date Key
    const dataMap = {}; 
    fullLog.forEach(item => { 
        const dateKey = toLocalYMD(item.date); 
        if (!dataMap[dateKey]) dataMap[dateKey] = []; 
        dataMap[dateKey].push(item); 
    });
    
    const today = new Date(); today.setHours(0,0,0,0);
    const startDay = startDate.getDay(); 
    let cellsHtml = ''; 
    
    // Empty spacer cells for start of week
    for (let i = 0; i < startDay; i++) { 
        cellsHtml += `<div class="w-3 h-3 m-[1px] opacity-0"></div>`; 
    }
    
    let currentDate = new Date(startDate);
    const maxLoops = 400; let loops = 0; // Safety brake
    
    while (currentDate <= endDate && loops < maxLoops) {
        loops++;
        const dateKey = toLocalYMD(currentDate); 
        const dayOfWeek = currentDate.getDay(); 
        const dayData = dataMap[dateKey]; 
        const eventName = eventMap && eventMap[dateKey];
        
        let colorClass = 'bg-slate-800'; 
        let statusLabel = "Empty"; 
        let inlineStyle = ""; 
        let detailStr = "";
        
        let planDur = 0; 
        let actDur = 0;
        let isPlanMode = false;
        let isRestDay = false;

        if (dayData && dayData.length > 0) {
            // 1. Detect if this is a Planned Day
            dayData.forEach(d => {
                // Check if 'plannedWorkout' exists and is not empty
                if (d.plannedWorkout && d.plannedWorkout.length > 0) {
                    isPlanMode = true;
                    if (d.plannedWorkout.toLowerCase().includes('rest')) isRestDay = true;
                }
            });

            // 2. Sum Durations
            dayData.forEach(d => {
                const isItemPlanned = (d.plannedWorkout && d.plannedWorkout.length > 0);
                
                // If the day is planned, ignore any purely unplanned items to prevent "Unplanned" color
                if (isPlanMode && !isItemPlanned) return;

                let p = d.plannedDuration || 0;
                let a = d.actualDuration || 0;
                
                // Logic Fix: If we have a Plan Name but 0 duration, assume Duration = Actual
                if (isItemPlanned && p === 0 && a > 0) p = a;

                planDur += p;
                actDur += a;
                
                const name = (d.actualWorkout || d.plannedWorkout || 'Workout').replace(/['"]/g, ""); 
                detailStr += `${name} (${Math.round(a)}/${Math.round(p)}m)<br>`;
            });
        }

        const hasActivity = (planDur > 0 || actDur > 0 || isRestDay || eventName); 
        const isFuture = currentDate > today;

        // --- COLOR LOGIC ---
        if (eventName) { 
            colorClass = 'bg-purple-500'; statusLabel = `${eventName}`; 
        }
        else if (isPlanMode) {
            if (isRestDay) {
                // Future Rest = Grey, Past Rest = Green 50%
                colorClass = isFuture ? 'bg-slate-700/50' : 'bg-emerald-500/50';
                statusLabel = "Rest Day";
            } else if (actDur === 0) {
                // Missed vs Planned
                if (isFuture || toLocalYMD(currentDate) === toLocalYMD(today)) {
                    colorClass = 'bg-slate-700'; statusLabel = "Planned";
                } else {
                    colorClass = 'bg-red-500/80'; statusLabel = "Missed";
                }
            } else {
                // Completion Ratio
                const ratio = planDur > 0 ? (actDur / planDur) : 1.0;
                if (ratio >= 0.90) { colorClass = 'bg-emerald-500'; statusLabel = "Completed"; } 
                else { colorClass = 'bg-yellow-500'; statusLabel = "Partial"; } 
            }
        }
        else if (actDur > 0) {
            // Unplanned Workout
            colorClass = 'bg-emerald-500/50'; statusLabel = "Unplanned"; 
        }
        else if (isFuture) {
            colorClass = 'bg-slate-800'; statusLabel = "Future";
        }

        // Hide Sundays if empty
        if (dayOfWeek === 0 && !hasActivity && !eventName) { colorClass = ''; inlineStyle = 'opacity: 0;'; }

        const clickAttr = hasActivity ? 
            `onclick="window.showDashboardTooltip(event, '${dateKey}', ${Math.round(planDur)}, ${Math.round(actDur)}, '${statusLabel}', '', 'Activity', '${detailStr}')"` : '';
        const cursorClass = (hasActivity || isFuture) ? 'cursor-pointer hover:opacity-80' : '';

        cellsHtml += `<div class="w-3 h-3 rounded-sm ${colorClass} ${cursorClass} m-[1px]" style="${inlineStyle}" ${clickAttr}></div>`;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <i class="fa-solid fa-calendar-check text-slate-400"></i> ${title}
            </h3>
            <div id="${containerId}" class="overflow-x-auto pb-4 flex-grow">
                <div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">
                    ${cellsHtml}
                </div>
            </div>
        </div>
    `;
}

// --- INTERNAL BUILDER: Activity Heatmap ---
function buildActivityHeatmap(fullLog, startDate, endDate, title, containerId) {
    // Group Data
    const dataMap = {};
    fullLog.forEach(item => {
        if (item.actualDuration > 0) {
            const dateKey = toLocalYMD(item.date);
            if (!dataMap[dateKey]) dataMap[dateKey] = [];
            dataMap[dateKey].push(item);
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
        const dateKey = toLocalYMD(currentDate);
        const dayOfWeek = currentDate.getDay();
        const dayData = dataMap[dateKey];
        
        let style = '';
        let colorClass = 'bg-slate-800'; 
        let hasActivity = false;

        if (dayData && dayData.length > 0) {
            hasActivity = true;
            let hasSwim=false, hasBike=false, hasRun=false;
            
            dayData.forEach(d => {
                const s = (d.actualSport || d.type || "").toUpperCase();
                if (s.includes('SWIM')) hasSwim = true;
                if (s.includes('BIKE') || s.includes('CYCL')) hasBike = true;
                if (s.includes('RUN')) hasRun = true;
            });

            style = "opacity: 1.0;"; // Force 100% opacity
            colorClass = "";

            if (hasSwim && !hasBike && !hasRun) style += "background-color: var(--color-swim);";
            else if (!hasSwim && hasBike && !hasRun) style += "background-color: var(--color-bike);";
            else if (!hasSwim && !hasBike && hasRun) style += "background-color: var(--color-run);";
            else style += "background: linear-gradient(135deg, var(--color-run), var(--color-bike));"; 
        }

        if (dayOfWeek === 0 && !hasActivity) {
            style = 'opacity: 0;';
            colorClass = '';
        }

        const cursorClass = hasActivity ? 'cursor-pointer hover:ring-1 hover:ring-white' : '';
        cellsHtml += `<div class="w-3 h-3 rounded-sm ${colorClass} ${cursorClass} m-[1px]" style="${style}"></div>`;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <i class="fa-solid fa-heart-pulse text-slate-400"></i> ${title}
            </h3>
            <div id="${containerId}" class="overflow-x-auto pb-4 flex-grow">
                <div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">
                    ${cellsHtml}
                </div>
            </div>
        </div>
    `;
}

// --- MAIN EXPORT ---
export function renderHeatmaps(fullLogData, planMd) {
    const eventMap = parseEvents(planMd);
    const today = new Date();
    today.setHours(0,0,0,0);

    // --- DATA CONSOLIDATION (Safe Merge) ---
    const consolidatedMap = {};
    
    fullLogData.forEach(item => {
        if (!item.date) return;
        const dKey = toLocalYMD(item.date);
        
        // Simple Sport Normalization
        let sportKey = item.actualSport || item.plannedSport || "Any";
        if (sportKey.includes('Bike')) sportKey = "Bike";
        else if (sportKey.includes('Run')) sportKey = "Run";
        else if (sportKey.includes('Swim')) sportKey = "Swim";
        
        const compositeKey = `${dKey}_${sportKey}`;
        
        if (!consolidatedMap[compositeKey]) {
            // New Entry - Clone safely
            consolidatedMap[compositeKey] = { ...item }; 
        } else {
            // Merge logic
            const existing = consolidatedMap[compositeKey];
            existing.plannedDuration = Math.max(existing.plannedDuration || 0, item.plannedDuration || 0);
            existing.actualDuration = Math.max(existing.actualDuration || 0, item.actualDuration || 0);
            
            // Priority to Completed status
            if (item.status === 'COMPLETED') existing.status = 'COMPLETED';
            
            // Merge Strings (Prefer non-empty)
            if (item.plannedWorkout) existing.plannedWorkout = item.plannedWorkout;
            if (item.actualWorkout) existing.actualWorkout = item.actualWorkout;
        }
    });
    
    const processedLog = Object.values(consolidatedMap);

    // Date Ranges
    const endOfWeek = new Date(today); 
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay())); 

    const startTrailing = new Date(endOfWeek); 
    startTrailing.setMonth(startTrailing.getMonth() - 6);
    
    const startYear = new Date(today.getFullYear(), 0, 1); 
    const endYear = new Date(today.getFullYear(), 11, 31);
    
    // Build HTML
    const htmlTrailing = buildGenericHeatmap(processedLog, eventMap, startTrailing, endOfWeek, "Recent Consistency", "hm-trailing");
    const htmlActivity = buildActivityHeatmap(processedLog, startTrailing, endOfWeek, "Activity Log", "hm-activity");
    const htmlYear = buildGenericHeatmap(processedLog, eventMap, startYear, endYear, "Annual Overview", "hm-year");

    // Auto-Scroll Script
    setTimeout(() => {
        ['hm-trailing', 'hm-activity'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.scrollLeft = el.scrollWidth;
        });
    }, 100);

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            ${htmlTrailing}
            ${htmlActivity}
        </div>
        <div class="mt-8">
            ${htmlYear}
        </div>
    `;
}
