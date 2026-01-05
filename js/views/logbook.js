let logData = [];

// Helper
const getIconForType = (type) => {
    if (type === 'Bike') return '<i class="fa-solid fa-bicycle text-blue-500 text-xl"></i>';
    if (type === 'Run') return '<i class="fa-solid fa-person-running text-emerald-500 text-xl"></i>';
    if (type === 'Swim') return '<i class="fa-solid fa-person-swimming text-cyan-500 text-xl"></i>';
    return '<i class="fa-solid fa-chart-line text-purple-500 text-xl"></i>';
};

// Donut Chart Logic
const buildConcentricChart = (stats30, stats60, centerLabel = "Trend") => {
    const r1 = 15.9155; const c1 = 100;
    const dash1 = `${stats30.pct} ${100 - stats30.pct}`;
    const color1 = stats30.pct >= 80 ? '#22c55e' : (stats30.pct >= 50 ? '#eab308' : '#ef4444');
    const r2 = 10; const c2 = 2 * Math.PI * r2; 
    const val2 = (stats60.pct / 100) * c2;
    const dash2 = `${val2} ${c2 - val2}`;
    const color2 = stats60.pct >= 80 ? '#15803d' : (stats60.pct >= 50 ? '#a16207' : '#b91c1c'); 

    return `
        <div class="flex flex-col items-center justify-center w-full py-2">
            <div class="relative w-[100px] h-[100px] mb-2">
                <svg width="100%" height="100%" viewBox="0 0 42 42" class="donut-svg">
                    <circle cx="21" cy="21" r="${r1}" fill="none" stroke="#1e293b" stroke-width="3"></circle>
                    <circle cx="21" cy="21" r="${r2}" fill="none" stroke="#1e293b" stroke-width="3"></circle>
                    <circle cx="21" cy="21" r="${r1}" fill="none" stroke="${color1}" stroke-width="3" stroke-dasharray="${dash1}" stroke-dashoffset="25" stroke-linecap="round"></circle>
                    <circle cx="21" cy="21" r="${r2}" fill="none" stroke="${color2}" stroke-width="3" stroke-dasharray="${dash2}" stroke-dashoffset="${c2 * 0.25}" stroke-linecap="round"></circle>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none"><span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">${centerLabel}</span></div>
            </div>
            <div class="text-[9px] text-center w-full">
                <span class="text-slate-400">30d:</span> <span class="text-white font-mono">${stats30.pct}%</span> | 
                <span class="text-slate-400">60d:</span> <span class="text-slate-300 font-mono">${stats60.pct}%</span>
            </div>
        </div>`;
};

