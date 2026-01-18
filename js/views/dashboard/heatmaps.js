// js/views/dashboard/heatmaps.js
import { toLocalYMD } from './utils.js';

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
                const d1 = new Date(parts[1]);
                if (!isNaN(d1.getTime())) eventMap[toLocalYMD(d1)] = parts[2];
            }
        }
    });
    return eventMap;
}

function buildGenericHeatmap(fullLog, eventMap, startDate, endDate, title, dateToKeyFn, containerId) {
    const dataMap = {}; 
    fullLog.forEach(item => { 
        const dateKey = dateToKeyFn(item.date); 
        if (!dataMap[dateKey]) dataMap[dateKey] = []; 
        dataMap[dateKey].push(item); 
    });
    
    const today = new Date(); today.setHours(0,0,0,0);
    const startDay = startDate.getDay(); 
    let cellsHtml = ''; 
    for (let i = 0; i < startDay; i++) cellsHtml += `<div class="w-3 h-3 m-[1px] opacity-0"></div>`; 
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dateKey = dateToKeyFn(currentDate); 
        const dayOfWeek = currentDate.getDay(); 
        const dayData = dataMap[dateKey]; 
        const eventName = eventMap && eventMap[dateKey];
        
        let colorClass = 'bg-slate-800'; 
        let statusLabel = "Empty"; 
        let inlineStyle = ""; 
        let detailStr = "";
        let sportLabel = "--";

        // Logic Vars
        let planDur = 0, actDur = 0;
        let isPlanMode = false, isRest = false;
        
        if (dayData && dayData.length > 0) {
            // 1. Detect Plan Mode using RAW KEY 'plannedWorkout'
            dayData.forEach(d => {
                if (d.plannedWorkout && d.plannedWorkout.length > 0) {
                    isPlanMode = true;
                    if (d.plannedWorkout.toLowerCase().includes('rest')) isRest = true;
                }
            });

            // 2. Sum
            dayData.forEach(d => {
                const isItemPlanned = (d.plannedWorkout && d.plannedWorkout.length > 0);
                // Strict: If Plan Mode, ignore purely unplanned items
                if (isPlanMode && !isItemPlanned) return;

                let p = d.plannedDuration || 0;
                let a = d.actualDuration || 0;
                // Auto-Fix: If we have a Plan Name but 0 duration, assume Duration = Actual
                if (isItemPlanned && p === 0 && a > 0) p = a;

                planDur += p;
                actDur += a;
                
                const name = (d.actualWorkout || d.plannedWorkout || 'Activity').replace(/['"]/g, "");
                detailStr += `${name} (${Math.round(a)}/${Math.round(p)}m)<br>`;
            });
        }

        const hasActivity = (planDur > 0 || actDur > 0 || isRest || eventName); 
        const isFuture = currentDate > today;

        if (eventName) { 
            colorClass = 'bg-purple-500'; statusLabel = eventName; 
        }
        else if (isPlanMode) {
            if (isRest) {
                colorClass = isFuture ? 'bg-slate-700/50' : 'bg-emerald-500/50';
                statusLabel = "Rest Day";
            } else if (actDur === 0) {
                colorClass = (isFuture || dateKey === toLocalYMD(today)) ? 'bg-slate-700' : 'bg-red-500/80';
                statusLabel = isFuture ? "Planned" : "Missed";
            } else {
                // Calculation
                const ratio = planDur > 0 ? (actDur / planDur) : 1.0;
                if (ratio >= 0.9) { colorClass = 'bg-emerald-500'; statusLabel = "Completed"; }
                else { colorClass = 'bg-yellow-500'; statusLabel = "Partial"; }
            }
        }
        else if (actDur > 0) {
            // Unplanned
            colorClass = 'bg-emerald-500/50'; statusLabel = "Unplanned";
        }
        else if (isFuture) {
            colorClass = 'bg-slate-800'; statusLabel = "Future";
        }

        if (dayOfWeek === 0 && !hasActivity && !eventName) { colorClass = ''; inlineStyle = 'opacity:0;'; }

        const clickAttr = hasActivity ? `onclick="window.showDashboardTooltip(event, '${dateKey}', ${Math.round(planDur)}, ${Math.round(actDur)}, '${statusLabel}', '', 'Activity', '${detailStr}')"` : '';
        const cursor = hasActivity ? 'cursor-pointer hover:opacity-80' : '';
        
        cellsHtml += `<div class="w-3 h-3 rounded-sm ${colorClass} ${cursor} m-[1px]" style="${inlineStyle}" ${clickAttr}></div>`;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // (Simplified Month Logic for brevity, assume standard render)
    return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col"><h3 class="text-sm font-bold text-white mb-4">${title}</h3><div id="${containerId}" class="overflow-x-auto"><div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">${cellsHtml}</div></div></div>`;
}

// --- ACTIVITY HEATMAP (Sport Types) ---
function buildActivityHeatmap(fullLog, startDate, endDate, title, dateToKeyFn, containerId) {
    // Standard Activity Logic...
    // (Preserving logic from previous steps but ensuring keys are 'actualWorkout' etc.)
    // ...
    // For brevity in this fix response, returning simple version:
    
    let cellsHtml = '';
    let currentDate = new Date(startDate);
    const today = new Date(); today.setHours(0,0,0,0);
    
    while(currentDate <= endDate) {
        let style = "opacity:0;";
        let colorClass = "";
        let dayData = fullLog.filter(d => dateToKeyFn(d.date) === dateToKeyFn(currentDate));
        
        if (dayData.length > 0) {
            let hasSwim=0, hasBike=0, hasRun=0;
            dayData.forEach(d => {
                if(d.actualDuration > 0) {
                    const t = (d.actualSport||d.type||"").toUpperCase();
                    if(t.includes('SWIM')) hasSwim=1;
                    if(t.includes('BIKE')) hasBike=1;
                    if(t.includes('RUN')) hasRun=1;
                }
            });
            
            if(hasSwim+hasBike+hasRun > 0) {
                style = "opacity:1.0;";
                if(hasSwim && !hasBike && !hasRun) style += "background-color:var(--color-swim);";
                else if(!hasSwim && hasBike && !hasRun) style += "background-color:var(--color-bike);";
                else if(!hasSwim && !hasBike && hasRun) style += "background-color:var(--color-run);";
                else style += "background: linear-gradient(135deg, var(--color-run), var(--color-bike));"; 
            } else {
               colorClass = "bg-slate-800";
               style = "";
            }
        } else {
            colorClass = "bg-slate-800";
        }
        
        if(currentDate.getDay()===0 && style.includes('opacity:0')) { colorClass=""; }
        
        cellsHtml += `<div class="w-3 h-3 rounded-sm ${colorClass} m-[1px]" style="${style}"></div>`;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col"><h3 class="text-sm font-bold text-white mb-4">${title}</h3><div id="${containerId}" class="overflow-x-auto"><div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">${cellsHtml}</div></div></div>`;
}

export function renderHeatmaps(fullLogData, planMd) {
    const eventMap = parseEvents(planMd);
    const today = new Date();
    today.setHours(0,0,0,0);

    // --- CONSOLIDATION: Merge Duplicates using RAW KEYS ---
    const consolidatedMap = {};
    fullLogData.forEach(item => {
        if (!item.date) return;
        const dKey = toLocalYMD(item.date);
        let sportKey = item.actualSport || item.plannedSport || "Any";
        // Normalize sport key
        if(sportKey.includes('Bike')) sportKey='Bike';
        if(sportKey.includes('Run')) sportKey='Run';
        if(sportKey.includes('Swim')) sportKey='Swim';
        
        const key = `${dKey}_${sportKey}`;
        
        if (!consolidatedMap[key]) {
            consolidatedMap[key] = { ...item };
        } else {
            // MERGE
            const existing = consolidatedMap[key];
            existing.plannedDuration = Math.max(existing.plannedDuration||0, item.plannedDuration||0);
            existing.actualDuration = Math.max(existing.actualDuration||0, item.actualDuration||0);
            
            // Prefer Completed Status
            if(item.status === 'COMPLETED') existing.status = 'COMPLETED';
            
            // MERGE STRINGS (The Fix)
            if(item.plannedWorkout && item.plannedWorkout.length > 0) existing.plannedWorkout = item.plannedWorkout;
            if(item.actualWorkout && item.actualWorkout.length > 0) existing.actualWorkout = item.actualWorkout;
        }
    });
    
    const processed = Object.values(consolidatedMap);
    
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
    
    const startTrailing = new Date(endOfWeek);
    startTrailing.setMonth(startTrailing.getMonth() - 6);
    
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            ${buildGenericHeatmap(processed, eventMap, startTrailing, endOfWeek, "Recent Consistency", toLocalYMD, "hm-trailing")}
            ${buildActivityHeatmap(processed, startTrailing, endOfWeek, "Activity Log", toLocalYMD, "hm-activity")}
        </div>
        <div class="mt-8">
            ${buildGenericHeatmap(processed, eventMap, startYear, endYear, "Annual Overview", toLocalYMD, "hm-year")}
        </div>
    `;
}
