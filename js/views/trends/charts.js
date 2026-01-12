// js/views/trends/charts.js
import { COLOR_MAP, getIconForType } from './utils.js';
import { getRollingPoints, parsePlanLimits, aggregateVolumeBuckets } from './analysis.js';

// --- CHART BUILDERS ---

export const buildConcentricChart = (stats30, stats60, centerLabel = "Trend") => {
    const r1 = 15.9155; const c1 = 100; const dash1 = `${stats30.pct} ${100 - stats30.pct}`; const color1 = stats30.pct >= 80 ? '#22c55e' : (stats30.pct >= 50 ? '#eab308' : '#ef4444');
    const r2 = 10; const c2 = 2 * Math.PI * r2; const val2 = (stats60.pct / 100) * c2; const dash2 = `${val2} ${c2 - val2}`; const color2 = stats60.pct >= 80 ? '#15803d' : (stats60.pct >= 50 ? '#a16207' : '#b91c1c'); 
    return `<div class="flex flex-col items-center justify-center w-full py-2"><div class="relative w-[120px] h-[120px] mb-2"><svg width="100%" height="100%" viewBox="0 0 42 42" class="donut-svg"><circle cx="21" cy="21" r="${r1}" fill="none" stroke="#1e293b" stroke-width="3"></circle><circle cx="21" cy="21" r="${r2}" fill="none" stroke="#1e293b" stroke-width="3"></circle><circle cx="21" cy="21" r="${r1}" fill="none" stroke="${color1}" stroke-width="3" stroke-dasharray="${dash1}" stroke-dashoffset="25" stroke-linecap="round"></circle><circle cx="21" cy="21" r="${r2}" fill="none" stroke="${color2}" stroke-width="3" stroke-dasharray="${dash2}" stroke-dashoffset="${c2 * 0.25}" stroke-linecap="round"></circle></svg><div class="absolute inset-0 flex items-center justify-center pointer-events-none"><span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">${centerLabel}</span></div></div><div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] w-full max-w-[160px]"><div class="text-right font-bold text-slate-400 flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color1}"></span> 30d</div><div class="font-mono text-white flex items-center gap-1 truncate">${stats30.pct}% <span class="text-slate-500 opacity-70">(${stats30.label})</span></div><div class="text-right font-bold text-slate-500 flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color2}"></span> 60d</div><div class="font-mono text-slate-300 flex items-center gap-1 truncate">${stats60.pct}% <span class="text-slate-600 opacity-70">(${stats60.label})</span></div></div></div>`;
};

export const buildFTPChart = (planMd) => {
    const md = planMd || "";
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
    
    const width = 800, height = 250, padding = { top: 30, bottom: 40, left: 50, right: 30 };
    const minFTP = Math.min(...dataPoints.map(d => d.ftp)) * 0.95, maxFTP = Math.max(...dataPoints.map(d => d.ftp)) * 1.05;
    const minTime = dataPoints[0].date.getTime(), maxTime = dataPoints[dataPoints.length - 1].date.getTime();
    const getX = (d) => padding.left + ((d.date.getTime() - minTime) / (maxTime - minTime)) * (width - padding.left - padding.right);
    const getY = (d) => height - padding.bottom - ((d.ftp - minFTP) / (maxFTP - minFTP)) * (height - padding.top - padding.bottom);
    
    let pathD = `M ${getX(dataPoints[0])} ${getY(dataPoints[0])}`; 
    let pointsHTML = '';
    
    dataPoints.forEach(d => {
        const x = getX(d); const y = getY(d); 
        pathD += ` L ${x} ${y}`;
        pointsHTML += `<circle cx="${x}" cy="${y}" r="4" fill="#1e293b" stroke="#3b82f6" stroke-width="2"><title>${d.label}: ${d.ftp}W</title></circle><text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" fill="#94a3b8" font-weight="bold">${d.ftp}</text><text x="${x}" y="${height - 15}" text-anchor="middle" font-size="10" fill="#64748b">${d.date.getMonth()+1}/${d.date.getFullYear() % 100}</text>`;
    });
    
    return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-0"><h2 class="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-2 flex items-center gap-2"><i class="fa-solid fa-arrow-trend-up text-emerald-500"></i> FTP Progression</h2><div class="w-full"><svg viewBox="0 0 ${width} ${height}" class="w-full h-auto"><line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" /><line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" /><path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />${pointsHTML}</svg></div></div>`;
};

