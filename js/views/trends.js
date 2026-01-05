// Helper to build reusable charts (moved from old kpi.js) trends.js not needed anymore.
const renderVolumeChart = (data, sportType = 'All', title = 'Weekly Volume Trend') => {
    try {
        if (!data || data.length === 0) return '<div class="p-4 text-slate-500 italic">No data available</div>';
        
        // 1. Setup Buckets (Anchor to Upcoming Saturday)
        const buckets = [];
        const now = new Date();
        const day = now.getDay();
        const distToSat = 6 - day;
        const endOfCurrentWeek = new Date(now);
        endOfCurrentWeek.setDate(now.getDate() + distToSat);
        endOfCurrentWeek.setHours(23, 59, 59, 999);

        for (let i = 7; i >= 0; i--) {
            const end = new Date(endOfCurrentWeek);
            end.setDate(end.getDate() - (i * 7));
            const start = new Date(end);
            start.setDate(start.getDate() - 6);
            start.setHours(0,0,0,0);
            buckets.push({ start, end, label: `${end.getMonth()+1}/${end.getDate()}`, actualMins: 0, plannedMins: 0 });
        }

        // 2. Aggregate Data
        data.forEach(item => {
            if (!item.date) return;
            if (sportType !== 'All' && item.type !== sportType) return;
            const t = item.date.getTime();
            const bucket = buckets.find(b => t >= b.start.getTime() && t <= b.end.getTime());
            if (bucket) {
                bucket.actualMins += (item.actualDuration || 0);
                bucket.plannedMins += (item.plannedDuration || 0);
            }
        });

        // 3. Render Bars
        let barsHtml = '';
        const maxVol = Math.max(...buckets.map(b => Math.max(b.actualMins, b.plannedMins))) || 1;

        buckets.forEach((b, idx) => {
            const isCurrentWeek = (idx === buckets.length - 1); 
            const hActual = Math.round((b.actualMins / maxVol) * 100);
            const hPlan = Math.round((b.plannedMins / maxVol) * 100);
            
            const prevActual = idx > 0 ? buckets[idx - 1].actualMins : 0;
            let actualColorClass = 'bg-blue-500';
            let planColorClass = 'bg-blue-500';
            let growthLabel = "--";
            let growthColor = "text-slate-400";

            if (idx > 0 && prevActual > 0) {
                const actualGrowth = (b.actualMins - prevActual) / prevActual;
                const planGrowth = (b.plannedMins - prevActual) / prevActual;

                let limitRed = 0.15; let limitYellow = 0.10;
                if (sportType === 'Run') { limitRed = 0.10; limitYellow = 0.05; }
                else if (sportType === 'Bike' || sportType === 'Swim') { limitRed = 0.20; limitYellow = 0.15; }

                const getColor = (pct) => {
                    if (pct > limitRed) return 'bg-red-500';
                    if (pct > limitYellow) return 'bg-yellow-500';
                    if (pct < -0.20) return 'bg-slate-600'; 
                    return 'bg-emerald-500'; 
                };

                actualColorClass = getColor(actualGrowth);
                planColorClass = getColor(planGrowth);

                const displayGrowth = isCurrentWeek ? planGrowth : actualGrowth;
                const sign = displayGrowth > 0 ? '▲' : (displayGrowth < 0 ? '▼' : '');
                growthLabel = `${sign} ${Math.round(displayGrowth * 100)}%`;
                
                if (displayGrowth > limitRed) growthColor = "text-red-400";
                else if (displayGrowth > limitYellow) growthColor = "text-yellow-400";
                else if (displayGrowth < -0.20) growthColor = "text-slate-500";
                else growthColor = "text-emerald-400";
            }

            const colorMap = {'bg-emerald-500': '#10b981', 'bg-yellow-500': '#eab308', 'bg-red-500': '#ef4444', 'bg-slate-600': '#475569', 'bg-blue-500': '#3b82f6'};
            const planHex = colorMap[planColorClass] || '#3b82f6';
            const planBarStyle = `background: repeating-linear-gradient(45deg, ${planHex}20, ${planHex}20 4px, transparent 4px, transparent 8px); border: 1px solid ${planHex}40;`;
            const actualOpacity = isCurrentWeek ? 'opacity-90' : 'opacity-80';

            barsHtml += `
                <div class="flex flex-col items-center gap-1 flex-1 group relative">
                    <div class="relative w-full bg-slate-800/30 rounded-t-sm h-32 flex items-end justify-center">
                        <div class="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-xs font-bold text-white px-2 py-2 rounded border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap text-center pointer-events-none">
                            <div class="mb-1">Plan: ${Math.round(b.plannedMins)}m | Act: ${Math.round(b.actualMins)}m</div>
                            <div class="text-[10px] ${growthColor} border-t border-slate-700 pt-1">Growth: ${growthLabel}</div>
                        </div>
                        <div style="height: ${hPlan}%; ${planBarStyle}" class="absolute bottom-0 w-full rounded-t-sm z-0"></div>
                        <div style="height: ${hActual}%;" class="relative z-10 w-2/3 ${actualColorClass} ${actualOpacity} rounded-t-sm"></div>
                    </div>
                    <span class="text-[9px] text-slate-500 font-mono text-center leading-none">
                        ${b.label}
                        ${isCurrentWeek ? '<br><span class="text-[8px] text-blue-400">NEXT</span>' : ''}
                    </span>
                </div>
            `;
        });

        let iconHtml = '<i class="fa-solid fa-chart-column text-blue-500"></i>';
        if (sportType === 'Bike') iconHtml = '<i class="fa-solid fa-bicycle text-blue-500"></i>';
        if (sportType === 'Run') iconHtml = '<i class="fa-solid fa-person-running text-emerald-500"></i>';
        if (sportType === 'Swim') iconHtml = '<i class="fa-solid fa-person-swimming text-cyan-500"></i>';

        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-4">
                <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">${iconHtml} ${title}</h3>
                </div>
                <div class="flex items-end justify-between gap-1 w-full">${barsHtml}</div>
            </div>
        `;
    } catch (e) {
        return `<div class="p-4 text-red-400">Chart Error: ${e.message}</div>`;
    }
};

const buildFTPChart = () => {
    const md = window.App?.planMd || "";
    if (!md) return '';
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

    const width = 800, height = 250, padding = { top: 30, bottom: 40, left: 50, right: 30 };
    const minFTP = Math.min(...dataPoints.map(d => d.ftp)) * 0.95, maxFTP = Math.max(...dataPoints.map(d => d.ftp)) * 1.05;
    const minTime = dataPoints[0].date.getTime(), maxTime = dataPoints[dataPoints.length - 1].date.getTime();
    const getX = (d) => padding.left + ((d.date.getTime() - minTime) / (maxTime - minTime)) * (width - padding.left - padding.right);
    const getY = (d) => height - padding.bottom - ((d.ftp - minFTP) / (maxFTP - minFTP)) * (height - padding.top - padding.bottom);

    let pathD = `M ${getX(dataPoints[0])} ${getY(dataPoints[0])}`;
    let pointsHTML = '';
    dataPoints.forEach(d => {
        const x = getX(d); const y = getY(d); pathD += ` L ${x} ${y}`;
        pointsHTML += `<circle cx="${x}" cy="${y}" r="4" fill="#1e293b" stroke="#3b82f6" stroke-width="2"><title>${d.label}: ${d.ftp}W</title></circle>
            <text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" fill="#94a3b8" font-weight="bold">${d.ftp}</text>
            <text x="${x}" y="${height - 15}" text-anchor="middle" font-size="10" fill="#64748b">${d.date.getMonth()+1}/${d.date.getFullYear() % 100}</text>`;
    });

    return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-12">
            <h2 class="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-2 flex items-center gap-2"><i class="fa-solid fa-arrow-trend-up text-emerald-500"></i> FTP Progression</h2>
            <div class="w-full"><svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">
                    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" />
                    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" />
                    <path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />${pointsHTML}
                </svg></div></div>`;
};

export function renderTrends(logData) {
    const data = Array.isArray(logData) ? logData : [];
    return `
        ${renderVolumeChart(data, 'All', 'Total Weekly Volume')}
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            ${renderVolumeChart(data, 'Bike', 'Cycling Volume')}
            ${renderVolumeChart(data, 'Run', 'Running Volume')}
            ${renderVolumeChart(data, 'Swim', 'Swimming Volume')}
        </div>

        ${buildFTPChart()}
    `;
}
