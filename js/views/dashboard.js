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
    
    // --- UPDATED EVENT PARSING ---
    const eventSection = Parser.getSection(planMd, "Event Schedule");
    const eventMap = {};
    if (eventSection) {
        // Look for markdown table rows: | Date | Event | ...
        const lines = eventSection.split('\n');
        lines.forEach(line => {
            // Regex to find YYYY-MM-DD
            if (line.includes('|') && !line.includes('---') && /\d{4}-\d{2}-\d{2}/.test(line)) {
                const parts = line.split('|').map(p => p.trim());
                // Assuming format: | Date | Event Name | ...
                // parts[0] is usually empty due to leading pipe
                // parts[1] is Date, parts[2] is Name
                if (parts.length > 2) {
                    const dateStr = parts[1]; 
                    const evtName = parts[2];
                    // Basic validation
                    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        eventMap[dateStr] = evtName;
                    }
                }
            }
        });
    }

    // 4. Generate Two Heatmaps
    // A. Trailing 6 Months
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Calculate End of Current Week (Upcoming Sunday)
    const endOfWeek = new Date(today);
    const dayOfWeek = endOfWeek.getDay(); // 0=Sun
    const distToSunday = 7 - (dayOfWeek === 0 ? 7 : dayOfWeek); 
    endOfWeek.setDate(endOfWeek.getDate() + distToSunday); 
    if (dayOfWeek === 0) endOfWeek.setDate(endOfWeek.getDate()); 
    
    // Start Date: 6 Months Prior
    const startTrailing = new Date(endOfWeek);
    startTrailing.setMonth(startTrailing.getMonth() - 6);

    // B. Calendar Year
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);

    const heatmapTrailingHtml = buildGenericHeatmap(fullLogData, eventMap, startTrailing, endOfWeek, "Recent Consistency (Trailing 6 Months)");
    const heatmapYearHtml = buildGenericHeatmap(fullLogData, eventMap, startYear, endYear, `Annual Overview (${today.getFullYear()})`);

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
        const key = w.date.toISOString().split('T')[0];
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