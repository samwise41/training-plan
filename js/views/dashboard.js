import { Parser } from '../parser.js';

// --- DASHBOARD TOOLTIP HANDLER (UPDATED WITH SPORT TYPE) ---
window.showDashboardTooltip = (evt, date, plan, act, label, color, sportType) => {
    let tooltip = document.getElementById('dashboard-tooltip-popup');
    
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'dashboard-tooltip-popup';
        tooltip.className = 'z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed min-w-[140px]';
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
        <div class="text-center">
            <div class="text-white font-bold text-sm mb-0.5 whitespace-nowrap">
                Plan: ${Math.round(plan)}m | Act: ${Math.round(act)}m
            </div>
            
            <div class="text-[10px] text-slate-400 font-normal mb-1">
                ${date}
            </div>

            <div class="text-[10px] text-slate-200 font-mono font-bold border-b border-slate-700 pb-1 mb-1">
                ${sportType}
            </div>

            <div class="text-[11px] font-bold mt-1 uppercase tracking-wide" style="color: ${color}">
                ${label}
            </div>
        </div>
    `;

    // Position Logic (Smart Edge Detection)
    const x = evt.clientX;
    const y = evt.clientY;
    const viewportWidth = window.innerWidth;
    
    tooltip.style.top = `${y - 75}px`; // Moved up slightly to accommodate extra line
    tooltip.style.left = '';
    tooltip.style.right = '';

    if (x > viewportWidth * 0.60) {
        tooltip.style.right = `${viewportWidth - x + 10}px`;
        tooltip.style.left = 'auto';
    } else {
        tooltip.style.left = `${x - 70}px`; 
        tooltip.style.right = 'auto';
    }
    
    if (parseInt(tooltip.style.left) < 10) tooltip.style.left = '10px';

    tooltip.classList.remove('opacity-0');
    
    if (window.dashTooltipTimer) clearTimeout(window.dashTooltipTimer);
    window.dashTooltipTimer = setTimeout(() => {
        tooltip.classList.add('opacity-0');
    }, 3000);
};

// ---  Local Copy of Collapsible Builder  ---
const buildCollapsibleSection = (id, title, contentHtml, isOpen = true) => {
    const contentClasses = isOpen 
        ? "max-h-[5000px] opacity-100 py-4 mb-8" 
        : "max-h-0 opacity-0 py-0 mb-0";
    const iconClasses = isOpen 
        ? "rotate-0" 
        : "-rotate-90";

    return `
        <div class="w-full">
            <div class="flex items-center gap-2 cursor-pointer py-3 border-b-2 border-slate-700 hover:border-slate-500 transition-colors group select-none" onclick="window.toggleSection('${id}')">
                <i class="fa-solid fa-caret-down text-slate-400 text-base transition-transform duration-300 group-hover:text-white ${iconClasses}"></i>
                <h2 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">${title}</h2>
            </div>
            <div id="${id}" class="collapsible-content overflow-hidden transition-all duration-500 ease-in-out ${contentClasses}">
                ${contentHtml}
            </div>
        </div>
    `;
};

// Updated to accept merged history data
export function renderDashboard(planMd, mergedLogData) {
    const scheduleSection = Parser.getSection(planMd, "Weekly Schedule");
    if (!scheduleSection) return '<p class="text-slate-500 italic">No Weekly Schedule found.</p>';

    const workouts = Parser._parseTableBlock(scheduleSection);
    workouts.sort((a, b) => a.date - b.date);

    // 2. Weekly Cards Grid
    const fullLogData = mergedLogData || Parser.parseTrainingLog(planMd);

    // 1. Progress Widget (Top, Uncollapsed)
    const progressHtml = buildProgressWidget(workouts, fullLogData);
    
    // --- SMART EVENT PARSING ---
    const eventMap = {};
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

    // --- HELPER: Get Sport Color Variable ---
    const getSportColorVar = (type) => {
        if (type === 'Bike') return 'var(--color-bike)';
        if (type === 'Run') return 'var(--color-run)';
        if (type === 'Swim') return 'var(--color-swim)';
        if (type === 'Strength') return 'var(--color-strength, #a855f7)';
        return 'var(--color-all)';
    };

    const getIcon = (type) => { 
        const colorStyle = `style="color: ${getSportColorVar(type)}"`;
        if (type === 'Bike') return `<i class="fa-solid fa-bicycle text-xl opacity-80" ${colorStyle}></i>`;
        if (type === 'Run') return `<i class="fa-solid fa-person-running text-xl opacity-80" ${colorStyle}></i>`;
        if (type === 'Swim') return `<i class="fa-solid fa-person-swimming text-xl opacity-80" ${colorStyle}></i>`;
        if (type === 'Strength') return `<i class="fa-solid fa-dumbbell text-xl opacity-80" ${colorStyle}></i>`;
        return `<i class="fa-solid fa-stopwatch text-slate-500 text-xl opacity-80"></i>`; 
    };

    let cardsHtml = '';
    const grouped = {};
    workouts.forEach(w => { const key = toLocalYMD(w.date); if (!grouped[key]) grouped[key] = []; grouped[key].push(w); });
    const sortedKeys = Object.keys(grouped).sort();
    const today = new Date(); today.setHours(0,0,0,0);

    sortedKeys.forEach(dateKey => {
        const dailyWorkouts = grouped[dateKey];
        const dateObj = dailyWorkouts[0].date;
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const isToday = dateObj.getDate() === today.getDate() && dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
        
        dailyWorkouts.forEach(w => {
            const notes = w.notes ? w.notes.replace(/\[.*?\]/g, '') : "No specific notes.";
            let displayDuration = w.plannedDuration; 
            let displayUnit = "mins"; 
            let statusText = "PLANNED"; 
            let statusColorClass = "text-white"; 
            let cardBorder = 'border border-slate-700 hover:border-slate-600'; 
            
            if (w.completed) { 
                statusText = "COMPLETED"; 
                statusColorClass = "text-emerald-500"; 
                const plan = w.plannedDuration || 0; 
                const act = w.actualDuration || 0; 
                const ratio = plan > 0 ? (act / plan) : 1; 
                if (ratio >= 0.95) cardBorder = 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-900'; 
                else if (ratio >= 0.80) cardBorder = 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-slate-900'; 
                else cardBorder = 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-900'; 
            } else if (isToday) { 
                cardBorder = 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'; 
            } else if (w.type === 'Rest') { 
                displayDuration = "--"; 
                statusText = "REST DAY"; 
                statusColorClass = "text-slate-500"; 
            }

            const titleStyle = `style="color: ${getSportColorVar(w.type)}"`;

            cardsHtml += `
            <div class="bg-slate-800 rounded-xl p-6 shadow-lg relative overflow-hidden transition-all ${cardBorder}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[11px] font-bold text-slate-500 uppercase tracking-widest">${dayName}</span>
                    ${getIcon(w.type)}
                </div>
                <div class="flex justify-between items-center mb-6 mt-1">
                    <div class="flex flex-col">
                        <div class="flex items-baseline gap-1">
                            <span class="text-5xl font-bold text-white tracking-tight leading-none">${displayDuration}</span>
                            <span class="text-lg font-medium text-slate-400 font-mono">${displayUnit}</span>
                        </div>
                        <div class="text-sm font-bold ${statusColorClass} uppercase tracking-widest mt-1">${statusText}</div>
                    </div>
                    <div class="text-right pl-4 max-w-[55%]">
                        <h3 class="text-lg font-bold leading-tight" ${titleStyle}>${w.planName}</h3>
                    </div>
                </div>
                <div class="h-px bg-slate-700 w-full mb-4"></div>
                <div><p class="text-sm text-slate-300 leading-relaxed font-sans">${notes}</p></div>
                ${w.actualDuration > 0 ? `<div class="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center"><span class="text-[10px] font-bold text-slate-500 uppercase">Actual Duration</span><span class="text-sm font-mono font-bold text-emerald-400">${w.actualDuration} min</span></div>` : ''}
            </div>`;
        });
    });

    const cardsContainerHtml = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-0 p-2">${cardsHtml}</div>`;
    const plannedWorkoutsSection = buildCollapsibleSection('planned-workouts-section', 'Planned Workouts', cardsContainerHtml, true);

    const endOfWeek = new Date(today); const dayOfWeek = endOfWeek.getDay(); const distToSunday = 7 - (dayOfWeek === 0 ? 7 : dayOfWeek); endOfWeek.setDate(endOfWeek.getDate() + distToSunday); if (dayOfWeek === 0) endOfWeek.setDate(endOfWeek.getDate()); 
    const startTrailing = new Date(endOfWeek); startTrailing.setMonth(startTrailing.getMonth() - 6);
    const startYear = new Date(today.getFullYear(), 0, 1); const endYear = new Date(today.getFullYear(), 11, 31);
    
    const heatmapTrailingHtml = buildGenericHeatmap(fullLogData, eventMap, startTrailing, endOfWeek, "Recent Consistency (Trailing 6 Months)", toLocalYMD, "heatmap-trailing-scroll");
    const heatmapYearHtml = buildGenericHeatmap(fullLogData, eventMap, startYear, endYear, `Annual Overview (${today.getFullYear()})`, toLocalYMD, null);

    setTimeout(() => {
        const scrollContainer = document.getElementById('heatmap-trailing-scroll');
        if (scrollContainer) {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth;
        }
    }, 50);

    return `
        ${progressHtml}
        ${plannedWorkoutsSection}
        <div class="grid grid-cols-1 gap-8 mt-8">${heatmapTrailingHtml}${heatmapYearHtml}</div>
        <div id="dashboard-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed"></div>
    `;
}

