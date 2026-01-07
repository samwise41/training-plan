// js/views/trends.js

let logData = [];

// --- GLOBAL TOGGLE FUNCTIONS ---
if (!window.toggleSection) {
    window.toggleSection = (id) => {
        const content = document.getElementById(id);
        if (!content) return;
        const header = content.previousElementSibling;
        const icon = header.querySelector('i.fa-caret-down');

        const isCollapsed = content.classList.contains('max-h-0');

        if (isCollapsed) {
            content.classList.remove('max-h-0', 'opacity-0', 'py-0', 'mb-0');
            content.classList.add('max-h-[5000px]', 'opacity-100', 'py-4', 'mb-8'); 
            if (icon) {
                icon.classList.add('rotate-0');
                icon.classList.remove('-rotate-90');
            }
        } else {
            content.classList.add('max-h-0', 'opacity-0', 'py-0', 'mb-0');
            content.classList.remove('max-h-[5000px]', 'opacity-100', 'py-4', 'mb-8');
            if (icon) {
                icon.classList.remove('rotate-0');
                icon.classList.add('-rotate-90');
            }
        }
    };
}

// --- TOOLTIP HANDLER (Smart Edge Detection & Rich Content) ---
window.showTrendTooltip = (evt, date, label, value, color, footer = null, footerColor = 'text-gray-400') => {
    const tooltip = document.getElementById('trend-tooltip-popup');
    if (!tooltip) return;

    // --- 1. Generate Content ---
    // If a footer is provided, use the "Volume Chart" rich layout
    if (footer) {
        tooltip.innerHTML = `
            <div class="text-center min-w-[120px]">
                <div class="font-bold text-white mb-1 border-b border-slate-600 pb-1">${date}</div>
                <div class="text-xs text-slate-300 mb-1">${label}</div>
                <div class="text-sm font-bold text-white mb-1 whitespace-nowrap">${value}</div>
                <div class="text-[10px] ${footerColor} border-t border-slate-700 pt-1 mt-1 font-mono">
                    ${footer}
                </div>
            </div>
        `;
    } 
    // Otherwise, use the "Line Chart" simple layout
    else {
        tooltip.innerHTML = `
            <div class="font-bold text-white mb-1 border-b border-slate-600 pb-1">${date}</div>
            <div class="flex items-center gap-2 whitespace-nowrap">
                <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span>
                <span class="text-slate-300 text-xs">${label}:</span>
                <span class="text-white font-mono font-bold">${value}</span>
            </div>
        `;
    }

    // --- 2. Position Logic (Smart Edge Detection) ---
    const x = evt.clientX;
    const y = evt.clientY;
    const viewportWidth = window.innerWidth;
    
    // Position vertically (above finger/cursor)
    tooltip.style.position = 'fixed';
    tooltip.style.top = `${y - 60}px`; 
    
    // Reset Horizontal
    tooltip.style.left = '';
    tooltip.style.right = '';

    // Logic: If click is on the right 40% of screen, anchor tooltip to the Left.
    // Otherwise, anchor to the Right.
    if (x > viewportWidth * 0.60) {
        tooltip.style.right = `${viewportWidth - x + 10}px`;
        tooltip.style.left = 'auto';
    } else {
        tooltip.style.left = `${x - 20}px`; // Slight offset to center over finger
        tooltip.style.right = 'auto';
    }
    
    // Prevent going off left edge
    if (x < 40) tooltip.style.left = '10px';

    // Show Tooltip
    tooltip.classList.remove('opacity-0', 'pointer-events-none');
    
    // Auto-hide after 3 seconds (Crucial for mobile experience)
    if (window.tooltipTimer) clearTimeout(window.tooltipTimer);
    window.tooltipTimer = setTimeout(() => {
        tooltip.classList.add('opacity-0', 'pointer-events-none');
    }, 3000);
};

// Default State
const chartState = {
    All: true,
    Bike: false,
    Run: false,
    Swim: false,
    timeRange: '60d',
    showWeekly: true, // Default ON
    show30d: true,    // Default ON
    show60d: false    // Default OFF
};

// --- UPDATED COLORS TO USE CSS VARIABLES ---
const colorMap = { 
    All: 'var(--color-all)', 
    Bike: 'var(--color-bike)',
    Run: 'var(--color-run)',
    Swim: 'var(--color-swim)'
};

