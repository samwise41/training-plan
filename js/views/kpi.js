// Removed unused Parser import to prevent load errors
// console.log("KPI Module Loaded"); // Debug check

let logData = [];

// Helper functions
const getIconForType = (type) => {
    if (type === 'Bike') return '<i class="fa-solid fa-bicycle text-blue-500 text-xl"></i>';
    if (type === 'Run') return '<i class="fa-solid fa-person-running text-emerald-500 text-xl"></i>';
    if (type === 'Swim') return '<i class="fa-solid fa-person-swimming text-cyan-500 text-xl"></i>';
    return '<i class="fa-solid fa-chart-line text-purple-500 text-xl"></i>';
};

const buildDonut = (percent, label, fraction) => {
    const radius = 15.9155;
    const circumference = 2 * Math.PI * radius; 
    const strokeDasharray = `${percent} ${100 - percent}`;
    const color = percent >= 80 ? '#22c55e' : (percent >= 50 ? '#eab308' : '#ef4444');

    return `
        <div class="chart-container">
            <svg width="120" height="120" viewBox="0 0 42 42" class="donut-svg">
                <circle class="donut-bg" cx="21" cy="21" r="${radius}"></circle>
                <circle class="donut-segment" cx="21" cy="21" r="${radius}" 
                        stroke="${color}" stroke-dasharray="${strokeDasharray}" stroke-dashoffset="25"></circle>
            </svg>
            <div class="donut-text">
                <span class="donut-percent">${percent}%</span>
                <span class="donut-fraction">${fraction}</span>
            </div>
            <div class="chart-label">${label}</div>
        </div>
    `;
};

