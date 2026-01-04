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
    // Outer Ring (30 Days) - Standard Size
    const r1 = 15.9155;
    const c1 = 100;
    const dash1 = `${stats30.pct} ${100 - stats30.pct}`;
    const color1 = stats30.pct >= 80 ? '#22c55e' : (stats30.pct >= 50 ? '#eab308' : '#ef4444');

    // Inner Ring (60 Days) - Smaller Size
    const r2 = 10; 
    const c2 = 2 * Math.PI * r2; // ~62.83
    const val2 = (stats60.pct / 100) * c2;
    const dash2 = `${val2} ${c2 - val2}`;
    const color2 = stats60.pct >= 80 ? '#15803d' : (stats60.pct >= 50 ? '#a16207' : '#b91c1c'); // Slightly darker for contrast

    return `
        <div class="flex flex-col items-center justify-center w-full py-2">
            <div class="relative w-[120px] h-[120px] mb-2">
                <svg width="100%" height="100%" viewBox="0 0 42 42" class="donut-svg">
                    <circle cx="21" cy="21" r="${r1}" fill="none" stroke="#1e293b" stroke-width="3"></circle>
                    <circle cx="21" cy="21" r="${r2}" fill="none" stroke="#1e293b" stroke-width="3"></circle>

                    <circle cx="21" cy="21" r="${r1}" fill="none" stroke="${color1}" stroke-width="3"
                            stroke-dasharray="${dash1}" stroke-dashoffset="25" stroke-linecap="round"></circle>

                    <circle cx="21" cy="21" r="${r2}" fill="none" stroke="${color2}" stroke-width="3"
                            stroke-dasharray="${dash2}" stroke-dashoffset="${c2 * 0.25}" stroke-linecap="round"></circle>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">${centerLabel}</span>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] w-full max-w-[160px]">
                <div class="text-right font-bold text-slate-400 flex items-center justify-end gap-1">
                    <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color1}"></span> 30d
                </div>
                <div class="font-mono text-white flex items-center gap-1 truncate">
                    ${stats30.pct}% <span class="text-slate-500 opacity-70">(${stats30.label})</span>
                </div>

                <div class="text-right font-bold text-slate-500 flex items-center justify-end gap-1">
                    <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color2}"></span> 60d
                </div>
                <div class="font-mono text-slate-300 flex items-center gap-1 truncate">
                    ${stats60.pct}% <span class="text-slate-600 opacity-70">(${stats60.label})</span>
                </div>
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
        if (line.includes('### Historical FTP Log')) {
            startFound = true;
            continue;
        }
        if (startFound) {
            if (line.trim().startsWith('#') && dataPoints.length > 0) break; 
            if (line.includes('|') && !line.includes('---') && !line.toLowerCase().includes('date')) {
                const parts = line.split('|');
                if (parts.length > 2) {
                    const dateStr = parts[1].trim();
                    const ftpStr = parts[2].trim();
                    const date = new Date(dateStr);
                    const ftp = parseInt(ftpStr.replace(/\D/g, ''));
                    
                    if (!isNaN(date.getTime()) && !isNaN(ftp)) {
                        dataPoints.push({ date, ftp, label: dateStr });
                    }
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
            <circle cx="${x}" cy="${y}" r="4" fill="#1e293b" stroke="#3b82f6" stroke-width="2">
                <title>${d.label}: ${d.ftp}W</title>
            </circle>
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

// --- Weekly Volume Chart Helper ---
const buildWeeklyVolumeChart = (data) => {
    try {
        if (!data || data.length === 0) return '<div class="p-4 text-slate-500 italic">No data available for volume chart</div>';
        
        // 1. Setup 8-Week Buckets (Mon-Sun)
        const buckets = [];
        const now = new Date();
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
            // Added 'plannedMins' to track plan data separately
            buckets.push({ start: d, end: e, label: `${d.getMonth()+1}/${d.getDate()}`, actualMins: 0, plannedMins: 0 });
        }

        // 2. Aggregate Data
        data.forEach(item => {
            if (!item.date) return;
            const t = item.date.getTime();
            const bucket = buckets.find(b => t >= b.start.getTime() && t <= b.end.getTime());
            if (bucket) {
                bucket.actualMins += (item.actualDuration || 0);
                bucket.plannedMins += (item.plannedDuration || 0);
            }
        });

        // 3. Render
        let barsHtml = '';
        let prevMins = 0; // Tracks 'Actual' of previous week for 10% rule

        // Find Max Volume (Actual OR Planned) to scale chart correctly
        const maxVol = Math.max(...buckets.map(b => Math.max(b.actualMins, b.plannedMins))) || 1;

        buckets.forEach((b, idx) => {
            const isCurrentWeek = (idx === buckets.length - 1); // Last bucket is current week
            
            // Value to Display: Use Planned for Current Week, Actual for Past
            const val = isCurrentWeek ? b.plannedMins : b.actualMins;
            const height = Math.round((val / maxVol) * 100);
            
            // 10% Rule Logic
            let barColorClass = 'bg-blue-500'; 
            let barStyle = '';
            
            if (idx > 0 && prevMins > 0) {
                const pctChange = (val - prevMins) / prevMins;
                if (pctChange > 0.15) barColorClass = 'bg-red-500'; 
                else if (pctChange > 0.10) barColorClass = 'bg-yellow-500'; 
                else if (pctChange < -0.20) barColorClass = 'bg-slate-600'; 
                else barColorClass = 'bg-emerald-500'; 
            }

            // Apply "Planned" Styling for Current Week
            if (isCurrentWeek) {
                // Determine base color based on trend, then stripe it
                let baseColor = barColorClass.replace('bg-', '');
                // Tailwind doesn't have striped utility, so we inject a style
                // Map tailwind color names to hex roughly for the gradient
                const colorMap = {
                    'emerald-500': '#10b981', 'yellow-500': '#eab308', 
                    'red-500': '#ef4444', 'slate-600': '#475569', 'blue-500': '#3b82f6'
                };
                const hex = colorMap[baseColor] || '#3b82f6';
                
                barColorClass = ''; // Remove solid bg class
                barStyle = `background: repeating-linear-gradient(45deg, ${hex}, ${hex} 4px, #1e293b 4px, #1e293b 8px); border: 1px solid ${hex};`;
            }

            if (!isCurrentWeek) prevMins = b.actualMins; // Only update baseline from Actuals

            barsHtml += `
                <div class="flex flex-col items-center gap-2 flex-1 group">
                    <div class="relative w-full bg-slate-800/50 rounded-t-sm h-48 flex items-end justify-center overflow-hidden">
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-xs px-2 py-1 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                            ${isCurrentWeek ? 'Plan: ' : ''}${Math.round(val)}m
                        </div>
                        <div style="height: ${height}%; ${barStyle}" class="w-full mx-1 ${barColorClass} opacity-80 hover:opacity-100 transition-all rounded-t-sm"></div>
                    </div>
                    <span class="text-[10px] ${isCurrentWeek ? 'text-white font-bold' : 'text-slate-500'} font-mono text-center leading-none">
                        ${b.label}<br>
                        ${isCurrentWeek ? '<span class="text-[8px] text-blue-400">PLAN</span>' : ''}
                    </span>
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
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span> Spike</span>
                        <span class="flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full border border-blue-500" style="background: repeating-linear-gradient(45deg, #3b82f6, #3b82f6 2px, transparent 2px, transparent 4px)"></span> Planned
                        </span>
                    </div>
                </div>
                <div class="flex items-end justify-between gap-2 w-full">${barsHtml}</div>
            </div>
        `;
    } catch (e) {
        return `<div class="p-4 text-red-400">Chart Error: ${e.message}</div>`;
    }
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

    // New Function to Combine Both Charts into One Card
    const buildCombinedCard = (title, type) => {
        // Count Stats
        const count30 = calculateStats(type, 30, false);
        const count60 = calculateStats(type, 60, false);
        
        // Duration Stats
        const dur30 = calculateStats(type, 30, true);
        const dur60 = calculateStats(type, 60, true);

        return `
            <div class="kpi-card">
                <div class="kpi-header mb-2">${getIconForType(type)}<span class="kpi-title">${title}</span></div>
                <div class="flex justify-around items-start">
                    <div class="w-1/2 border-r border-slate-700 pr-2">
                        ${buildConcentricChart(count30, count60, "Count")}
                    </div>
                    <div class="w-1/2 pl-2">
                        ${buildConcentricChart(dur30, dur60, "Time")}
                    </div>
                </div>
            </div>
        `;
    };

    const html = `
        ${buildWeeklyVolumeChart(logData)}

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