// --- HELPER FUNCTIONS ---

const buildCollapsibleSection = (id, title, contentHtml, isOpen = true) => {
    const contentClasses = isOpen 
        ? "max-h-[5000px] opacity-100 py-4 mb-8" 
        : "max-h-0 opacity-0 py-0 mb-0";
    const iconClasses = isOpen 
        ? "rotate-0" 
        : "-rotate-90";

    return `
        <div class="w-full">
            <div class="flex items-center gap-2 cursor-pointer py-3 border-b-2 border-slate-700 hover:border-slate-500 transition-colors group select-none" onclick="window.toggleSection('${id}')">
                <i class="fa-solid fa-caret-down text-slate-400 text-base transition-transform duration-300 group-hover:text-white ${iconClasses}"></i>
                <h2 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">${title}</h2>
            </div>
            <div id="${id}" class="collapsible-content overflow-hidden transition-all duration-500 ease-in-out ${contentClasses}">
                ${contentHtml}
            </div>
        </div>
    `;
};

// Updated Icons to use your new 'icon-x' classes from styles.css
const getIconForType = (type) => {
    if (type === 'Bike') return '<i class="fa-solid fa-bicycle icon-bike text-xl"></i>';
    if (type === 'Run') return '<i class="fa-solid fa-person-running icon-run text-xl"></i>';
    if (type === 'Swim') return '<i class="fa-solid fa-person-swimming icon-swim text-xl"></i>';
    // Fallback for 'All'
    return '<i class="fa-solid fa-chart-line icon-all text-xl"></i>';
};

window.toggleTrendSeries = (type) => {
    if (chartState.hasOwnProperty(type)) {
        chartState[type] = !chartState[type];
        renderDynamicCharts(); 
    }
};

window.toggleTrendTime = (range) => {
    chartState.timeRange = range;
    renderDynamicCharts();
};

window.toggleTrendLine = (lineType) => {
    if (chartState.hasOwnProperty(lineType)) {
        chartState[lineType] = !chartState[lineType];
        renderDynamicCharts();
    }
};

// --- DATA CALCULATION ---
const getRollingPoints = (data, typeFilter, isCount) => {
    const points = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    let weeksBack = 26; 
    if (chartState.timeRange === '30d') weeksBack = 4;
    else if (chartState.timeRange === '60d') weeksBack = 8;
    else if (chartState.timeRange === '90d') weeksBack = 13;
    else if (chartState.timeRange === '1y') weeksBack = 52; 

    for (let i = weeksBack; i >= 0; i--) {
        const anchorDate = new Date(today);
        anchorDate.setDate(today.getDate() - (i * 7)); 
        
        const getStats = (days) => {
            const startWindow = new Date(anchorDate);
            startWindow.setDate(anchorDate.getDate() - days);
            let plan = 0; let act = 0;
            data.forEach(d => {
                if (d.date >= startWindow && d.date <= anchorDate) {
                    if (typeFilter !== 'All' && d.type !== typeFilter) return;
                    if (isCount) {
                        if (d.plannedDuration > 0 || d.type === 'Rest') { plan++; if (d.completed) act++; }
                    } else {
                        plan += (d.plannedDuration || 0); act += (d.actualDuration || 0);
                    }
                }
            });
            return plan > 0 ? Math.min(Math.round((act / plan) * 100), 300) : 0; 
        };
        points.push({ 
            label: `${anchorDate.getMonth()+1}/${anchorDate.getDate()}`, 
            val7: getStats(7),
            val30: getStats(30), 
            val60: getStats(60) 
        });
    }
    return points;
};

