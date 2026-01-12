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

// --- Internal Builder: Generic Heatmap ---
function buildGenericHeatmap(fullLog, eventMap, startDate, endDate, title, dateToKeyFn, containerId = null) {
    if (!fullLog) fullLog = [];
    const dataMap = {}; 
    fullLog.forEach(item => { 
        const dateKey = dateToKeyFn(item.date); 
        if (!dataMap[dateKey]) dataMap[dateKey] = []; 
        dataMap[dateKey].push(item); 
    });
    
    const today = new Date(); today.setHours(0,0,0,0);
    const highContrastStripe = "background-image: repeating-linear-gradient(45deg, #10b981, #10b981 3px, #065f46 3px, #065f46 6px);";
    
    const getHexColor = (cls) => {
        if (cls.includes('emerald-500')) return '#10b981';
        if (cls.includes('yellow-500')) return '#eab308';
        if (cls.includes('red-500')) return '#ef4444';
        if (cls.includes('purple-500')) return '#a855f7';
        if (cls.includes('slate-700')) return '#334155';
        return '#94a3b8'; // Default text color for others
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
        
        let totalPlan = 0; let totalAct = 0; let isRestType = false; 
        let sportLabel = "--";
        const uniqueTypes = new Set();

        if (dayData && dayData.length > 0) { 
            dayData.forEach(d => { 
                totalPlan += (d.plannedDuration || 0); 
                totalAct += (d.actualDuration || 0); 
                if (d.type === 'Rest') isRestType = true;
                if (d.type && d.type !== 'Rest') uniqueTypes.add(d.type);
            }); 
            if (uniqueTypes.size > 0) {
                sportLabel = Array.from(uniqueTypes).join(' + ');
            } else if (isRestType) {
                sportLabel = "Rest Day";
            }
        }
        
        if (eventName) sportLabel = "Event";

        const hasActivity = (totalPlan > 0 || totalAct > 0 || isRestType || eventName); 
        const isFuture = currentDate > today;

        if (eventName) { colorClass = 'bg-purple-500'; statusLabel = `${eventName}`; }
        else if (totalAct > 0 && (totalPlan === 0 || isRestType)) { colorClass = 'bg-emerald-500'; inlineStyle = highContrastStripe; statusLabel = "Unplanned"; }
        else if (isFuture) { 
            if (totalPlan > 0) { colorClass = 'bg-slate-700'; statusLabel = "Planned"; } 
            else { colorClass = 'bg-slate-800'; statusLabel = "Future"; } 
        }
        else { 
            if (totalPlan > 0) { 
                if (totalAct === 0) { colorClass = 'bg-red-500/80'; statusLabel = "Missed"; } 
                else { 
                    const ratio = totalAct / totalPlan; 
                    if (ratio >= 0.95) { colorClass = 'bg-emerald-500'; statusLabel = "Completed"; } 
                    else { colorClass = 'bg-yellow-500'; statusLabel = `Partial (${Math.round(ratio*100)}%)`; } 
                } 
            } else { colorClass = 'bg-emerald-500/50'; statusLabel = "Rest Day"; } 
        }

        if (dayOfWeek === 0 && !hasActivity && !eventName) { colorClass = ''; inlineStyle = 'opacity: 0;'; }

        const hexColor = getHexColor(colorClass);
        const clickAttr = hasActivity || isFuture ? 
            `onclick="window.showDashboardTooltip(event, '${dateKey}', ${totalPlan}, ${totalAct}, '${statusLabel.replace(/'/g, "\\'")}', '${hexColor}', '${sportLabel}')"` : '';
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
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <i class="fa-solid fa-calendar-check text-slate-400"></i> ${title}
            </h3>
            <div ${idAttr} class="overflow-x-auto pb-4">
                <div class="grid grid-rows-1 grid-flow-col gap-1 w-max mx-auto mb-1">
                    ${monthsHtml}
                </div>
                <div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">
                    ${cellsHtml}
                </div>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-4 mt-2 text-[10px] text-slate-400 font-mono">
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-purple-500"></div> Event</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-emerald-500/50"></div> Rest</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-slate-700"></div> Planned</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-emerald-500"></div> Done</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-emerald-500" style="${highContrastStripe}"></div> Unplanned</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-yellow-500"></div> Partial</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-red-500/80"></div> Missed</div>
            </div>
        </div>
    `;
}

// --- Main Export ---
export function renderHeatmaps(fullLogData, planMd) {
    const eventMap = parseEvents(planMd);
    const today = new Date();
    today.setHours(0,0,0,0);

    const endOfWeek = new Date(today); 
    const dayOfWeek = endOfWeek.getDay(); 
    const distToSunday = 7 - (dayOfWeek === 0 ? 7 : dayOfWeek); 
    endOfWeek.setDate(endOfWeek.getDate() + distToSunday); 
    if (dayOfWeek === 0) endOfWeek.setDate(endOfWeek.getDate()); 

    const startTrailing = new Date(endOfWeek); 
    startTrailing.setMonth(startTrailing.getMonth() - 6);
    
    const startYear = new Date(today.getFullYear(), 0, 1); 
    const endYear = new Date(today.getFullYear(), 11, 31);
    
    const heatmapTrailingHtml = buildGenericHeatmap(fullLogData, eventMap, startTrailing, endOfWeek, "Recent Consistency (Trailing 6 Months)", toLocalYMD, "heatmap-trailing-scroll");
    const heatmapYearHtml = buildGenericHeatmap(fullLogData, eventMap, startYear, endYear, `Annual Overview (${today.getFullYear()})`, toLocalYMD, null);

    // Add slight delay for scroll effect (can be moved to a post-render effect if preferred, but keeping simple here)
    setTimeout(() => {
        const scrollContainer = document.getElementById('heatmap-trailing-scroll');
        if (scrollContainer) {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth;
        }
    }, 50);

    return `
        <div class="grid grid-cols-1 gap-8 mt-8">
            ${heatmapTrailingHtml}
            ${heatmapYearHtml}
        </div>
    `;
}
