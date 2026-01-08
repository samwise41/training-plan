// js/views/metrics.js

// --- STATE MANAGEMENT ---
let metricsState = { timeRange: '6m' }; 
let cachedData = [];

// --- GLOBAL HANDLERS ---
window.toggleMetricsTime = (range) => {
    metricsState.timeRange = range;
    updateMetricsCharts();
};

// Function to manually hide tooltip
window.hideMetricTooltip = () => {
    const tooltip = document.getElementById('metric-tooltip-popup');
    if (tooltip) {
        tooltip.classList.add('opacity-0', 'pointer-events-none');
    }
};

window.showMetricTooltip = (evt, date, name, val, unitLabel, breakdown) => {
    let tooltip = document.getElementById('metric-tooltip-popup');
    if (!tooltip) return; // Should be created by renderMetrics

    tooltip.innerHTML = `
        <div class="text-center cursor-pointer">
            <div class="text-[10px] text-slate-400 font-normal mb-1 border-b border-slate-700 pb-1">${date}</div>
            <div class="text-white font-bold text-sm mb-1 text-wrap leading-tight">${name}</div>
            <div class="text-emerald-400 font-mono font-bold text-lg mb-1">${val} <span class="text-[10px] text-slate-500">${unitLabel}</span></div>
            <div class="text-[10px] text-slate-300 font-mono bg-slate-800 rounded px-2 py-1 mt-1 inline-block border border-slate-700">${breakdown}</div>
            <div class="text-[9px] text-slate-500 mt-2 block">(Click to close)</div>
        </div>
    `;
    positionTooltip(evt, tooltip);
};

const positionTooltip = (evt, el) => {
    const x = evt.clientX;
    const y = evt.clientY;
    const vW = window.innerWidth;
    const w = el.offsetWidth || 200; 
    const h = el.offsetHeight || 100;
    
    let left = x + 15;
    if (left + w > vW - 10) left = x - w - 15;
    if (left < 10) left = 10;
    
    let top = y - h - 15;
    if (top < 10) top = y + 25;
    
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.classList.remove('opacity-0', 'pointer-events-none');
    
    // Auto-hide after 8 seconds if not clicked
    if (window.metricTooltipTimer) clearTimeout(window.metricTooltipTimer);
    window.metricTooltipTimer = setTimeout(() => {
        el.classList.add('opacity-0', 'pointer-events-none');
    }, 8000);
};

const METRIC_DEFINITIONS = {
    endurance: { title: "Aerobic Efficiency", icon: "fa-bicycle", styleClass: "icon-bike" },
    strength: { title: "Strength & Torque", icon: "fa-bicycle", styleClass: "icon-bike" },
    run: { title: "Running Economy", icon: "fa-person-running", styleClass: "icon-run" },
    mechanical: { title: "Mechanical Efficiency", icon: "fa-person-running", styleClass: "icon-run" }
};

const calculateTrendline = (dataPoints) => {
    const n = dataPoints.length;
    if (n < 2) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += dataPoints[i].val;
        sumXY += i * dataPoints[i].val;
        sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return {
        startVal: intercept,
        endVal: intercept + slope * (n - 1)
    };
};