// --- CHART BUILDERS ---
const buildTrendChart = (title, isCount) => {
    const height = 200; const width = 800; 
    const padding = { top: 20, bottom: 30, left: 40, right: 20 };
    const chartW = width - padding.left - padding.right; const chartH = height - padding.top - padding.bottom;

    const activeTypes = Object.keys(chartState).filter(k => chartState[k] && k !== 'timeRange' && !k.startsWith('show')); 
    let allValues = [];
    
    activeTypes.forEach(type => {
        const pts = getRollingPoints(logData, type, isCount);
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

    // --- GRID LINES (Long Dash 8,8) ---
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
        const dataPoints = getRollingPoints(logData, type, isCount);
        const color = colorMap[type]; 
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

            // Weekly Dots (Solid Focus)
            if (chartState.showWeekly) {
                circlesHtml += `<circle cx="${x}" cy="${y7}" r="2.5" fill="${color}" stroke="#1e293b" stroke-width="1" class="cursor-pointer hover:r-4 transition-all" onclick="window.showTrendTooltip(event, '${p.label}', 'Weekly (${type})', ${p.val7}, '${color}')"></circle>`;
            }
            // 30d Dots
            if (chartState.show30d) {
                circlesHtml += `<circle cx="${x}" cy="${y30}" r="2" fill="${color}" stroke="none" opacity="0.6" class="cursor-pointer hover:r-5 transition-all" onclick="window.showTrendTooltip(event, '${p.label}', '30d (${type})', ${p.val30}, '${color}')"></circle>`;
            }
            // 60d Dots
            if (chartState.show60d) {
                circlesHtml += `<circle cx="${x}" cy="${y60}" r="2" fill="${color}" stroke="none" opacity="0.3" class="cursor-pointer hover:r-5 transition-all" onclick="window.showTrendTooltip(event, '${p.label}', '60d (${type})', ${p.val60}, '${color}')"></circle>`;
            }
        });

        // Weekly Line (Solid)
        if (chartState.showWeekly) {
            pathsHtml += `<path d="${d7}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />`;
        }
        // 30d Line (Dashed 4,4)
        if (chartState.show30d) {
            pathsHtml += `<path d="${d30}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="4,4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />`;
        }
        // 60d Line (Dotted 2,2)
        if (chartState.show60d) {
            pathsHtml += `<path d="${d60}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="2,2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />`;
        }
    });

    const axisPoints = getRollingPoints(logData, 'All', isCount);
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

