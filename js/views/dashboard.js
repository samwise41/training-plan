import { Parser } from '../parser.js';

export function renderDashboard(planMd) {
    // 1. Extract Weekly Schedule Data (For Cards)
    const scheduleSection = Parser.getSection(planMd, "Weekly Schedule");
    if (!scheduleSection) return '<p class="text-slate-500 italic">No Weekly Schedule found.</p>';

    // Parse Current Week Workouts
    const workouts = Parser._parseTableBlock(scheduleSection);
    workouts.sort((a, b) => a.date - b.date);

    // 2. Build Progress Widget (Top)
    const progressHtml = buildProgressWidget(workouts);

    // 3. Prepare Data for Heatmaps (Full History + Events)
    const fullLogData = Parser.parseTrainingLog(planMd);
    
    // --- HELPER: TIMEZONE SAFE DATE KEY ---
    // Forces everything to local "YYYY-MM-DD" to ensure keys match
    const toLocalYMD = (dateInput) => {
        const d = new Date(dateInput);
        // Adjust for timezone offset to get "Local Date" as YYYY-MM-DD
        // (Simple trick: use the date components directly)
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- ROBUST EVENT PARSING ---
    const eventMap = {};
    const lines = planMd.split('\n');
    let inEventSection = false;

    lines.forEach(line => {
        // Detect Section 1 specifically to avoid false positives
        if (line.includes('1. Event Schedule')) inEventSection = true;
        if (line.includes('2. User Profile')) inEventSection = false;

        if (inEventSection && line.trim().startsWith('|') && !line.includes('---')) {
            const parts = line.split('|').map(p => p.trim());
            // Typical format: | Date | Event Name | ...
            // parts[1] is usually Date, parts[2] is Name.
            if (parts.length > 2) {
                const col1 = parts[1];
                const col2 = parts[2];
                
                // Try parsing Col 1 as date
                const d1 = new Date(col1);
                if (!isNaN(d1.getTime()) && d1.getFullYear() > 2020) {
                    eventMap[toLocalYMD(d1)] = col2;
                }
            }
        }
    });

    // 4. Generate Two Heatmaps
    // A. Trailing 6 Months
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const endOfWeek = new Date(today);
    const dayOfWeek = endOfWeek.getDay(); // 0=Sun
    const distToSunday = 7 - (dayOfWeek === 0 ? 7 : dayOfWeek); 
    endOfWeek.setDate(endOfWeek.getDate() + distToSunday); 
    if (dayOfWeek === 0) endOfWeek.setDate(endOfWeek.getDate()); 
    
    const startTrailing = new Date(endOfWeek);
    startTrailing.setMonth(startTrailing.getMonth() - 6);

    // B. Calendar Year
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);

    const heatmapTrailingHtml = buildGenericHeatmap(fullLogData, eventMap, startTrailing, endOfWeek, "Recent Consistency (Trailing 6 Months)", toLocalYMD);
    const heatmapYearHtml = buildGenericHeatmap(fullLogData, eventMap, startYear, endYear, `Annual Overview (${today.getFullYear()})`, toLocalYMD);

    // 5. Helpers for Card Styling
    const getIcon = (type) => {
        if (type === 'Bike') return 'fa-bicycle text-blue-500';
        if (type === 'Run') return 'fa-person-running text-emerald-500';
        if (type === 'Swim') return 'fa-person-swimming text-cyan-500';
        if (type === 'Strength') return 'fa-dumbbell text-purple-500';
        return 'fa-stopwatch text-slate-500';
    };

    const getTypeColor = (type) => {
        if (type === 'Bike') return 'text-blue-500';
        if (type === 'Run') return 'text-emerald-500';
        if (type === 'Swim') return 'text-cyan-500';
        return 'text-slate-400';
    };

    // 6. Build Weekly Cards Grid
    let cardsHtml = '';
    const grouped = {};
    
    workouts.forEach(w => {
        const key = toLocalYMD(w.date);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(w);
    });

    const sortedKeys = Object.keys(grouped).sort();

    sortedKeys.forEach(dateKey => {
        const dailyWorkouts = grouped[dateKey];
        const dateObj = dailyWorkouts[0].date;
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const isToday = dateObj.getDate() === today.getDate() && 
                        dateObj.getMonth() === today.getMonth() && 
                        dateObj.getFullYear() === today.getFullYear();
        
        dailyWorkouts.forEach(w => {
            const notes = w.notes ? w.notes.replace(/\[.*?\]/g, '') : "No specific notes.";
            let displayDuration = w.plannedDuration;
            let displayUnit = "mins";
            let statusText = "PLANNED";
            let statusColor = "text-white"; 
            let cardBorder = 'border border-slate-700 hover:border-slate-600'; 

            if (w.completed) {
                statusText = "COMPLETED";
                statusColor = "text-emerald-500";
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
                statusColor = "text-slate-500";
            }

            cardsHtml += `
                <div class="bg-slate-800 rounded-xl p-6 shadow-lg relative overflow-hidden transition-all ${cardBorder}">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-widest">${dayName}</span>
                        <i class="fa-solid ${getIcon(w.type)} text-xl opacity-80"></i>
                    </div>
                    <div class="flex justify-between items-center mb-6 mt-1">
                        <div class="flex flex-col">
                            <div class="flex items-baseline gap-1">
                                <span class="text-5xl font-bold text-white tracking-tight leading-none">${displayDuration}</span>
                                <span class="text-lg font-medium text-slate-400 font-mono">${displayUnit}</span>
                            </div>
                            <div class="text-sm font-bold ${statusColor} uppercase tracking-widest mt-1">${statusText}</div>
                        </div>
                        <div class="text-right pl-4 max-w-[55%]">
                            <h3 class="text-lg font-bold ${getTypeColor(w.type)} leading-tight">${w.planName}</h3>
                        </div>
                    </div>
                    <div class="h-px bg-slate-700 w-full mb-4"></div>
                    <div>
                        <p class="text-sm text-slate-300 leading-relaxed font-sans">${notes}</p>
                    </div>
                    ${w.actualDuration > 0 ? `
                        <div class="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                            <span class="text-[10px] font-bold text-slate-500 uppercase">Actual Duration</span>
                            <span class="text-sm font-mono font-bold text-emerald-400">${w.actualDuration} min</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });
    });

    return `
        ${progressHtml}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            ${cardsHtml}
        </div>
        
        <div class="grid grid-cols-1 gap-8">
            ${heatmapTrailingHtml}
            ${heatmapYearHtml}
        </div>
    `;
}