export function renderLogbook(mergedLogData) {
    logData = Array.isArray(mergedLogData) ? mergedLogData : [];

    const calculateStats = (targetType, days, isDuration) => {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
        const now = new Date(); now.setHours(23, 59, 59, 999);
        const subset = logData.filter(item => {
            if (!item || !item.date) return false;
            return item.date >= cutoff && item.date <= now && (targetType === 'All' || item.type === targetType);
        });
        let val = 0, target = 0;
        subset.forEach(item => {
            if (isDuration) { target += (item.plannedDuration || 0); if (item.type === item.actualType) val += (item.actualDuration || 0); }
            else { target++; if (item.completed) val++; }
        });
        const pct = target > 0 ? Math.round((val / target) * 100) : 0;
        const label = isDuration ? `${val}m/${target}m` : `${val}/${target}`;
        return { pct, label };
    };

    const buildCard = (title, type) => {
        const count30 = calculateStats(type, 30, false); const count60 = calculateStats(type, 60, false);
        const dur30 = calculateStats(type, 30, true); const dur60 = calculateStats(type, 60, true);
        return `<div class="bg-slate-800/30 border border-slate-700 p-4 rounded-xl">
                <div class="flex items-center gap-2 mb-2 border-b border-slate-700 pb-2">${getIconForType(type)}<span class="font-bold text-sm text-slate-300">${title}</span></div>
                <div class="flex justify-between items-center">
                    ${buildConcentricChart(count30, count60, "Freq")}
                    ${buildConcentricChart(dur30, dur60, "Time")}
                </div>
            </div>`;
    };

    // HISTORY TABLE LOGIC
    // Sort by date desc
    const sortedLog = [...logData].sort((a, b) => b.date - a.date);
    let historyRows = sortedLog.map(item => {
        const isMissed = item.plannedDuration > 0 && (!item.actualDuration || item.actualDuration === 0);
        const statusClass = item.completed ? "text-emerald-400" : (isMissed ? "text-red-400 font-bold" : "text-slate-400");
        return `
            <tr class="border-b border-slate-800 hover:bg-slate-800/50 text-xs">
                <td class="py-3 px-2 font-mono text-slate-400">${item.date.toISOString().split('T')[0]}</td>
                <td class="py-3 px-2 text-slate-300">${item.type}</td>
                <td class="py-3 px-2 text-slate-400 truncate max-w-[150px]">${item.activity || '-'}</td>
                <td class="py-3 px-2 text-center text-slate-400">${item.plannedDuration || 0}m</td>
                <td class="py-3 px-2 text-center ${statusClass}">${item.actualDuration || 0}m</td>
            </tr>
        `;
    }).join('');

    return `
        <h2 class="text-lg font-bold text-white mb-4">Adherence Overview</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            ${buildCard("All Activities", "All")}
            ${buildCard("Cycling", "Bike")}
            ${buildCard("Running", "Run")}
            ${buildCard("Swimming", "Swim")}
        </div>

        <div class="bg-slate-800/20 border-t-4 border-t-purple-500 rounded-xl p-6 mb-12">
            <div class="flex items-center gap-2 mb-6 border-b border-slate-700 pb-2">
                <i class="fa-solid fa-filter text-purple-500 text-xl"></i>
                <h3 class="text-lg font-bold text-purple-400">Duration Analysis Tool</h3>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-4 mb-6">
                <select id="kpi-sport-select" onchange="window.App.updateDurationAnalysis()" class="bg-slate-900 border border-slate-700 text-white text-xs rounded p-2 flex-1"><option value="All">All Sports</option><option value="Bike">Bike</option><option value="Run">Run</option><option value="Swim">Swim</option></select>
                <select id="kpi-day-select" onchange="window.App.updateDurationAnalysis()" class="bg-slate-900 border border-slate-700 text-white text-xs rounded p-2 flex-1"><option value="All">All Days</option><option value="Weekday">Weekday</option><option value="Monday">Monday</option><option value="Tuesday">Tuesday</option><option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option><option value="Friday">Friday</option><option value="Saturday">Saturday</option><option value="Sunday">Sunday</option></select>
                <select id="kpi-time-select" onchange="window.App.updateDurationAnalysis()" class="bg-slate-900 border border-slate-700 text-white text-xs rounded p-2 flex-1"><option value="All">All Time</option><option value="30">Last 30 Days</option><option value="60">Last 60 Days</option><option value="90">Last 90 Days</option></select>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-slate-900 p-3 rounded border border-slate-700 text-center"><div class="text-[10px] text-slate-500 uppercase font-bold">Planned</div><div id="kpi-analysis-planned" class="text-lg font-bold text-white">--</div></div>
                <div class="bg-slate-900 p-3 rounded border border-slate-700 text-center"><div class="text-[10px] text-slate-500 uppercase font-bold">Actual</div><div id="kpi-analysis-actual" class="text-lg font-bold text-white">--</div></div>
                <div class="bg-slate-900 p-3 rounded border border-slate-700 text-center"><div class="text-[10px] text-slate-500 uppercase font-bold">Diff</div><div id="kpi-analysis-diff" class="text-lg font-bold text-white">--</div></div>
                <div class="bg-slate-900 p-3 rounded border border-slate-700 text-center"><div class="text-[10px] text-slate-500 uppercase font-bold">Adherence</div><div id="kpi-analysis-pct" class="text-lg font-bold text-white">--</div></div>
            </div>
            
            <div class="text-[10px] text-center text-slate-500 italic">* Analysis applies to the filtered selection</div>
        </div>

        <h2 class="text-lg font-bold text-white mb-4">Full History Log</h2>
        <div class="overflow-x-auto bg-slate-800/30 border border-slate-700 rounded-lg max-h-96 overflow-y-auto">
            <table class="w-full text-left border-collapse">
                <thead class="bg-slate-900 sticky top-0 z-10">
                    <tr>
                        <th class="py-3 px-2 text-xs font-bold uppercase text-slate-500">Date</th>
                        <th class="py-3 px-2 text-xs font-bold uppercase text-slate-500">Type</th>
                        <th class="py-3 px-2 text-xs font-bold uppercase text-slate-500">Activity</th>
                        <th class="py-3 px-2 text-xs font-bold uppercase text-slate-500 text-center">Plan</th>
                        <th class="py-3 px-2 text-xs font-bold uppercase text-slate-500 text-center">Act</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">${historyRows}</tbody>
            </table>
        </div>
    `;
}