const renderDynamicCharts = () => {
    const container = document.getElementById('trend-charts-container');
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
            <div class="flex items-center gap-2 flex-wrap border-t border-slate-700 pt-3">
                <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mr-2">Lines:</span>
                ${buildLineToggle('showWeekly', 'Weekly')}
                ${buildLineToggle('show30d', '30d Avg')}
                ${buildLineToggle('show60d', '60d Avg')}
            </div>
        </div>
        <div id="trend-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl text-xs pointer-events-none opacity-0 transition-opacity"></div>
    `;

    // Updated LEGEND to reflect new styles
    const legendHtml = `
        <div class="flex gap-4 text-[10px] text-slate-400 font-mono justify-end mb-2">
            <span class="flex items-center gap-1"><div class="w-4 h-0.5 bg-slate-400"></div> Weekly</span>
            <span class="flex items-center gap-1"><div class="w-4 h-0.5 border-t-2 border-dashed border-slate-400"></div> 30d Avg</span>
            <span class="flex items-center gap-1"><div class="w-4 h-0.5 border-t-2 border-dotted border-slate-400"></div> 60d Avg</span>
        </div>
    `;

    container.innerHTML = `${controlsHtml}${legendHtml}${buildTrendChart("Rolling Adherence (Duration Based)", false)}${buildTrendChart("Rolling Adherence (Count Based)", true)}`;
};

const buildConcentricChart = (stats30, stats60, centerLabel = "Trend") => {
    const r1 = 15.9155; const c1 = 100; const dash1 = `${stats30.pct} ${100 - stats30.pct}`; const color1 = stats30.pct >= 80 ? '#22c55e' : (stats30.pct >= 50 ? '#eab308' : '#ef4444');
    const r2 = 10; const c2 = 2 * Math.PI * r2; const val2 = (stats60.pct / 100) * c2; const dash2 = `${val2} ${c2 - val2}`; const color2 = stats60.pct >= 80 ? '#15803d' : (stats60.pct >= 50 ? '#a16207' : '#b91c1c'); 
    return `<div class="flex flex-col items-center justify-center w-full py-2"><div class="relative w-[120px] h-[120px] mb-2"><svg width="100%" height="100%" viewBox="0 0 42 42" class="donut-svg"><circle cx="21" cy="21" r="${r1}" fill="none" stroke="#1e293b" stroke-width="3"></circle><circle cx="21" cy="21" r="${r2}" fill="none" stroke="#1e293b" stroke-width="3"></circle><circle cx="21" cy="21" r="${r1}" fill="none" stroke="${color1}" stroke-width="3" stroke-dasharray="${dash1}" stroke-dashoffset="25" stroke-linecap="round"></circle><circle cx="21" cy="21" r="${r2}" fill="none" stroke="${color2}" stroke-width="3" stroke-dasharray="${dash2}" stroke-dashoffset="${c2 * 0.25}" stroke-linecap="round"></circle></svg><div class="absolute inset-0 flex items-center justify-center pointer-events-none"><span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">${centerLabel}</span></div></div><div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] w-full max-w-[160px]"><div class="text-right font-bold text-slate-400 flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color1}"></span> 30d</div><div class="font-mono text-white flex items-center gap-1 truncate">${stats30.pct}% <span class="text-slate-500 opacity-70">(${stats30.label})</span></div><div class="text-right font-bold text-slate-500 flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color2}"></span> 60d</div><div class="font-mono text-slate-300 flex items-center gap-1 truncate">${stats60.pct}% <span class="text-slate-600 opacity-70">(${stats60.label})</span></div></div></div>`;
};

const buildFTPChart = () => {
    const md = window.App?.planMd || "";
    if (!md) return '<div class="p-4 text-slate-500 italic">Plan data not loaded</div>';
    const lines = md.split('\n'); const dataPoints = []; let startFound = false;
    for (let line of lines) {
        if (line.includes('### Historical FTP Log')) { startFound = true; continue; }
        if (startFound) {
            if (line.trim().startsWith('#') && dataPoints.length > 0) break; 
            if (line.includes('|') && !line.includes('---') && !line.toLowerCase().includes('date')) {
                const parts = line.split('|');
                if (parts.length > 2) {
                    const dateStr = parts[1].trim(); const ftpStr = parts[2].trim(); const date = new Date(dateStr); const ftp = parseInt(ftpStr.replace(/\D/g, ''));
                    if (!isNaN(date.getTime()) && !isNaN(ftp)) dataPoints.push({ date, ftp, label: dateStr });
                }
            }
        }
    }
    dataPoints.sort((a, b) => a.date - b.date); if (dataPoints.length < 2) return ''; 
    const width = 800, height = 250, padding = { top: 30, bottom: 40, left: 50, right: 30 };
    const minFTP = Math.min(...dataPoints.map(d => d.ftp)) * 0.95, maxFTP = Math.max(...dataPoints.map(d => d.ftp)) * 1.05;
    const minTime = dataPoints[0].date.getTime(), maxTime = dataPoints[dataPoints.length - 1].date.getTime();
    const getX = (d) => padding.left + ((d.date.getTime() - minTime) / (maxTime - minTime)) * (width - padding.left - padding.right);
    const getY = (d) => height - padding.bottom - ((d.ftp - minFTP) / (maxFTP - minFTP)) * (height - padding.top - padding.bottom);
    let pathD = `M ${getX(dataPoints[0])} ${getY(dataPoints[0])}`; let pointsHTML = '';
    dataPoints.forEach(d => {
        const x = getX(d); const y = getY(d); pathD += ` L ${x} ${y}`;
        pointsHTML += `<circle cx="${x}" cy="${y}" r="4" fill="#1e293b" stroke="#3b82f6" stroke-width="2"><title>${d.label}: ${d.ftp}W</title></circle><text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" fill="#94a3b8" font-weight="bold">${d.ftp}</text><text x="${x}" y="${height - 15}" text-anchor="middle" font-size="10" fill="#64748b">${d.date.getMonth()+1}/${d.date.getFullYear() % 100}</text>`;
    });
    return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-0"><h2 class="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-2 flex items-center gap-2"><i class="fa-solid fa-arrow-trend-up text-emerald-500"></i> FTP Progression</h2><div class="w-full"><svg viewBox="0 0 ${width} ${height}" class="w-full h-auto"><line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" /><line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#334155" stroke-width="1" /><path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />${pointsHTML}</svg></div></div>`;
};