const toLocalYMD = (dateInput) => {
    const d = new Date(dateInput);
    const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Updated to match the new tooltip structure
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
        
        // --- CALCULATE SPORT TYPE STRING ---
        let sportLabel = "--";
        const uniqueTypes = new Set();

        if (dayData && dayData.length > 0) { 
            dayData.forEach(d => { 
                totalPlan += (d.plannedDuration || 0); 
                totalAct += (d.actualDuration || 0); 
                if (d.type === 'Rest') isRestType = true;
                if (d.type && d.type !== 'Rest') uniqueTypes.add(d.type);
            }); 
            
            // Convert Set to String (e.g. "Run" or "Swim + Bike")
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
        
        // Pass Sport Label to Tooltip
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

// ... (Rest of Streak Logic remains unchanged) ...
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

function buildProgressWidget(workouts, fullLogData) {
    const today = new Date(); today.setHours(23, 59, 59, 999); 
    let totalPlanned = 0; let totalActual = 0; let expectedSoFar = 0; const totalDailyMarkers = {};
    const sportStats = { Bike: { planned: 0, actual: 0, dailyMarkers: {} }, Run: { planned: 0, actual: 0, dailyMarkers: {} }, Swim: { planned: 0, actual: 0, dailyMarkers: {} } };
    workouts.forEach(w => {
        const plan = w.plannedDuration || 0; const act = w.actualDuration || 0; const dateKey = w.date.toISOString().split('T')[0];
        totalPlanned += plan; totalActual += act; if (w.date <= today) expectedSoFar += plan; if (!totalDailyMarkers[dateKey]) totalDailyMarkers[dateKey] = 0; totalDailyMarkers[dateKey] += plan;
        if (sportStats[w.type]) { sportStats[w.type].planned += plan; sportStats[w.type].actual += act; if (!sportStats[w.type].dailyMarkers[dateKey]) sportStats[w.type].dailyMarkers[dateKey] = 0; sportStats[w.type].dailyMarkers[dateKey] += plan; }
    });

    const getSportColorVar = (type) => {
        if (type === 'Bike') return 'var(--color-bike)';
        if (type === 'Run') return 'var(--color-run)';
        if (type === 'Swim') return 'var(--color-swim)';
        return 'var(--color-all)';
    };

    const generateBarHtml = (label, iconClass, actual, planned, dailyMap, isMain = false, sportType = 'All') => {
        const rawPct = planned > 0 ? Math.round((actual / planned) * 100) : 0; const displayPct = rawPct; const barWidth = Math.min(rawPct, 100); const actualHrs = (actual / 60).toFixed(1); const plannedHrs = (planned / 60).toFixed(1);
        let markersHtml = ''; let runningTotal = 0; const sortedDays = Object.keys(dailyMap).sort();
        if (planned > 0) { for (let i = 0; i < sortedDays.length - 1; i++) { runningTotal += dailyMap[sortedDays[i]]; const pct = (runningTotal / planned) * 100; markersHtml += `<div class="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10" style="left: ${pct}%"></div>`; } }
        const labelHtml = isMain ? `<span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">${label}</span>` : ''; 
        const colorStyle = `style="color: ${getSportColorVar(sportType)}"`;
        const iconHtml = iconClass ? `<i class="fa-solid ${iconClass} mr-2 w-4 text-center" ${colorStyle}></i>` : ''; 
        const heightClass = isMain ? 'h-3' : 'h-2.5'; const mbClass = isMain ? 'mb-4' : 'mb-3'; const pctColor = displayPct > 100 ? 'text-emerald-400' : 'text-blue-400';
        const barBgStyle = `style="width: ${barWidth}%; background-color: ${getSportColorVar(sportType)}"`;

        return `<div class="flex-1 w-full ${mbClass}"><div class="flex justify-between items-end mb-1"><div class="flex flex-col">${labelHtml}<div class="flex items-center">${iconHtml}<span class="text-sm font-bold text-white flex items-baseline gap-1">${Math.round(actual)} / ${Math.round(planned)} mins<span class="text-xs text-slate-400 font-normal ml-1">(${actualHrs} / ${plannedHrs} hrs)</span></span></div></div><span class="text-xs font-bold ${pctColor}">${displayPct}%</span></div><div class="relative w-full ${heightClass} bg-slate-700 rounded-full overflow-hidden">${markersHtml}<div class="absolute top-0 left-0 h-full transition-all duration-1000 ease-out" ${barBgStyle}></div></div></div>`;
    };
    
    const pacingDiff = totalActual - expectedSoFar; let pacingLabel = "On Track"; let pacingColor = "text-slate-400"; let pacingIcon = "fa-check";
    if (pacingDiff >= 15) { pacingLabel = `${Math.round(pacingDiff)}m Ahead`; pacingColor = "text-emerald-400"; pacingIcon = "fa-arrow-trend-up"; } else if (pacingDiff <= -15) { pacingLabel = `${Math.abs(Math.round(pacingDiff))}m Behind`; pacingColor = "text-orange-400"; pacingIcon = "fa-triangle-exclamation"; }
    const totalActualHrsPacing = (totalActual / 60).toFixed(1); const expectedHrs = (expectedSoFar / 60).toFixed(1);

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