// --- NEW: Weekly Volume Chart Helper ---
const buildWeeklyVolumeChart = (data) => {
    try {
        if (!data || data.length === 0) return '<div class="p-4 text-slate-500 italic">No data available for volume chart</div>';

        // 1. Setup 8-Week Buckets (Mon-Sun)
        const buckets = [];
        const now = new Date();
        // Adjust to Monday of current week
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
        const currentMonday = new Date(now.setDate(diff));
        currentMonday.setHours(0,0,0,0);

        for (let i = 7; i >= 0; i--) {
            const d = new Date(currentMonday);
            d.setDate(d.getDate() - (i * 7));
            const e = new Date(d);
            e.setDate(e.getDate() + 6);
            e.setHours(23,59,59,999);
            
            buckets.push({
                start: d,
                end: e,
                label: `${d.getMonth()+1}/${d.getDate()}`,
                mins: 0
            });
        }

        // 2. Aggregate Data
        data.forEach(item => {
            if (!item.date || !item.actualDuration) return;
            const t = item.date.getTime();
            const bucket = buckets.find(b => t >= b.start.getTime() && t <= b.end.getTime());
            if (bucket) bucket.mins += item.actualDuration;
        });

        // 3. Calculate Scaling & Max
        const maxVol = Math.max(...buckets.map(b => b.mins)) || 1; // Avoid div by 0
        
        // 4. Build Bars HTML
        let barsHtml = '';
        let prevMins = 0;

        buckets.forEach((b, idx) => {
            const height = Math.round((b.mins / maxVol) * 100);
            
            // 10% Rule Logic
            let barColor = 'bg-blue-500'; // Default
            if (idx > 0 && prevMins > 0) {
                const pctChange = (b.mins - prevMins) / prevMins;
                if (pctChange > 0.15) barColor = 'bg-red-500'; // >15% Spike Warning
                else if (pctChange > 0.10) barColor = 'bg-yellow-500'; // >10% Caution
                else if (pctChange < -0.20) barColor = 'bg-slate-600'; // Big drop (Deload?)
                else barColor = 'bg-emerald-500'; // Safe Increase or steady
            }
            
            prevMins = b.mins;

            barsHtml += `
                <div class="flex flex-col items-center gap-2 flex-1 group">
                    <div class="relative w-full bg-slate-800/50 rounded-t-sm h-48 flex items-end justify-center overflow-hidden">
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-xs px-2 py-1 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                            ${Math.round(b.mins)} mins
                        </div>
                        <div style="height: ${height}%;" class="w-full mx-1 ${barColor} opacity-80 hover:opacity-100 transition-all rounded-t-sm"></div>
                    </div>
                    <span class="text-[10px] text-slate-500 font-mono">${b.label}</span>
                </div>
            `;
        });

        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-12">
                <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-chart-column text-blue-500"></i> Weekly Volume Trend
                    </h2>
                    <div class="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Safe</span>
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-yellow-500"></span> Caution (>10%)</span>
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span> Spike (>15%)</span>
                    </div>
                </div>
                <div class="flex items-end justify-between gap-2 w-full">
                    ${barsHtml}
                </div>
            </div>
        `;
    } catch (e) {
        console.error("Error building weekly chart", e);
        return `<div class="p-4 text-red-400 border border-red-500 rounded">Chart Error: ${e.message}</div>`;
    }
};


// MODIFIED: Now accepts 'data' array directly, not markdown string
export function renderKPI(mergedLogData) {
    // Safety check for data
    logData = Array.isArray(mergedLogData) ? mergedLogData : [];

    const calculateCountStats = (targetType, days) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        const subset = logData.filter(item => {
            if (!item || !item.date) return false;
            const dateOk = item.date >= cutoff && item.date <= now;
            const typeOk = targetType === 'All' || item.type === targetType;
            return dateOk && typeOk;
        });

        const planned = subset.length; 
        const completed = subset.filter(item => item.completed).length; 
        const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;
        
        return { planned, completed, pct, label: `${completed}/${planned}` };
    };

    const calculateDurationStats = (targetType, days) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        const subset = logData.filter(item => {
            if (!item || !item.date) return false;
            const dateOk = item.date >= cutoff && item.date <= now;
            const typeOk = targetType === 'All' || item.type === targetType;
            return dateOk && typeOk;
        });

        let totalPlannedMins = 0;
        let totalActualMins = 0;

        subset.forEach(item => {
            totalPlannedMins += (item.plannedDuration || 0);
            if (item.type === item.actualType) {
                totalActualMins += (item.actualDuration || 0);
            }
        });

        const pct = totalPlannedMins > 0 ? Math.round((totalActualMins / totalPlannedMins) * 100) : 0;
        const formatTime = (m) => m > 120 ? `${(m/60).toFixed(1)}h` : `${m}m`;

        return { 
            pct, 
            label: `${formatTime(totalActualMins)}/${formatTime(totalPlannedMins)}` 
        };
    };

    const buildMetricRow = (title, type, isDuration = false) => {
        const stats30 = isDuration ? calculateDurationStats(type, 30) : calculateCountStats(type, 30);
        const stats60 = isDuration ? calculateDurationStats(type, 60) : calculateCountStats(type, 60);

        return `
            <div class="kpi-card">
                <div class="kpi-header">
                    ${getIconForType(type)}
                    <span class="kpi-title">${title}</span>
                </div>
                <div class="charts-row">
                    ${buildDonut(stats30.pct, "Last 30 Days", stats30.label)}
                    ${buildDonut(stats60.pct, "Last 60 Days", stats60.label)}
                </div>
            </div>
        `;
    };

    const html = `
        ${buildWeeklyVolumeChart(logData)}

        <h2 class="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-2">Workout Completion (Count)</h2>
        <div class="kpi-grid mb-12">
            ${buildMetricRow("All Workouts", "All")}
            ${buildMetricRow("Cycling", "Bike")}
            ${buildMetricRow("Running", "Run")}
            ${buildMetricRow("Swimming", "Swim")}
        </div>

        <h2 class="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-2">Duration Adherence (Time vs Plan)</h2>
        <div class="kpi-grid mb-12">
            ${buildMetricRow("All Duration", "All", true)}
            ${buildMetricRow("Cycling Time", "Bike", true)}
            ${buildMetricRow("Running Time", "Run", true)}
            ${buildMetricRow("Swim Time", "Swim", true)}
        </div>

        <div class="kpi-card bg-slate-800/20 border-t-4 border-t-purple-500">
            <div class="kpi-header border-b border-slate-700 pb-2 mb-4">
                <i class="fa-solid fa-filter text-purple-500 text-xl"></i>
                <span class="kpi-title ml-2 text-purple-400">Duration Analysis Tool</span>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-4 mb-8">
                <div class="flex-1">
                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Sport Filter</label>
                    <select id="kpi-sport-select" onchange="window.App.updateDurationAnalysis()" class="gear-select">
                        <option value="All">All Sports</option>
                        <option value="Bike">Bike</option>
                        <option value="Run">Run</option>
                        <option value="Swim">Swim</option>
                    </select>
                </div>
                <div class="flex-1">
                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Day Filter</label>
                    <select id="kpi-day-select" onchange="window.App.updateDurationAnalysis()" class="gear-select">
                        <option value="All">All Days</option>
                        <option value="Weekday">Weekday (Mon-Fri)</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                    </select>
                </div>
                <div class="flex-1">
                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Time Period</label>
                    <select id="kpi-time-select" onchange="window.App.updateDurationAnalysis()" class="gear-select">
                        <option value="All">All Time</option>
                        <option value="30">Last 30 Days</option>
                        <option value="60">Last 60 Days</option>
                        <option value="90">Last 90 Days</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm">
                    <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Planned</div>
                    <div id="kpi-analysis-planned" class="text-xl font-bold text-white">--</div>
                </div>
                <div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm">
                    <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Actual</div>
                    <div id="kpi-analysis-actual" class="text-xl font-bold text-white">--</div>
                </div>
                <div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm">
                    <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Difference</div>
                    <div id="kpi-analysis-diff" class="text-xl font-bold text-white">--</div>
                </div>
                <div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm">
                    <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Adherence</div>
                    <div id="kpi-analysis-pct" class="text-xl font-bold text-white">--</div>
                </div>
            </div>

            <div class="border-t border-slate-700 pt-4">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Detailed Log (Matches Filters)</h4>
                <div class="overflow-x-auto max-h-60 overflow-y-auto border border-slate-700 rounded-lg">
                    <table id="kpi-debug-table" class="w-full text-left text-sm text-slate-300">
                        <thead class="bg-slate-900 sticky top-0">
                            <tr>
                                <th class="py-2 px-2 text-xs font-bold uppercase text-slate-500">Date</th>
                                <th class="py-2 px-2 text-xs font-bold uppercase text-slate-500">Day</th>
                                <th class="py-2 px-2 text-xs font-bold uppercase text-slate-500">Type</th>
                                <th class="py-2 px-2 text-xs font-bold uppercase text-slate-500 text-center">Plan</th>
                                <th class="py-2 px-2 text-xs font-bold uppercase text-slate-500 text-center">Act</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="mt-8 text-center text-xs text-slate-500 italic">
            * Duration Stats only count actual time if the performed activity type matches the planned activity type.
            * 'h' in duration column denotes hours, otherwise minutes assumed.
        </div>
    `;
    
    return { html, logData };
}

export function updateDurationAnalysis(data) {
    const sportSelect = document.getElementById('kpi-sport-select');
    const daySelect = document.getElementById('kpi-day-select');
    const timeSelect = document.getElementById('kpi-time-select');
    
    if (!sportSelect || !daySelect || !timeSelect || !logData) return;

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
    const debugTableBody = document.querySelector('#kpi-debug-table tbody');
    let debugRows = '';

    // Use global logData if 'data' arg is missing (event listener call)
    const dataToUse = (Array.isArray(data) && data.length > 0) ? data : logData;

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
        let thisActual = 0;
        let actualClass = "text-slate-300";
        
        if (item.type === item.actualType) {
            thisActual = (item.actualDuration || 0);
            totalActual += thisActual;
        } else if (item.plannedDuration > 0) {
             actualClass = "text-red-400 font-bold";
        }

        debugRows += `
            <tr class="border-b border-slate-700 hover:bg-slate-800/50">
                <td class="py-2 px-2 text-xs font-mono text-slate-400">${item.date.toISOString().split('T')[0]}</td>
                <td class="py-2 px-2 text-xs text-slate-300">${itemDayName}</td>
                <td class="py-2 px-2 text-xs text-slate-300">${item.type}</td>
                <td class="py-2 px-2 text-xs text-slate-300 text-center">${item.plannedDuration}m</td>
                <td class="py-2 px-2 text-xs ${actualClass} text-center">${thisActual}m</td>
            </tr>`;
    });

    if (debugTableBody) debugTableBody.innerHTML = debugRows || '<tr><td colspan="5" class="text-center py-4 text-slate-500 italic">No matching records found</td></tr>';

    const diff = totalActual - totalPlanned;
    const pct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
    
    const formatTime = (minutes) => {
        const m = Math.abs(minutes); 
        if (m === 0) return "0m";
        const h = Math.floor(m / 60);
        const rem = m % 60;
        if (h > 0) return `${h}h ${rem}m`;
        return `${rem}m`;
    };

    if (document.getElementById('kpi-analysis-planned')) {
        document.getElementById('kpi-analysis-planned').innerText = formatTime(totalPlanned);
        document.getElementById('kpi-analysis-actual').innerText = formatTime(totalActual);
        
        const diffEl = document.getElementById('kpi-analysis-diff');
        const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
        diffEl.innerText = sign + formatTime(diff);
        diffEl.className = `text-xl font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`;

        const pctEl = document.getElementById('kpi-analysis-pct');
        pctEl.innerText = `${pct}%`;
        pctEl.className = `text-xl font-bold ${pct >= 80 ? 'text-emerald-400' : (pct >= 50 ? 'text-yellow-400' : 'text-red-400')}`;
    }
}
