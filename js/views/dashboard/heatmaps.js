// --- NEW Internal Builder: Activity Heatmap (Sport Types) ---
function buildActivityHeatmap(fullLog, startDate, endDate, title, dateToKeyFn, containerId = null) {
    if (!fullLog) fullLog = [];

    // --- SPORT DETECTION LOGIC (STRICT) ---
    const detectSport = (item) => {
        const name = (item.activityName || item.actualName || '').toUpperCase();
        if (name.includes('[RUN]')) return 'Run';
        if (name.includes('[BIKE]')) return 'Bike';
        if (name.includes('[SWIM]')) return 'Swim';
        return 'Other';
    };
    
    // Map: Date -> { sports: Set(), totalAct: 0, details: [] }
    const activityMap = {};
    fullLog.forEach(item => {
        if (item.actualDuration > 0) {
            const key = dateToKeyFn(item.date);
            if (!activityMap[key]) activityMap[key] = { sports: new Set(), totalAct: 0, details: [] };
            
            const detected = detectSport(item);
            activityMap[key].sports.add(detected);
            activityMap[key].totalAct += item.actualDuration;

            // Collect details
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
    const today = new Date(); today.setHours(0,0,0,0);

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
                // Single sport
                style = `background-color: ${getSportColorVar(sports[0])};`;
                colorClass = ''; 
            } else if (sports.length > 1) {
                // Multi-sport Gradient
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
        }

        // --- FIX APPLIED HERE ---
        // Changed from: if (dayOfWeek === 0 && !hasActivity && currentDate > today)
        // To: if (dayOfWeek === 0 && !hasActivity)
        // This ensures empty Sundays are hidden for both past and future.
        if (dayOfWeek === 0 && !hasActivity) {
            style = 'opacity: 0;';
            colorClass = '';
        }

        const clickAttr = hasActivity ? 
            `onclick="window.showDashboardTooltip(event, '${dateKey}', 0, ${totalMinutes}, 'Completed', '#fff', 'Activity', '${detailStr}')"` : '';
        const cursorClass = hasActivity ? 'cursor-pointer hover:opacity-80' : '';

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