export function updateDurationAnalysis(data) {
    const sportSelect = document.getElementById('kpi-sport-select');
    const daySelect = document.getElementById('kpi-day-select');
    const timeSelect = document.getElementById('kpi-time-select');
    if (!sportSelect) return;
    
    const dataToUse = (Array.isArray(data) && data.length > 0) ? data : logData;
    const selectedSport = sportSelect.value;
    const selectedDay = daySelect.value;
    const selectedTime = timeSelect.value;

    let cutoffDate = null;
    if (selectedTime !== 'All') { 
        const days = parseInt(selectedTime); 
        cutoffDate = new Date(); 
        cutoffDate.setDate(cutoffDate.getDate() - days); 
        cutoffDate.setHours(0, 0, 0, 0); 
    }

    let totalPlanned = 0, totalActual = 0;
    const dayMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    dataToUse.forEach(item => {
        if (!item || !item.date) return;
        if (cutoffDate && item.date < cutoffDate) return;
        const itemDayName = dayMap[item.date.getDay()];
        if (selectedSport !== 'All' && item.type !== selectedSport) return;
        if (selectedDay !== 'All') {
            if (selectedDay === 'Weekday' && (item.date.getDay() === 0 || item.date.getDay() === 6)) return;
            if (selectedDay !== 'Weekday' && itemDayName !== selectedDay) return;
        }
        totalPlanned += (item.plannedDuration || 0);
        if (item.type === item.actualType) totalActual += (item.actualDuration || 0);
    });

    const diff = totalActual - totalPlanned;
    const pct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
    const formatTime = (minutes) => { const m = Math.abs(minutes); const h = Math.floor(m / 60); const rem = m % 60; return h > 0 ? `${h}h ${rem}m` : `${rem}m`; };

    if (document.getElementById('kpi-analysis-planned')) {
        document.getElementById('kpi-analysis-planned').innerText = formatTime(totalPlanned);
        document.getElementById('kpi-analysis-actual').innerText = formatTime(totalActual);
        const diffEl = document.getElementById('kpi-analysis-diff');
        diffEl.innerText = (diff > 0 ? '+' : (diff < 0 ? '-' : '')) + formatTime(diff);
        diffEl.className = `text-lg font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
        const pctEl = document.getElementById('kpi-analysis-pct');
        pctEl.innerText = `${pct}%`;
        pctEl.className = `text-lg font-bold ${pct >= 80 ? 'text-emerald-400' : (pct >= 50 ? 'text-yellow-400' : 'text-red-400')}`;
    }
}