/**
 * Generic Heatmap Builder with Click Tool & Invisible Sundays
 */
function buildGenericHeatmap(fullLog, eventMap, startDate, endDate, title, dateToKeyFn) {
    if (!fullLog) fullLog = [];

    // 1. Map Data using consistent Key Function
    const dataMap = {};
    fullLog.forEach(item => {
        const dateKey = dateToKeyFn(item.date);
        if (!dataMap[dateKey]) dataMap[dateKey] = [];
        dataMap[dateKey].push(item);
    });

    const today = new Date();
    today.setHours(0,0,0,0);

    const highContrastStripe = "background-image: repeating-linear-gradient(45deg, #10b981, #10b981 3px, #065f46 3px, #065f46 6px);";

    // 2. Alignment Logic: Insert Empty Cells until Sunday
    const startDay = startDate.getDay(); // 0=Sun
    let cellsHtml = '';
    
    // Add Spacers (invisible)
    for (let i = 0; i < startDay; i++) {
        cellsHtml += `<div class="w-3 h-3 m-[1px] opacity-0"></div>`;
    }

    // 3. Generate Cells
    let currentDate = new Date(startDate);
    
    // Ensure loop doesn't run forever
    const maxLoops = 400; 
    let loops = 0;

    while (currentDate <= endDate && loops < maxLoops) {
        loops++;
        
        const dateKey = dateToKeyFn(currentDate);
        const dayOfWeek = currentDate.getDay(); 
        const dayData = dataMap[dateKey];
        const eventName = eventMap && eventMap[dateKey];
        
        // Defaults
        let colorClass = 'bg-slate-800'; 
        let tooltip = `${dateKey}: Empty`;
        let inlineStyle = ""; 
        let clickDetails = `Date: ${dateKey}\\nStatus: No Data`;

        let totalPlan = 0;
        let totalAct = 0;
        let isRestType = false;
        let workoutDetails = "";

        if (dayData && dayData.length > 0) {
            dayData.forEach(d => {
                totalPlan += (d.plannedDuration || 0);
                totalAct += (d.actualDuration || 0);
                if (d.type === 'Rest') isRestType = true;
                workoutDetails += `\\n• ${d.type}: ${d.plannedDuration}m Plan / ${d.actualDuration}m Act`;
            });
        }

        const hasActivity = (totalPlan > 0 || totalAct > 0 || isRestType || eventName);
        const isFuture = currentDate > today;

        // --- Logic Tree ---
        if (eventName) {
            colorClass = 'bg-purple-500';
            tooltip = `${dateKey}: 🏆 ${eventName}`;
            clickDetails = `Date: ${dateKey}\\nEvent: ${eventName}${workoutDetails}`;
        }
        else if (totalAct > 0 && (totalPlan === 0 || isRestType)) {
            // Unplanned
            colorClass = 'bg-emerald-500';
            inlineStyle = highContrastStripe;
            tooltip = `${dateKey}: Unplanned Workout`;
            clickDetails = `Date: ${dateKey}\\nStatus: Unplanned Workout${workoutDetails}`;
        }
        else if (isFuture) {
             if (totalPlan > 0) {
                 colorClass = 'bg-slate-700'; 
                 tooltip = `${dateKey}: Planned`;
                 clickDetails = `Date: ${dateKey}\\nStatus: Planned (Future)${workoutDetails}`;
             } else {
                 colorClass = 'bg-slate-800';
                 tooltip = `${dateKey}: Future`;
                 clickDetails = `Date: ${dateKey}\\nStatus: Future (Empty)`;
             }
        }
        else {
            // PAST
            if (totalPlan > 0) {
                if (totalAct === 0) {
                    // Missed
                    colorClass = 'bg-red-500/80';
                    tooltip = `${dateKey}: Missed`;
                    clickDetails = `Date: ${dateKey}\\nStatus: Missed Workout${workoutDetails}`;
                } else {
                    // Compliance
                    const ratio = totalAct / totalPlan;
                    if (ratio >= 0.95) {
                        colorClass = 'bg-emerald-500';
                        tooltip = `${dateKey}: Completed`;
                        clickDetails = `Date: ${dateKey}\\nStatus: Completed${workoutDetails}`;
                    } else {
                        colorClass = 'bg-yellow-500';
                        tooltip = `${dateKey}: Partial (${Math.round(ratio*100)}%)`;
                        clickDetails = `Date: ${dateKey}\\nStatus: Partial Completion${workoutDetails}`;
                    }
                }
            } else {
                // Past Rest
                colorClass = 'bg-emerald-500/50'; 
                tooltip = `${dateKey}: Rest Day`;
                clickDetails = `Date: ${dateKey}\\nStatus: Rest Day`;
            }
        }

        // --- SUNDAY VISIBILITY LOGIC ---
        // Hide Sunday ONLY if it has no activity/event
        if (dayOfWeek === 0 && !hasActivity) {
            colorClass = ''; 
            inlineStyle = 'opacity: 0;'; 
            clickDetails = ''; 
        }

        const clickAttr = clickDetails ? `onclick="alert('${clickDetails}')" cursor-pointer` : '';
        const cursorClass = clickDetails ? 'cursor-pointer hover:opacity-80' : '';

        // SIZE: w-3 h-3
        cellsHtml += `<div class="w-3 h-3 rounded-sm ${colorClass} ${cursorClass} m-[1px]" style="${inlineStyle}" title="${tooltip}" ${clickAttr}></div>`;
        
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <i class="fa-solid fa-calendar-check text-slate-400"></i> ${title}
            </h3>
            
            <div class="overflow-x-auto pb-4">
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

// ... (buildProgressWidget remains exactly the same) ...
function buildProgressWidget(workouts) {
    const today = new Date();
    today.setHours(23, 59, 59, 999); 

    let totalPlanned = 0;
    let totalActual = 0;
    let expectedSoFar = 0;
    const totalDailyMarkers = {};

    const sportStats = {
        Bike: { planned: 0, actual: 0, dailyMarkers: {} },
        Run: { planned: 0, actual: 0, dailyMarkers: {} },
        Swim: { planned: 0, actual: 0, dailyMarkers: {} }
    };

    workouts.forEach(w => {
        const plan = w.plannedDuration || 0;
        const act = w.actualDuration || 0;
        const dateKey = w.date.toISOString().split('T')[0];

        totalPlanned += plan;
        totalActual += act;
        if (w.date <= today) expectedSoFar += plan;
        if (!totalDailyMarkers[dateKey]) totalDailyMarkers[dateKey] = 0;
        totalDailyMarkers[dateKey] += plan;

        if (sportStats[w.type]) {
            sportStats[w.type].planned += plan;
            sportStats[w.type].actual += act;
            if (!sportStats[w.type].dailyMarkers[dateKey]) sportStats[w.type].dailyMarkers[dateKey] = 0;
            sportStats[w.type].dailyMarkers[dateKey] += plan;
        }
    });

    const generateBarHtml = (label, iconClass, actual, planned, dailyMap, isMain = false) => {
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
        const iconHtml = iconClass ? `<i class="fa-solid ${iconClass} text-slate-500 mr-2 w-4 text-center"></i>` : '';
        const heightClass = isMain ? 'h-3' : 'h-2.5';
        const mbClass = isMain ? 'mb-4' : 'mb-3';
        
        const pctColor = displayPct > 100 ? 'text-emerald-400' : 'text-blue-400';

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
                    <div class="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-1000 ease-out" style="width: ${barWidth}%"></div>
                </div>
            </div>
        `;
    };

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

    return `
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-8 flex flex-col md:flex-row items-start gap-6 shadow-sm">
            <div class="flex-1 w-full">
                ${generateBarHtml('Weekly Goal', null, totalActual, totalPlanned, totalDailyMarkers, true)}
                ${generateBarHtml('Bike', 'fa-bicycle', sportStats.Bike.actual, sportStats.Bike.planned, sportStats.Bike.dailyMarkers)}
                ${generateBarHtml('Run', 'fa-person-running', sportStats.Run.actual, sportStats.Run.planned, sportStats.Run.dailyMarkers)}
                ${generateBarHtml('Swim', 'fa-person-swimming', sportStats.Swim.actual, sportStats.Swim.planned, sportStats.Swim.dailyMarkers)}
            </div>
            <div class="w-full md:w-auto md:border-l md:border-slate-700 md:pl-6 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start gap-4 md:gap-1 self-center">
                <div>
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Pacing</span>
                    <div class="flex items-center gap-2">
                        <i class="fa-solid ${pacingIcon} ${pacingColor}"></i>
                        <span class="text-lg font-bold ${pacingColor}">${pacingLabel}</span>
                    </div>
                </div>
                <div class="text-right md:text-left flex flex-col items-end md:items-start mt-2">
                    <span class="text-[10px] text-slate-300 font-mono mb-0.5">
                        Actual: ${Math.round(totalActual)}m <span class="text-slate-500">(${totalActualHrsPacing}h)</span>
                    </span>
                    <span class="text-[10px] text-slate-500 font-mono">
                        Target: ${Math.round(expectedSoFar)}m <span class="text-slate-600">(${expectedHrs}h)</span>
                    </span>
                </div>
            </div>
        </div>
    `;
}