export const renderVolumeChart = (data, planMd, sportType = 'All', title = 'Weekly Volume Trend') => {
    try {
        if (!data || data.length === 0) return '<div class="p-4 text-slate-500 italic">No data available</div>';
        
        const { limitRed, limitYellow } = parsePlanLimits(planMd, sportType);
        const buckets = aggregateVolumeBuckets(data, sportType);

        let barsHtml = ''; 
        const maxVol = Math.max(...buckets.map(b => Math.max(b.actualMins, b.plannedMins))) || 1;

        const getStatusColor = (pctChange) => {
            if (pctChange > limitRed) return ['bg-red-500', '#ef4444', 'text-red-400'];
            if (pctChange > limitYellow) return ['bg-yellow-500', '#eab308', 'text-yellow-400'];
            if (pctChange < -0.20) return ['bg-slate-600', '#475569', 'text-slate-500']; 
            return ['bg-emerald-500', '#10b981', 'text-emerald-400'];
        };

        buckets.forEach((b, idx) => {
            const isCurrentWeek = (idx === buckets.length - 1); 
            const hActual = Math.round((b.actualMins / maxVol) * 100); 
            const hPlan = Math.round((b.plannedMins / maxVol) * 100); 
            const prevActual = idx > 0 ? buckets[idx - 1].actualMins : 0;

            let actualGrowth = 0; 
            let plannedGrowth = 0;

            if (prevActual > 0) {
                actualGrowth = (b.actualMins - prevActual) / prevActual;
                plannedGrowth = (b.plannedMins - prevActual) / prevActual;
            }

            const [actualClass, _, actualTextClass] = getStatusColor(actualGrowth);
            const [__, planHex, planTextClass] = getStatusColor(plannedGrowth);

            const formatLabel = (val) => {
                const sign = val > 0 ? '▲' : (val < 0 ? '▼' : '');
                return prevActual > 0 ? `${sign} ${Math.round(Math.abs(val) * 100)}%` : '--';
            };
            
            const actLabel = formatLabel(actualGrowth);
            const planLabel = formatLabel(plannedGrowth);
            const limitLabel = `Limit: ${Math.round(limitRed*100)}%`;

            const planBarStyle = `
                background: repeating-linear-gradient(
                    45deg, ${planHex} 0, ${planHex} 4px, transparent 4px, transparent 8px
                ); border: 1px solid ${planHex}; opacity: 0.3;`;

            const actualOpacity = isCurrentWeek ? 'opacity-90' : 'opacity-80'; 
            
            const clickAttr = `onclick="window.showVolumeTooltip(event, '${b.label}', ${Math.round(b.plannedMins)}, '${planLabel}', '${planTextClass}', ${Math.round(b.actualMins)}, '${actLabel}', '${actualTextClass}', '${limitLabel}')"`;

            barsHtml += `
                <div class="flex flex-col items-center gap-1 flex-1 group relative cursor-pointer" ${clickAttr}>
                    <div class="relative w-full bg-slate-800/30 rounded-t-sm h-32 flex items-end justify-center pointer-events-none">
                        <div style="height: ${hPlan}%; ${planBarStyle}" class="absolute bottom-0 w-full rounded-t-sm z-0"></div>
                        <div style="height: ${hActual}%;" class="relative z-10 w-2/3 ${actualClass} ${actualOpacity} rounded-t-sm"></div>
                    </div>
                    <span class="text-[9px] text-slate-500 font-mono text-center leading-none mt-1 pointer-events-none">
                        ${b.label}
                        ${isCurrentWeek ? '<br><span class="text-[8px] text-blue-400 font-bold">NEXT</span>' : ''}
                    </span>
                </div>
            `;
        });
        
        let iconHtml = '<i class="fa-solid fa-chart-column icon-all"></i>'; 
        if (sportType === 'Bike') iconHtml = '<i class="fa-solid fa-bicycle icon-bike"></i>'; 
        if (sportType === 'Run') iconHtml = '<i class="fa-solid fa-person-running icon-run"></i>'; 
        if (sportType === 'Swim') iconHtml = '<i class="fa-solid fa-person-swimming icon-swim"></i>';

        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-4">
                <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">${iconHtml} ${title}</h3>
                </div>
                <div class="flex items-start justify-between gap-1 w-full">
                    ${barsHtml}
                </div>
            </div>
        `;
    } catch (e) { return `<div class="p-4 text-red-400">Chart Error: ${e.message}</div>`; }
};

// --- DYNAMIC CHART CONTROLLER ---

const buildTrendChart = (title, isCount, logData, chartState) => {
    const height = 200; const width = 800; 
    const padding = { top: 20, bottom: 30, left: 40, right: 20 };
    const chartW = width - padding.left - padding.right; const chartH = height - padding.top - padding.bottom;

    const activeTypes = Object.keys(chartState).filter(k => chartState[k] && k !== 'timeRange' && !k.startsWith('show')); 
    let allValues = [];
    
    activeTypes.forEach(type => {
        const pts = getRollingPoints(logData, type, isCount, chartState.timeRange);
        pts.forEach(p => {
            if(chartState.showWeekly && p.val7 > 0) allValues.push(p.val7);
            if(chartState.show30d && p.val30 > 0) allValues.push(p.val30);
            if(chartState.show60d && p.val60 > 0) allValues.push(p.val60);
        });
    });

    if (allValues.length === 0) allValues = [0, 10]; 

    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    
    let spread = dataMax - dataMin;
    if (spread < 20) spread = 20; 
    
    const domainMin = Math.max(0, dataMin - (spread * 0.1)); 
    const domainMax = dataMax + (spread * 0.1);

    const getY = (val) => padding.top + chartH - ((val - domainMin) / (domainMax - domainMin)) * chartH;
    const getX = (idx, total) => padding.left + (idx / (total - 1)) * chartW;

    const gridLinesDef = [
        { val: 100, color: '#ffffff' }, // White
        { val: 80, color: '#eab308' },  // Yellow
        { val: 60, color: '#ef4444' }   // Red
    ];

    let gridHtml = '';
    gridLinesDef.forEach(line => {
        if (line.val <= domainMax && line.val >= domainMin) {
            const y = getY(line.val);
            gridHtml += `
                <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${line.color}" stroke-width="1" stroke-dasharray="8,8" opacity="0.3" />
                <text x="${padding.left - 5}" y="${y + 3}" text-anchor="end" font-size="9" fill="${line.color}" font-weight="bold" opacity="0.8">${line.val}%</text>
            `;
        }
    });

    let pathsHtml = '';
    let circlesHtml = '';

    activeTypes.forEach(type => {
        const dataPoints = getRollingPoints(logData, type, isCount, chartState.timeRange);
        const color = COLOR_MAP[type]; 
        if (dataPoints.length < 2) return;

        let d7 = `M ${getX(0, dataPoints.length)} ${getY(dataPoints[0].val7)}`;
        let d30 = `M ${getX(0, dataPoints.length)} ${getY(dataPoints[0].val30)}`;
        let d60 = `M ${getX(0, dataPoints.length)} ${getY(dataPoints[0].val60)}`;
        
        dataPoints.forEach((p, i) => {
            const x = getX(i, dataPoints.length);
            const y7 = getY(p.val7);
            const y30 = getY(p.val30);
            const y60 = getY(p.val60);

            d7 += ` L ${x} ${y7}`;
            d30 += ` L ${x} ${y30}`;
            d60 += ` L ${x} ${y60}`;

            if (chartState.showWeekly) {
                circlesHtml += `<circle cx="${x}" cy="${y7}" r="2.5" fill="${color}" stroke="#1e293b" stroke-width="1" class="cursor-pointer hover:r-4 transition-all" onclick="window.showTrendTooltip(event, '${p.label}', 'Weekly (${type})', ${p.val7}, '${color}')"></circle>`;
            }
            if (chartState.show30d) {
                circlesHtml += `<circle cx="${x}" cy="${y30}" r="2" fill="${color}" stroke="none" opacity="0.6" class="cursor-pointer hover:r-5 transition-all" onclick="window.showTrendTooltip(event, '${p.label}', '30d (${type})', ${p.val30}, '${color}')"></circle>`;
            }
            if (chartState.show60d) {
                circlesHtml += `<circle cx="${x}" cy="${y60}" r="2" fill="${color}" stroke="none" opacity="0.3" class="cursor-pointer hover:r-5 transition-all" onclick="window.showTrendTooltip(event, '${p.label}', '60d (${type})', ${p.val60}, '${color}')"></circle>`;
            }
        });

        if (chartState.showWeekly) pathsHtml += `<path d="${d7}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />`;
        if (chartState.show30d) pathsHtml += `<path d="${d30}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="4,4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />`;
        if (chartState.show60d) pathsHtml += `<path d="${d60}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="2,2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />`;
    });

    const axisPoints = getRollingPoints(logData, 'All', isCount, chartState.timeRange);
    let labelsHtml = '';
    let modVal = 4;
    if (chartState.timeRange === '30d') modVal = 1;
    else if (chartState.timeRange === '60d') modVal = 2;
    else if (chartState.timeRange === '90d') modVal = 3;
    else if (chartState.timeRange === '1y') modVal = 8;
    
    axisPoints.forEach((p, i) => {
        if (i % modVal === 0 || i === axisPoints.length - 1) {
            labelsHtml += `<text x="${getX(i, axisPoints.length)}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#64748b">${p.label}</text>`;
        }
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-4 relative overflow-hidden">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <i class="fa-solid fa-chart-line text-slate-400"></i> ${title}
                </h3>
            </div>
            <div class="w-full relative">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible">
                    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" />
                    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" />
                    ${gridHtml}
                    ${pathsHtml}
                    ${circlesHtml}
                    ${labelsHtml}
                </svg>
            </div>
        </div>
    `;
};

export const renderDynamicCharts = (containerId, logData, chartState) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const buildSportToggle = (type, label, colorClass) => {
        const isActive = chartState[type];
        const bg = isActive ? colorClass : 'bg-slate-800';
        const text = isActive ? 'text-slate-900 font-bold' : 'text-slate-400';
        const border = isActive ? 'border-transparent' : 'border-slate-600';
        return `<button onclick="window.toggleTrendSeries('${type}')" class="${bg} ${text} ${border} border px-3 py-1 rounded text-xs transition-all hover:opacity-90">${label}</button>`;
    };

    const buildTimeToggle = (range, label) => {
        const isActive = chartState.timeRange === range;
        const bg = isActive ? 'bg-slate-200' : 'bg-slate-800';
        const text = isActive ? 'text-slate-900 font-bold' : 'text-slate-400';
        const border = isActive ? 'border-transparent' : 'border-slate-600';
        return `<button onclick="window.toggleTrendTime('${range}')" class="${bg} ${text} ${border} border px-3 py-1 rounded text-xs transition-all hover:opacity-90">${label}</button>`;
    };

    const buildLineToggle = (lineType, label) => {
        const isActive = chartState[lineType];
        const bg = isActive ? 'bg-slate-600' : 'bg-slate-800';
        const text = isActive ? 'text-white font-bold' : 'text-slate-400';
        const border = isActive ? 'border-transparent' : 'border-slate-600';
        return `<button onclick="window.toggleTrendLine('${lineType}')" class="${bg} ${text} ${border} border px-3 py-1 rounded text-xs transition-all hover:opacity-90">${label}</button>`;
    };

    const controlsHtml = `
        <div class="flex flex-col gap-4 mb-6">
            <div class="flex flex-col sm:flex-row gap-4 justify-between">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mr-2">Sports:</span>
                    ${buildSportToggle('All', 'All', 'bg-icon-all')}
                    ${buildSportToggle('Bike', 'Bike', 'bg-icon-bike')}
                    ${buildSportToggle('Run', 'Run', 'bg-icon-run')}
                    ${buildSportToggle('Swim', 'Swim', 'bg-icon-swim')}
                    
                    <div class="w-px h-4 bg-slate-700 mx-1"></div>
                    <button onclick="window.resetTrendDefaults()" class="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-600 px-3 py-1 rounded text-xs transition-all shadow-sm" title="Reset to Defaults">
                        <i class="fa-solid fa-rotate-left text-[10px]"></i> Default
                    </button>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mr-2">Range:</span>
                    ${buildTimeToggle('30d', '30d')}
                    ${buildTimeToggle('60d', '60d')}
                    ${buildTimeToggle('90d', '90d')}
                    ${buildTimeToggle('6m', '6m')}
                    ${buildTimeToggle('1y', '1y')}
                </div>
            </div>
            
            <div class="flex items-center justify-between border-t border-slate-700 pt-3 mt-2">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mr-2">Lines:</span>
                    ${buildLineToggle('showWeekly', 'Weekly')}
                    ${buildLineToggle('show30d', '30d Avg')}
                    ${buildLineToggle('show60d', '60d Avg')}
                </div>
            </div>
        </div>
        <div id="trend-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl text-xs pointer-events-none opacity-0 transition-opacity"></div>
    `;

    const legendHtml = `
        <div class="flex gap-4 text-[10px] text-slate-400 font-mono justify-end mb-2">
            <span class="flex items-center gap-1"><div class="w-4 h-0.5 bg-slate-400"></div> Weekly</span>
            <span class="flex items-center gap-1"><div class="w-4 h-0.5 border-t-2 border-dashed border-slate-400"></div> 30d Avg</span>
            <span class="flex items-center gap-1"><div class="w-4 h-0.5 border-t-2 border-dotted border-slate-400"></div> 60d Avg</span>
        </div>
    `;

    const chart1 = buildTrendChart("Rolling Adherence (Duration Based)", false, logData, chartState);
    const chart2 = buildTrendChart("Rolling Adherence (Count Based)", true, logData, chartState);

    container.innerHTML = `${controlsHtml}${legendHtml}${chart1}${chart2}`;
};
