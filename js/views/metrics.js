// js/views/metrics.js

// --- STATE MANAGEMENT ---
let metricsState = { timeRange: '6m' }; 
let cachedData = [];

// --- GLOBAL HANDLERS ---
window.toggleMetricsTime = (range) => {
    metricsState.timeRange = range;
    updateMetricsCharts();
};

window.showMetricTooltip = (evt, date, name, val, unitLabel, breakdown) => {
    let tooltip = document.getElementById('metric-tooltip-popup');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'metric-tooltip-popup';
        tooltip.className = 'z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs opacity-0 transition-opacity fixed min-w-[150px] max-w-[90vw] pointer-events-none';
        document.body.appendChild(tooltip);
    }
    tooltip.innerHTML = `
        <div class="text-center">
            <div class="text-[10px] text-slate-400 font-normal mb-1 border-b border-slate-700 pb-1">${date}</div>
            <div class="text-white font-bold text-sm mb-1 text-wrap leading-tight">${name}</div>
            <div class="text-emerald-400 font-mono font-bold text-lg mb-1">${val} <span class="text-[10px] text-slate-500">${unitLabel}</span></div>
            <div class="text-[10px] text-slate-300 font-mono bg-slate-800 rounded px-2 py-1 mt-1 inline-block border border-slate-700">${breakdown}</div>
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
};

const METRIC_DEFINITIONS = {
    endurance: { title: "Aerobic Efficiency", icon: "fa-bicycle", styleClass: "icon-bike" },
    strength: { title: "Strength & Torque", icon: "fa-bicycle", styleClass: "icon-bike" },
    run: { title: "Running Economy", icon: "fa-person-running", styleClass: "icon-run" },
    mechanical: { title: "Mechanical Efficiency", icon: "fa-person-running", styleClass: "icon-run" }
};

const buildMetricChart = (dataPoints, key, color, unitLabel) => {
    const def = METRIC_DEFINITIONS[key];
    if (!dataPoints || dataPoints.length < 2) {
        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-6 flex flex-col items-center justify-center min-h-[200px] h-full">
                <h3 class="text-sm font-bold text-white flex items-center gap-2 mb-2">
                    <i class="fa-solid ${def.icon} text-slate-500"></i> ${def.title}
                </h3>
                <p class="text-xs text-slate-500 italic">No Garmin labels matched in this range.</p>
            </div>`;
    }
    const width = 800;
    const height = 180;
    const pad = { t: 20, b: 30, l: 40, r: 20 };
    const values = dataPoints.map(d => d.val);
    const minVal = Math.min(...values) * 0.95;
    const maxVal = Math.max(...values) * 1.05;
    const minTime = dataPoints[0].date.getTime();
    const maxTime = dataPoints[dataPoints.length - 1].date.getTime();

    const getX = (d) => pad.l + ((d.date.getTime() - minTime) / (maxTime - minTime)) * (width - pad.l - pad.r);
    const getY = (val) => height - pad.b - ((val - minVal) / (maxVal - minVal)) * (height - pad.t - pad.b);

    let pathD = `M ${getX(dataPoints[0])} ${getY(dataPoints[0].val)}`;
    let pointsHtml = '';
    dataPoints.forEach(d => {
        const x = getX(d);
        const y = getY(d.val);
        pathD += ` L ${x} ${y}`;
        pointsHtml += `<circle cx="${x}" cy="${y}" r="4" fill="#1e293b" stroke="${color}" stroke-width="2" class="cursor-pointer" onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown}')"></circle>`;
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-sm font-bold text-white flex items-center gap-2"><i class="fa-solid ${def.icon} ${def.styleClass}"></i> ${def.title}</h3>
                <span class="text-[10px] text-slate-500 font-mono">${values.length} sessions</span>
            </div>
            <div class="flex-1 w-full">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" />
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

    // --- STRICT GARMIN INTENSITY HELPER ---
    const isIntensity = (item, allowedLabels) => {
        const label = (item.trainingEffectLabel || "").toString().toUpperCase().trim();
        return allowedLabels.some(allowed => label === allowed.toUpperCase());
    };

    // A. ENDURANCE: Bike + Aerobic Base/Recovery
    const efData = filteredData
        .filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgHR > 0 && isIntensity(d, ['AEROBIC_BASE', 'RECOVERY']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Ride", val: d.avgPower / d.avgHR, breakdown: `Pwr: ${Math.round(d.avgPower)}W / HR: ${Math.round(d.avgHR)}` }))
        .sort((a,b) => a.date - b.date);

    // B. STRENGTH: Bike + Performance Intensity
    const torqueData = filteredData
        .filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgCadence > 0 && isIntensity(d, ['VO2MAX', 'LACTATE_THRESHOLD', 'TEMPO', 'ANAEROBIC_CAPACITY', 'SPEED']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Ride", val: d.avgPower / d.avgCadence, breakdown: `Pwr: ${Math.round(d.avgPower)}W / RPM: ${Math.round(d.avgCadence)}` }))
        .sort((a,b) => a.date - b.date);

    // C. RUN ECONOMY: Run + Quality Labels
    const runEconData = filteredData
        .filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgHR > 0 && isIntensity(d, ['VO2MAX', 'LACTATE_THRESHOLD', 'TEMPO', 'SPEED']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Run", val: (d.avgSpeed * 60) / d.avgHR, breakdown: `Pace: ${Math.round(d.avgSpeed * 60)} m/m / HR: ${Math.round(d.avgHR)}` }))
        .sort((a,b) => a.date - b.date);

    // D. MECHANICAL: Run + Physics (Speed/Power)
    const mechData = filteredData
        .filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgPower > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Run", val: (d.avgSpeed * 100) / d.avgPower, breakdown: `Spd: ${d.avgSpeed.toFixed(2)} m/s / Pwr: ${Math.round(d.avgPower)}W` }))
        .sort((a,b) => a.date - b.date);

    document.getElementById('metric-chart-endurance').innerHTML = buildMetricChart(efData, 'endurance', "#10b981", "EF");
    document.getElementById('metric-chart-strength').innerHTML = buildMetricChart(torqueData, 'strength', "#8b5cf6", "idx");
    document.getElementById('metric-chart-economy').innerHTML = buildMetricChart(runEconData, 'run', "#ec4899", "idx");
    document.getElementById('metric-chart-mechanics').innerHTML = buildMetricChart(mechData, 'mechanical', "#f97316", "idx");
};

export function renderMetrics(allData) {
    cachedData = allData || [];
    setTimeout(updateMetricsCharts, 0);
    return `
        <div class="max-w-7xl mx-auto space-y-8">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-white">Performance Metrics</h2>
                <div class="flex gap-2">
                    <button onclick="window.toggleMetricsTime('30d')" class="bg-slate-800 text-xs px-3 py-1 rounded">30d</button>
                    <button onclick="window.toggleMetricsTime('6m')" class="bg-slate-800 text-xs px-3 py-1 rounded">6m</button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div id="metric-chart-endurance"></div>
                <div id="metric-chart-strength"></div>
                <div id="metric-chart-economy"></div>
                <div id="metric-chart-mechanics"></div>
            </div>
        </div>
        <div id="metric-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs opacity-0 transition-opacity fixed pointer-events-none"></div>
    `;
}
