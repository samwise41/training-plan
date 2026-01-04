// Removed unused Parser import to prevent load errors

let logData = [];

// Helper functions
const getIconForType = (type) => {
    if (type === 'Bike') return '<i class="fa-solid fa-bicycle text-blue-500 text-xl"></i>';
    if (type === 'Run') return '<i class="fa-solid fa-person-running text-emerald-500 text-xl"></i>';
    if (type === 'Swim') return '<i class="fa-solid fa-person-swimming text-cyan-500 text-xl"></i>';
    return '<i class="fa-solid fa-chart-line text-purple-500 text-xl"></i>';
};

// --- Concentric Donut Chart (30d vs 60d) ---
const buildConcentricChart = (stats30, stats60, centerLabel = "Trend") => {
    const r1 = 15.9155;
    const c1 = 100;
    const dash1 = `${stats30.pct} ${100 - stats30.pct}`;
    const color1 = stats30.pct >= 80 ? '#22c55e' : (stats30.pct >= 50 ? '#eab308' : '#ef4444');

    const r2 = 10; 
    const c2 = 2 * Math.PI * r2; 
    const val2 = (stats60.pct / 100) * c2;
    const dash2 = `${val2} ${c2 - val2}`;
    const color2 = stats60.pct >= 80 ? '#15803d' : (stats60.pct >= 50 ? '#a16207' : '#b91c1c'); 

    return `
        <div class="flex flex-col items-center justify-center w-full py-2">
            <div class="relative w-[120px] h-[120px] mb-2">
                <svg width="100%" height="100%" viewBox="0 0 42 42" class="donut-svg">
                    <circle cx="21" cy="21" r="${r1}" fill="none" stroke="#1e293b" stroke-width="3"></circle>
                    <circle cx="21" cy="21" r="${r2}" fill="none" stroke="#1e293b" stroke-width="3"></circle>
                    <circle cx="21" cy="21" r="${r1}" fill="none" stroke="${color1}" stroke-width="3" stroke-dasharray="${dash1}" stroke-dashoffset="25" stroke-linecap="round"></circle>
                    <circle cx="21" cy="21" r="${r2}" fill="none" stroke="${color2}" stroke-width="3" stroke-dasharray="${dash2}" stroke-dashoffset="${c2 * 0.25}" stroke-linecap="round"></circle>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">${centerLabel}</span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] w-full max-w-[160px]">
                <div class="text-right font-bold text-slate-400 flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color1}"></span> 30d</div>
                <div class="font-mono text-white flex items-center gap-1 truncate">${stats30.pct}% <span class="text-slate-500 opacity-70">(${stats30.label})</span></div>
                <div class="text-right font-bold text-slate-500 flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color2}"></span> 60d</div>
                <div class="font-mono text-slate-300 flex items-center gap-1 truncate">${stats60.pct}% <span class="text-slate-600 opacity-70">(${stats60.label})</span></div>
            </div>
        </div>
    `;
};

