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

    // 3. Build Compliance Heatmap (Bottom - Requires Full History)
    const fullLogData = Parser.parseTrainingLog(planMd);
    const heatmapHtml = buildComplianceHeatmap(fullLogData);

    // 4. Helpers for Card Styling
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

    // 5. Build Weekly Cards Grid
    let cardsHtml = '';
    const grouped = {};
    
    workouts.forEach(w => {
        const key = w.date.toISOString().split('T')[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(w);
    });

    const sortedKeys = Object.keys(grouped).sort();

    sortedKeys.forEach(dateKey => {
        const dailyWorkouts = grouped[dateKey];
        const dateObj = dailyWorkouts[0].date;
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        
        // Check if today
        const today = new Date();
        const isToday = dateObj.getDate() === today.getDate() && 
                        dateObj.getMonth() === today.getMonth() && 
                        dateObj.getFullYear() === today.getFullYear();
        
        dailyWorkouts.forEach(w => {
            const notes = w.notes ? w.notes.replace(/\[.*?\]/g, '') : "No specific notes.";
            
            // Determine "Big Number" text & Status Colors
            let displayDuration = w.plannedDuration;
            let displayUnit = "mins";
            let statusText = "PLANNED";
            let statusColor = "text-white"; 

            // --- BORDER LOGIC ---
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
        ${heatmapHtml}
    `;
}

/**
 * Builds the GitHub-style Compliance Heatmap
 */
function buildComplianceHeatmap(fullLog) {
    if (!fullLog) fullLog = [];

    // 1. Setup Date Range (Current Year)
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today for comparison

    const currentYear = today.getFullYear();
    const startDate = new Date(currentYear, 0, 1); // Jan 1
    const endDate = new Date(currentYear, 11, 31); // Dec 31
    
    // 2. Map Data for quick lookup
    const dataMap = {};
    fullLog.forEach(item => {
        const dateKey = item.date.toISOString().split('T')[0];
        if (!dataMap[dateKey]) dataMap[dateKey] = [];
        dataMap[dateKey].push(item);
    });

    // 3. Generate Grid HTML
    let cellsHtml = '';
    let currentDate = new Date(startDate);
    
    // Stripe Style (CSS Gradient)
    const stripeStyle = "background-image: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px);";

    while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayData = dataMap[dateKey];
        
        let colorClass = 'bg-slate-800'; // DEFAULT: Grey (Rest / Empty)
        let tooltip = `${dateKey}: Rest / No Plan`;
        let inlineStyle = ""; // Used for stripes

        // Calculate Totals
        let totalPlan = 0;
        let totalAct = 0;
        let hasCompleted = false;
        let hasMissed = false;

        if (dayData && dayData.length > 0) {
            dayData.forEach(d => {
                totalPlan += (d.plannedDuration || 0);
                totalAct += (d.actualDuration || 0);
                
                // If it's explicitly a "Rest" type, we essentially treat plan as 0
                if (d.type !== 'Rest') {
                    if (d.completed) hasCompleted = true;
                    // If in past, planned but not completed
                    else if (currentDate < today && d.plannedDuration > 0) hasMissed = true;
                }
            });

            // LOGIC TREE
            if (totalAct > 0 && totalPlan === 0) {
                // 1. Unplanned Bonus (Green + Stripes)
                colorClass = 'bg-emerald-500';
                inlineStyle = stripeStyle;
                tooltip = `${dateKey}: Unplanned Workout (Bonus)`;
            } 
            else if (hasMissed) {
                // 2. Missed
                colorClass = 'bg-red-500/80';
                tooltip = `${dateKey}: Missed Workout`;
            } 
            else if (hasCompleted) {
                // 3. Completed (Check adherence)
                const ratio = totalPlan > 0 ? (totalAct / totalPlan) : 1;
                if (ratio < 0.95) {
                    colorClass = 'bg-yellow-500'; // Partial
                    tooltip = `${dateKey}: Partial Completion`;
                } else {
                    colorClass = 'bg-emerald-500'; // Perfect
                    tooltip = `${dateKey}: Completed`;
                }
            } 
            else if (totalPlan > 0 && currentDate >= today) {
                // 4. Future Planned
                colorClass = 'bg-slate-700';
                tooltip = `${dateKey}: Planned`;
            }
        } else {
            // No Data Exists (Implicit Rest)
            // If actualDuration > 0 somehow without data (impossible logically here, but safe to default)
            // Default colorClass 'bg-slate-800' handles the Grey.
        }

        // Render Cell
        // We use style="${inlineStyle}" to apply stripes only when needed
        cellsHtml += `<div class="w-2.5 h-2.5 rounded-sm ${colorClass} m-[1px]" style="${inlineStyle}" title="${tooltip}"></div>`;
        
        // Advance Day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mt-8">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <i class="fa-solid fa-calendar-check text-slate-400"></i> Consistency Heatmap (${currentYear})
            </h3>
            
            <div class="overflow-x-auto pb-2">
                <div class="grid grid-rows-7 grid-flow-col gap-0 w-max">
                    ${cellsHtml}
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-4 mt-4 text-[10px] text-slate-400 font-mono">
                <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-slate-800"></div> Rest / Empty</div>
                <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div> Done</div>
                <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-emerald-500" style="${stripeStyle}"></div> Unplanned</div>
                <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-yellow-500"></div> Partial</div>
                <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-red-500/80"></div> Missed</div>
                <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-slate-700"></div> Future Plan</div>
            </div>
        </div>
    `;
}

// ... (Previous buildProgressWidget function remains exactly the same below) ...
function buildProgressWidget(workouts) {
    const today = new Date();
    today.setHours(23, 59, 59, 999); 

    // 1. Initialize Data Structures
    let totalPlanned = 0;
    let totalActual = 0;
    let expectedSoFar = 0;
    const totalDailyMarkers = {};

    const sportStats = {
        Bike: { planned: 0, actual: 0, dailyMarkers: {} },
        Run: { planned: 0, actual: 0, dailyMarkers: {} },
        Swim: { planned: 0, actual: 0, dailyMarkers: {} }
    };

    // 2. Aggregate Data
    workouts.forEach(w => {
        const plan = w.plannedDuration || 0;
        const act = w.actualDuration || 0;
        const dateKey = w.date.toISOString().split('T')[0];

        // Grand Totals
        totalPlanned += plan;
        totalActual += act;
        if (w.date <= today) expectedSoFar += plan;
        if (!totalDailyMarkers[dateKey]) totalDailyMarkers[dateKey] = 0;
        totalDailyMarkers[dateKey] += plan;

        // Sport Totals
        if (sportStats[w.type]) {
            sportStats[w.type].planned += plan;
            sportStats[w.type].actual += act;
            if (!sportStats[w.type].dailyMarkers[dateKey]) sportStats[w.type].dailyMarkers[dateKey] = 0;
            sportStats[w.type].dailyMarkers[dateKey] += plan;
        }
    });

    // --- Helper to generate a single bar's HTML ---
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

    // 3. Generate Pacing Data
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