const buildMetricChart = (dataPoints, key, color, unitLabel) => {
    const def = METRIC_DEFINITIONS[key];
    if (!dataPoints || dataPoints.length < 2) {
        return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-6 flex flex-col items-center justify-center min-h-[150px] h-full"><p class="text-xs text-slate-500 italic">No Garmin labels matched.</p></div>`;
    }
    const width = 800;
    const height = 150;
    const pad = { t: 20, b: 30, l: 40, r: 20 };
    const values = dataPoints.map(d => d.val);
    const minVal = Math.min(...values) * 0.95;
    const maxVal = Math.max(...values) * 1.05;
    const minTime = dataPoints[0].date.getTime();
    const maxTime = dataPoints[dataPoints.length - 1].date.getTime();

    const getX = (d) => pad.l + ((d.date.getTime() - minTime) / (maxTime - minTime)) * (width - pad.l - pad.r);
    const getY = (val) => height - pad.b - ((val - minVal) / (maxVal - minVal)) * (height - pad.t - pad.b);

    const trend = calculateTrendline(dataPoints);
    let trendlineHtml = '';
    if (trend) {
        trendlineHtml = `<line x1="${getX(dataPoints[0])}" y1="${getY(trend.startVal)}" x2="${getX(dataPoints[dataPoints.length - 1])}" y2="${getY(trend.endVal)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.4" />`;
    }

    let pathD = `M ${getX(dataPoints[0])} ${getY(dataPoints[0].val)}`;
    let pointsHtml = '';
    dataPoints.forEach(d => {
        const x = getX(d);
        const y = getY(d.val);
        pathD += ` L ${x} ${y}`;
        pointsHtml += `<circle cx="${x}" cy="${y}" r="3.5" fill="#0f172a" stroke="${color}" stroke-width="2" class="cursor-pointer hover:stroke-white transition-all" onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown}')"></circle>`;
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-xs font-bold text-white flex items-center gap-2"><i class="fa-solid ${def.icon} ${def.styleClass}"></i> ${def.title}</h3>
                <span class="text-[9px] text-slate-400 font-mono italic">${trend.endVal > trend.startVal ? 'Rising ↑' : 'Falling ↓'}</span>
            </div>
            <div class="flex-1 w-full h-[120px]">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
                    ${trendlineHtml}
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8" />
                    ${pointsHtml}
                </svg>
            </div>
        </div>
    `;
};

const updateMetricsCharts = () => {
    if (!cachedData || cachedData.length === 0) return;

    const cutoff = new Date();
    if (metricsState.timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (metricsState.timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (metricsState.timeRange === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    
    const filteredData = cachedData.filter(d => d.date >= cutoff);

    const isIntensity = (item, allowedLabels) => {
        const label = (item.trainingEffectLabel || "").toString().toUpperCase().trim();
        return allowedLabels.some(allowed => label === allowed.toUpperCase());
    };

    const efData = filteredData.filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgHR > 0 && isIntensity(d, ['AEROBIC_BASE', 'RECOVERY']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Ride", val: d.avgPower / d.avgHR, breakdown: `Pwr: ${Math.round(d.avgPower)}W / HR: ${Math.round(d.avgHR)}` }))
        .sort((a,b) => a.date - b.date);

    const torqueData = filteredData.filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgCadence > 0 && isIntensity(d, ['VO2MAX', 'LACTATE_THRESHOLD', 'TEMPO', 'ANAEROBIC_CAPACITY', 'SPEED']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Ride", val: d.avgPower / d.avgCadence, breakdown: `Pwr: ${Math.round(d.avgPower)}W / RPM: ${Math.round(d.avgCadence)}` }))
        .sort((a,b) => a.date - b.date);

    const runEconData = filteredData.filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgHR > 0 && isIntensity(d, ['VO2MAX', 'LACTATE_THRESHOLD', 'TEMPO', 'SPEED']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Run", val: (d.avgSpeed * 60) / d.avgHR, breakdown: `Pace: ${Math.round(d.avgSpeed * 60)} m/m / HR: ${Math.round(d.avgHR)}` }))
        .sort((a,b) => a.date - b.date);

    const mechData = filteredData.filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgPower > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Run", val: (d.avgSpeed * 100) / d.avgPower, breakdown: `Spd: ${d.avgSpeed.toFixed(2)} m/s / Pwr: ${Math.round(d.avgPower)}W` }))
        .sort((a,b) => a.date - b.date);

    document.getElementById('metric-chart-endurance').innerHTML = buildMetricChart(efData, 'endurance', "#10b981", "EF");
    document.getElementById('metric-chart-strength').innerHTML = buildMetricChart(torqueData, 'strength', "#8b5cf6", "idx");
    document.getElementById('metric-chart-economy').innerHTML = buildMetricChart(runEconData, 'run', "#ec4899", "idx");
    document.getElementById('metric-chart-mechanics').innerHTML = buildMetricChart(mechData, 'mechanical', "#f97316", "idx");

    ['30d', '90d', '6m'].forEach(range => {
        const btn = document.getElementById(`btn-metric-${range}`);
        if(btn) {
            btn.className = metricsState.timeRange === range 
                ? "bg-emerald-500 text-white font-bold px-3 py-1 rounded text-[10px] transition-all"
                : "bg-slate-800 text-slate-400 hover:text-white px-3 py-1 rounded text-[10px] transition-all";
        }
    });
};

export function renderMetrics(allData) {
    cachedData = allData || [];
    setTimeout(updateMetricsCharts, 0);
    const buildToggle = (range, label) => `<button id="btn-metric-${range}" onclick="window.toggleMetricsTime('${range}')" class="bg-slate-800 text-slate-400 px-3 py-1 rounded text-[10px] transition-all">${label}</button>`;
    
    return `
        <div class="max-w-7xl mx-auto space-y-6">
            <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                <h2 class="text-sm font-bold text-white uppercase tracking-wider">Physiological Performance</h2>
                <div class="flex gap-1.5">
                    ${buildToggle('30d', '30 Days')}${buildToggle('90d', '90 Days')}${buildToggle('6m', '6 Months')}
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="metric-chart-endurance"></div>
                <div id="metric-chart-strength"></div>
                <div id="metric-chart-economy"></div>
                <div id="metric-chart-mechanics"></div>
            </div>
        </div>
        <div id="metric-tooltip-popup" 
             onclick="window.hideMetricTooltip()" 
             class="z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs opacity-0 transition-opacity fixed pointer-events-auto cursor-pointer">
        </div>
    `;
}