const renderVolumeChart = (data, sportType = 'All', title = 'Weekly Volume Trend') => {
    try {
        if (!data || data.length === 0) return '<div class="p-4 text-slate-500 italic">No data available</div>';
        
        // --- 1. PARSE LIMITS ---
        const md = window.App?.planMd || "";
        const getCap = (keyword) => {
            const regex = new RegExp(`\\*\\*${keyword} Cap:\\*\\*\\s*\\[(\\d+)%\\]`, 'i');
            const match = md.match(regex);
            return match ? parseInt(match[1], 10) / 100 : null;
        };

        const defaults = { 'Run': 0.10, 'Bike': 0.20, 'Swim': 0.20, 'All': 0.15 };
        let limitRed = getCap(sportType) !== null ? getCap(sportType) : (defaults[sportType] || 0.15);
        let limitYellow = Math.max(0, limitRed - 0.05);

        // --- 2. PREPARE BUCKETS (12 WEEKS) ---
        const buckets = []; 
        const now = new Date(); 
        const day = now.getDay(); 
        const distToSat = 6 - day; 
        const endOfCurrentWeek = new Date(now); 
        endOfCurrentWeek.setDate(now.getDate() + distToSat); 
        endOfCurrentWeek.setHours(23, 59, 59, 999);

        // Loop 11 = 12 weeks total
        for (let i = 11; i >= 0; i--) {
            const end = new Date(endOfCurrentWeek); 
            end.setDate(end.getDate() - (i * 7)); 
            const start = new Date(end); 
            start.setDate(start.getDate() - 6); 
            start.setHours(0,0,0,0);
            buckets.push({ start, end, label: `${end.getMonth()+1}/${end.getDate()}`, actualMins: 0, plannedMins: 0 });
        }

        // --- 3. AGGREGATE DATA ---
        data.forEach(item => {
            if (!item.date) return; 
            const t = item.date.getTime(); 
            const bucket = buckets.find(b => t >= b.start.getTime() && t <= b.end.getTime());
            
            if (bucket) { 
                // Plan Check
                if (sportType === 'All' || item.type === sportType) {
                    bucket.plannedMins += (item.plannedDuration || 0); 
                }
                // Actual Check
                const executedType = item.actualType || item.type;
                if (sportType === 'All' || executedType === sportType) {
                    bucket.actualMins += (item.actualDuration || 0);
                }
            }
        });

        let barsHtml = ''; 
        const maxVol = Math.max(...buckets.map(b => Math.max(b.actualMins, b.plannedMins))) || 1;

        const getStatusColor = (pctChange) => {
            if (pctChange > limitRed) return ['bg-red-500', '#ef4444'];
            if (pctChange > limitYellow) return ['bg-yellow-500', '#eab308'];
            if (pctChange < -0.20) return ['bg-slate-600', '#475569']; 
            return ['bg-emerald-500', '#10b981'];
        };

        // --- 4. RENDER BARS ---
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

            const [actualClass, actualHex] = getStatusColor(actualGrowth);
            const [__, planHex] = getStatusColor(plannedGrowth);

            const displayGrowth = actualGrowth; 
            const sign = displayGrowth > 0 ? '▲' : (displayGrowth < 0 ? '▼' : ''); 
            const growthLabel = prevActual > 0 ? `${sign} ${Math.round(Math.abs(displayGrowth) * 100)}%` : '--';
            
            let growthColor = "text-emerald-400";
            if (displayGrowth > limitRed) growthColor = "text-red-400";
            else if (displayGrowth > limitYellow) growthColor = "text-yellow-400";
            else if (displayGrowth < -0.20) growthColor = "text-slate-500";

            const planBarStyle = `
                background: repeating-linear-gradient(
                    45deg, ${planHex} 0, ${planHex} 4px, transparent 4px, transparent 8px
                ); border: 1px solid ${planHex}; opacity: 0.3;`;

            const actualOpacity = isCurrentWeek ? 'opacity-90' : 'opacity-80'; 
            
            // --- JS TOOLTIP LOGIC ---
            // We pass the data into showTrendTooltip so it handles the positioning
            // Args: evt, date, label, value, color, footer, footerColor
            const tooltipValue = `Plan: ${Math.round(b.plannedMins)}m | Act: ${Math.round(b.actualMins)}m`;
            const tooltipFooter = `vs Prior Act: ${growthLabel} (Limit: ${Math.round(limitRed*100)}%)`;
            
            // Note: We escape the strings to ensure valid HTML
            const clickAttr = `onclick="window.showTrendTooltip(event, '${b.label}', 'Volume Summary', '${tooltipValue}', '${actualHex}', '${tooltipFooter}', '${growthColor}')"`;

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

// Main Render Function
export function renderTrends(mergedLogData) {
    logData = Array.isArray(mergedLogData) ? mergedLogData : [];

    const calculateStats = (targetType, days, isDuration) => {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
        const now = new Date(); now.setHours(23, 59, 59, 999);
        const subset = logData.filter(item => { if (!item || !item.date) return false; return item.date >= cutoff && item.date <= now && (targetType === 'All' || item.type === targetType); });
        let val = 0, target = 0;
        subset.forEach(item => { if (isDuration) { target += (item.plannedDuration || 0); if (item.type === item.actualType) val += (item.actualDuration || 0); } else { target++; if (item.completed) val++; } });
        const pct = target > 0 ? Math.round((val / target) * 100) : 0;
        const label = isDuration ? `${val > 120 ? (val/60).toFixed(1)+'h' : val+'m'}/${target > 120 ? (target/60).toFixed(1)+'h' : target+'m'}` : `${val}/${target}`;
        return { pct, label };
    };

    // --- BUILD SECTIONS ---

    // 1. Volume Section
    const volumeChartsHtml = `${renderVolumeChart(logData, 'All', 'Total Weekly Volume')}<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-0">${renderVolumeChart(logData, 'Bike', 'Cycling Volume')}${renderVolumeChart(logData, 'Run', 'Running Volume')}${renderVolumeChart(logData, 'Swim', 'Swimming Volume')}</div>`;
    const volumeSection = buildCollapsibleSection('volume-section', 'Weekly Volume Analysis', volumeChartsHtml, true);

    // 2. Rolling Trends Section (Placeholder Div populated later)
    // We render the container HTML first
    const trendContainerHtml = `<div id="trend-charts-container"></div>`;
    const trendsSection = buildCollapsibleSection('trends-section', 'Adherence Trends', trendContainerHtml, true);

    // 3. FTP Section
    const ftpHtml = buildFTPChart();
    const ftpSection = buildCollapsibleSection('ftp-section', 'Fitness Progression', ftpHtml, true);

    // 4. Adherence Overview
    const buildCombinedCard = (title, type) => {
        const count30 = calculateStats(type, 30, false); const count60 = calculateStats(type, 60, false);
        const dur30 = calculateStats(type, 30, true); const dur60 = calculateStats(type, 60, true);
        return `<div class="kpi-card"><div class="kpi-header mb-2">${getIconForType(type)}<span class="kpi-title">${title}</span></div><div class="flex justify-around items-start"><div class="w-1/2 border-r border-slate-700 pr-2">${buildConcentricChart(count30, count60, "Count")}</div><div class="w-1/2 pl-2">${buildConcentricChart(dur30, dur60, "Time")}</div></div></div>`;
    };
    const adherenceHtml = `<div class="kpi-grid mb-0">${buildCombinedCard("All Activities", "All")}${buildCombinedCard("Cycling", "Bike")}${buildCombinedCard("Running", "Run")}${buildCombinedCard("Swimming", "Swim")}</div>`;
    const adherenceSection = buildCollapsibleSection('adherence-section', 'Compliance Overview', adherenceHtml, true);

    // 5. Duration Tool
    const durationHtml = `<div class="kpi-card bg-slate-800/20 border-t-4 border-t-purple-500"><div class="kpi-header border-b border-slate-700 pb-2 mb-4"><i class="fa-solid fa-filter text-purple-500 text-xl"></i><span class="kpi-title ml-2 text-purple-400">Duration Analysis Tool</span></div><div class="flex flex-col sm:flex-row gap-4 mb-8"><div class="flex-1"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Sport Filter</label><select id="kpi-sport-select" onchange="window.App.updateDurationAnalysis()" class="gear-select"><option value="All">All Sports</option><option value="Bike">Bike</option><option value="Run">Run</option><option value="Swim">Swim</option></select></div><div class="flex-1"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Day Filter</label><select id="kpi-day-select" onchange="window.App.updateDurationAnalysis()" class="gear-select"><option value="All">All Days</option><option value="Weekday">Weekday (Mon-Fri)</option><option value="Monday">Monday</option><option value="Tuesday">Tuesday</option><option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option><option value="Friday">Friday</option><option value="Saturday">Saturday</option><option value="Sunday">Sunday</option></select></div><div class="flex-1"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Time Period</label><select id="kpi-time-select" onchange="window.App.updateDurationAnalysis()" class="gear-select"><option value="All">All Time</option><option value="30">Last 30 Days</option><option value="60">Last 60 Days</option><option value="90">Last 90 Days</option></select></div></div><div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"><div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm"><div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Planned</div><div id="kpi-analysis-planned" class="text-xl font-bold text-white">--</div></div><div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm"><div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Actual</div><div id="kpi-analysis-actual" class="text-xl font-bold text-white">--</div></div><div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm"><div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Difference</div><div id="kpi-analysis-diff" class="text-xl font-bold text-white">--</div></div><div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm"><div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Adherence</div><div id="kpi-analysis-pct" class="text-xl font-bold text-white">--</div></div></div><div class="border-t border-slate-700 pt-4"><h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Detailed Log (Matches Filters)</h4><div class="overflow-x-auto max-h-60 overflow-y-auto border border-slate-700 rounded-lg"><table id="kpi-debug-table" class="w-full text-left text-sm text-slate-300"><thead class="bg-slate-900 sticky top-0"><tr><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500">Date</th><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500">Day</th><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500">Type</th><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500 text-center">Plan</th><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500 text-center">Act</th></tr></thead><tbody class="divide-y divide-slate-700"></tbody></table></div></div></div><div class="mt-8 text-center text-xs text-slate-500 italic">* 'h' in duration column denotes hours, otherwise minutes assumed.</div>`;
    const durationSection = buildCollapsibleSection('duration-section', 'Deep Dive Analysis', durationHtml, true);

    setTimeout(() => renderDynamicCharts(), 0);

    return { html: volumeSection + trendsSection + ftpSection + adherenceSection + durationSection, logData };
}

export function updateDurationAnalysis(data) {
    const sportSelect = document.getElementById('kpi-sport-select'), daySelect = document.getElementById('kpi-day-select'), timeSelect = document.getElementById('kpi-time-select');
    if (!sportSelect || !daySelect || !timeSelect) return;
    const dataToUse = (Array.isArray(data) && data.length > 0) ? data : logData;
    const selectedSport = sportSelect.value, selectedDay = daySelect.value, selectedTime = timeSelect.value;
    let cutoffDate = null;
    if (selectedTime !== 'All') { const days = parseInt(selectedTime); cutoffDate = new Date(); cutoffDate.setDate(cutoffDate.getDate() - days); cutoffDate.setHours(0, 0, 0, 0); }
    let totalPlanned = 0, totalActual = 0, debugRows = '';
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
        totalPlanned += (item.plannedDuration || 0); let thisActual = 0, actualClass = "text-slate-300";
        if (item.type === item.actualType) { thisActual = (item.actualDuration || 0); totalActual += thisActual; } else if (item.plannedDuration > 0) { actualClass = "text-red-400 font-bold"; }
        debugRows += `<tr class="border-b border-slate-700 hover:bg-slate-800/50"><td class="py-2 px-2 text-xs font-mono text-slate-400">${item.date.toISOString().split('T')[0]}</td><td class="py-2 px-2 text-xs text-slate-300">${itemDayName}</td><td class="py-2 px-2 text-xs text-slate-300">${item.type}</td><td class="py-2 px-2 text-xs text-slate-300 text-center">${item.plannedDuration}m</td><td class="py-2 px-2 text-xs ${actualClass} text-center">${thisActual}m</td></tr>`;
    });
    const debugTableBody = document.querySelector('#kpi-debug-table tbody');
    if (debugTableBody) debugTableBody.innerHTML = debugRows || '<tr><td colspan="5" class="text-center py-4 text-slate-500 italic">No matching records found</td></tr>';
    const diff = totalActual - totalPlanned, pct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
    const formatTime = (minutes) => { const m = Math.abs(minutes); if (m === 0) return "0m"; const h = Math.floor(m / 60), rem = m % 60; return h > 0 ? `${h}h ${rem}m` : `${rem}m`; };
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