// --- FTP Progress Line Chart ---
const buildFTPChart = () => {
    const md = window.App?.planMd || "";
    if (!md) return '<div class="p-4 text-slate-500 italic">Plan data not loaded</div>';
    const lines = md.split('\n');
    const dataPoints = [];
    let startFound = false;

    for (let line of lines) {
        if (line.includes('### Historical FTP Log')) { startFound = true; continue; }
        if (startFound) {
            if (line.trim().startsWith('#') && dataPoints.length > 0) break; 
            if (line.includes('|') && !line.includes('---') && !line.toLowerCase().includes('date')) {
                const parts = line.split('|');
                if (parts.length > 2) {
                    const dateStr = parts[1].trim();
                    const ftpStr = parts[2].trim();
                    const date = new Date(dateStr);
                    const ftp = parseInt(ftpStr.replace(/\D/g, ''));
                    if (!isNaN(date.getTime()) && !isNaN(ftp)) dataPoints.push({ date, ftp, label: dateStr });
                }
            }
        }
    }

    dataPoints.sort((a, b) => a.date - b.date);
    if (dataPoints.length < 2) return ''; 

    const width = 800;
    const height = 250;
    const padding = { top: 30, bottom: 40, left: 50, right: 30 };
    const minFTP = Math.min(...dataPoints.map(d => d.ftp)) * 0.95;
    const maxFTP = Math.max(...dataPoints.map(d => d.ftp)) * 1.05;
    const minTime = dataPoints[0].date.getTime();
    const maxTime = dataPoints[dataPoints.length - 1].date.getTime();

    const getX = (d) => padding.left + ((d.date.getTime() - minTime) / (maxTime - minTime)) * (width - padding.left - padding.right);
    const getY = (d) => height - padding.bottom - ((d.ftp - minFTP) / (maxFTP - minFTP)) * (height - padding.top - padding.bottom);

    let pathD = `M ${getX(dataPoints[0])} ${getY(dataPoints[0])}`;
    let pointsHTML = '';
    dataPoints.forEach(d => {
        const x = getX(d);
        const y = getY(d);
        pathD += ` L ${x} ${y}`;
        pointsHTML += `
            <circle cx="${x}" cy="${y}" r="4" fill="#1e293b" stroke="#3b82f6" stroke-width="2"><title>${d.label}: ${d.ftp}W</title></circle>
            <text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" fill="#94a3b8" font-weight="bold">${d.ftp}</text>
            <text x="${x}" y="${height - 15}" text-anchor="middle" font-size="10" fill="#64748b">${d.date.getMonth()+1}/${d.date.getFullYear() % 100}</text>
        `;
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-12">
            <h2 class="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-2 flex items-center gap-2">
                <i class="fa-solid fa-arrow-trend-up text-emerald-500"></i> FTP Progression
            </h2>
            <div class="w-full">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">
                    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" />
                    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" />
                    <path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    ${pointsHTML}
                </svg>
            </div>
        </div>
    `;
};

// --- Helper to Get Buckets for Charts ---
const getVolumeBuckets = (data) => {
    const buckets = [];
    const numWeeks = 10;
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
    const currentMonday = new Date(now.setDate(diff));
    currentMonday.setHours(0,0,0,0);

    for (let i = numWeeks - 1; i >= 0; i--) {
        const d = new Date(currentMonday);
        d.setDate(d.getDate() - (i * 7));
        const e = new Date(d);
        e.setDate(e.getDate() + 6);
        e.setHours(23,59,59,999);
        
        const label = `${d.getMonth()+1}/${d.getDate()}`;
        buckets.push({ start: d, end: e, label, total: 0, bike: 0, run: 0, swim: 0, other: 0 });
    }

    data.forEach(item => {
        if (!item.date || !item.actualDuration || item.type !== item.actualType) return;
        const t = item.date.getTime();
        const bucket = buckets.find(b => t >= b.start.getTime() && t <= b.end.getTime());
        if (bucket) {
            bucket.total += item.actualDuration;
            if (item.type === 'Bike') bucket.bike += item.actualDuration;
            else if (item.type === 'Run') bucket.run += item.actualDuration;
            else if (item.type === 'Swim') bucket.swim += item.actualDuration;
            else bucket.other += item.actualDuration;
        }
    });
    return buckets;
}

// --- Chart 1: Stacked Total Volume ---
const buildStackedVolumeChart = (data) => {
    try {
        if (!data || data.length === 0) return '';
        const buckets = getVolumeBuckets(data);

        const width = 800;
        const height = 300;
        const pad = { t: 40, b: 50, l: 50, r: 20 };
        const maxVol = Math.max(...buckets.map(b => b.total)) || 100;
        const maxVolHours = Math.ceil(maxVol / 60);
        
        const getX = (i) => pad.l + (i * ((width - pad.l - pad.r) / buckets.length));
        const getY = (mins) => height - pad.b - ((mins / (maxVolHours * 60)) * (height - pad.t - pad.b));

        let yAxisHtml = '';
        for (let i = 0; i <= maxVolHours; i+=2) {
            const y = getY(i * 60);
            yAxisHtml += `<line x1="${pad.l - 5}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="#334155" stroke-width="1" opacity="0.3" /><text x="${pad.l - 10}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="11" font-family="monospace">${i}h</text>`;
        }

        let barsHtml = buckets.map((b, i) => {
            const x = getX(i);
            const barWidth = 40;
            const hTotal = (height - pad.b) - getY(b.total);
            const yBase = height - pad.b;

            const hSwim = (b.swim / b.total) * hTotal || 0;
            const hRun = (b.run / b.total) * hTotal || 0;
            const hBike = (b.bike / b.total) * hTotal || 0;
            const hOther = (b.other / b.total) * hTotal || 0;

            const ySwim = yBase - hSwim;
            const yRun = ySwim - hRun;
            const yBike = yRun - hBike;
            const yOther = yBike - hOther; 

            const totalHours = (b.total / 60).toFixed(1);
            const labelHtml = b.total > 0 ? `<text x="${x}" y="${(b.other > 0 ? yOther : yBike) - 5}" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${totalHours}h</text>` : '';

            return `<g class="hover:opacity-80 transition-opacity">
                    <rect x="${x - barWidth/2}" y="${ySwim}" width="${barWidth}" height="${hSwim}" fill="#06b6d4" />
                    <rect x="${x - barWidth/2}" y="${yRun}" width="${barWidth}" height="${hRun}" fill="#10b981" />
                    <rect x="${x - barWidth/2}" y="${yBike}" width="${barWidth}" height="${hBike}" fill="#3b82f6" />
                    <rect x="${x - barWidth/2}" y="${yOther}" width="${barWidth}" height="${hOther}" fill="#a855f7" />
                    ${labelHtml}
                    <text x="${x}" y="${height - 15}" text-anchor="middle" fill="#94a3b8" font-size="10">${b.label}</text>
                </g>`;
        }).join('');

        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-8">
                <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2"><i class="fa-solid fa-chart-column text-blue-500"></i> Weekly Volume (All Sports)</h2>
                    <div class="flex gap-3 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-blue-500"></span> Bike</span>
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-emerald-500"></span> Run</span>
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-cyan-500"></span> Swim</span>
                    </div>
                </div>
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">${yAxisHtml}${barsHtml}</svg>
            </div>
        `;
    } catch (e) { return `<div class="p-4 text-red-400">Chart Error: ${e.message}</div>`; }
};

// --- Chart 2: Individual Sport Chart (Small) ---
const buildSportChart = (data, sport, color, icon) => {
    const buckets = getVolumeBuckets(data);
    const key = sport.toLowerCase();
    
    // Calculate Max for this specific sport
    const maxVal = Math.max(...buckets.map(b => b[key])) || 60;
    const maxValHours = Math.ceil(maxVal / 60);

    const width = 400; // Smaller width for grid
    const height = 200;
    const pad = { t: 30, b: 30, l: 35, r: 10 };
    
    const getX = (i) => pad.l + (i * ((width - pad.l - pad.r) / buckets.length));
    const getY = (mins) => height - pad.b - ((mins / (maxValHours * 60)) * (height - pad.t - pad.b));

    let yAxisHtml = '';
    for (let i = 0; i <= maxValHours; i++) {
        const y = getY(i * 60);
        yAxisHtml += `<line x1="${pad.l}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="#334155" stroke-width="1" opacity="0.3" /><text x="${pad.l - 5}" y="${y + 3}" text-anchor="end" fill="#94a3b8" font-size="9" font-family="monospace">${i}h</text>`;
    }

    let barsHtml = buckets.map((b, i) => {
        const val = b[key];
        const x = getX(i);
        const y = getY(val);
        const h = (height - pad.b) - y;
        const barWidth = 20;
        
        return `<rect x="${x - barWidth/2}" y="${y}" width="${barWidth}" height="${h}" fill="${color}" opacity="0.9" rx="2" />
                <text x="${x}" y="${height - 10}" text-anchor="middle" fill="#64748b" font-size="8">${b.label}</text>`;
    }).join('');

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-4">
                <i class="fa-solid ${icon} text-slate-400"></i>
                <span class="text-xs font-bold text-slate-300 uppercase tracking-widest">${sport} Volume</span>
            </div>
            <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">${yAxisHtml}${barsHtml}</svg>
        </div>
    `;
};

// Main Render Function
export function renderKPI(mergedLogData) {
    logData = Array.isArray(mergedLogData) ? mergedLogData : [];

    const calculateStats = (targetType, days, isDuration) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        const subset = logData.filter(item => {
            if (!item || !item.date) return false;
            return item.date >= cutoff && item.date <= now && (targetType === 'All' || item.type === targetType);
        });

        let val = 0, target = 0;
        subset.forEach(item => {
            if (isDuration) {
                target += (item.plannedDuration || 0);
                if (item.type === item.actualType) val += (item.actualDuration || 0);
            } else {
                target++;
                if (item.completed) val++;
            }
        });

        const pct = target > 0 ? Math.round((val / target) * 100) : 0;
        const label = isDuration 
            ? `${val > 120 ? (val/60).toFixed(1)+'h' : val+'m'}/${target > 120 ? (target/60).toFixed(1)+'h' : target+'m'}`
            : `${val}/${target}`;
            
        return { pct, label };
    };

    const buildCombinedCard = (title, type) => {
        const count30 = calculateStats(type, 30, false);
        const count60 = calculateStats(type, 60, false);
        const dur30 = calculateStats(type, 30, true);
        const dur60 = calculateStats(type, 60, true);

        return `
            <div class="kpi-card">
                <div class="kpi-header mb-2">${getIconForType(type)}<span class="kpi-title">${title}</span></div>
                <div class="flex justify-around items-start">
                    <div class="w-1/2 border-r border-slate-700 pr-2">${buildConcentricChart(count30, count60, "Count")}</div>
                    <div class="w-1/2 pl-2">${buildConcentricChart(dur30, dur60, "Time")}</div>
                </div>
            </div>`;
    };

    const html = `
        ${buildStackedVolumeChart(logData)}

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            ${buildSportChart(logData, 'Bike', '#3b82f6', 'fa-bicycle')}
            ${buildSportChart(logData, 'Run', '#10b981', 'fa-person-running')}
            ${buildSportChart(logData, 'Swim', '#06b6d4', 'fa-person-swimming')}
        </div>

        ${buildFTPChart()}

        <h2 class="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-2">Adherence Overview</h2>
        <div class="kpi-grid mb-12">
            ${buildCombinedCard("All Activities", "All")}
            ${buildCombinedCard("Cycling", "Bike")}
            ${buildCombinedCard("Running", "Run")}
            ${buildCombinedCard("Swimming", "Swim")}
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
        <div class="mt-8 text-center text-xs text-slate-500 italic">* 'h' in duration column denotes hours, otherwise minutes assumed.</div>
    `;
    return { html, logData };
}

export function updateDurationAnalysis(data) {
    const sportSelect = document.getElementById('kpi-sport-select');
    const daySelect = document.getElementById('kpi-day-select');
    const timeSelect = document.getElementById('kpi-time-select');
    
    if (!sportSelect || !daySelect || !timeSelect) return;
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
    const debugTableBody = document.querySelector('#kpi-debug-table tbody');
    let debugRows = '';

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
