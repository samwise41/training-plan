// js/views/metrics.js

// --- STATE MANAGEMENT ---
let metricsState = { timeRange: '6m' }; 
let cachedData = [];

// --- GLOBAL HANDLERS ---
window.toggleMetricsTime = (range) => {
    metricsState.timeRange = range;
    updateMetricsCharts();
};

window.hideMetricTooltip = () => {
    const tooltip = document.getElementById('metric-tooltip-popup');
    const info = document.getElementById('metric-info-popup');
    const ranges = document.getElementById('metric-ranges-popup');
    if (tooltip) tooltip.classList.add('opacity-0', 'pointer-events-none');
    if (info) info.classList.add('opacity-0', 'pointer-events-none');
    if (ranges) ranges.classList.add('opacity-0', 'pointer-events-none');
};

const METRIC_DEFINITIONS = {
    endurance: {
        title: "Aerobic Efficiency",
        icon: "fa-bicycle", 
        styleClass: "icon-bike",
        rangeInfo: "<strong>Healthy Range: 1.30 – 1.70 EF</strong><br>Calculated as Watts per Heartbeat. Elite athletes often reach 2.0+.",
        description: "<strong>The Engine Check.</strong><br>Are you producing more Power for the same Heart Rate?<br><br>📈 <strong>Trend UP:</strong> Good. Your heart is working less.<br>📉 <strong>Trend DOWN:</strong> Fatigue or Cardiac Drift.",
        improvement: "• <strong>Z2 Volume:</strong> Long, steady rides.<br>• <strong>Consistency:</strong> Stack aerobic days."
    },
    strength: {
        title: "Strength & Torque",
        icon: "fa-bicycle",
        styleClass: "icon-bike",
        rangeInfo: "<strong>Healthy Range: 2.50 – 3.50 Idx</strong><br>Measures Watts per RPM. High torque (>3.0) indicates strong muscular force.",
        description: "<strong>The Muscle Check.</strong><br>Measures Watts per Revolution. High values mean you are pushing bigger gears (Force).",
        improvement: "• <strong>Low Cadence Intervals:</strong> 50-60 RPM.<br>• <strong>Hill Repeats:</strong> Seated climbing."
    },
    run: {
        title: "Running Economy",
        icon: "fa-person-running",
        styleClass: "icon-run",
        rangeInfo: "<strong>Healthy Range: 5.0 – 7.0 Idx</strong><br>Speed (meters/min) per heart beat. Higher values reflect better physiological efficiency.",
        description: "<strong>The Efficiency Check.</strong><br>How fast do you run per heartbeat?",
        improvement: "• <strong>Strides:</strong> 6x20sec bursts.<br>• <strong>Hill Sprints:</strong> Short, max effort (10-15s)."
    },
    mechanical: {
        title: "Mechanical Efficiency",
        icon: "fa-person-running",
        styleClass: "icon-run",
        rangeInfo: "<strong>Healthy Range: 0.75 – 0.95 Idx</strong><br>Ratio of Speed to Power. Above 0.90 indicates excellent 'stiffness' and form.",
        description: "<strong>The Form Check.</strong><br>Speed vs. Power. Are you converting Watts into actual Speed?<br><br>📈 <strong>Trend UP:</strong> Good stiffness.",
        improvement: "• <strong>Cadence:</strong> Aim for 170-180 spm.<br>• <strong>Drills:</strong> A-Skips, B-Skips, High Knees."
    }
};

// --- RANGES TOOLTIP (Click target icon) ---
window.showRangeTooltip = (evt, key) => {
    evt.stopPropagation();
    let rangeBox = document.getElementById('metric-ranges-popup');
    if (!rangeBox) return;

    const def = METRIC_DEFINITIONS[key];
    rangeBox.innerHTML = `
        <div class="space-y-3">
            <h4 class="text-white font-bold border-b border-slate-700 pb-2 flex items-center gap-2">
                <i class="fa-solid fa-crosshairs text-emerald-400"></i> Target Range
            </h4>
            <div class="text-[11px] text-slate-300 leading-relaxed">${def.rangeInfo}</div>
            <div class="text-[9px] text-slate-500 text-center pt-1 italic">Click to close</div>
        </div>
    `;
    
    rangeBox.style.left = `${evt.clientX - 150}px`;
    rangeBox.style.top = `${evt.clientY + 15}px`;
    rangeBox.classList.remove('opacity-0', 'pointer-events-none');
};

// --- INFO TOOLTIP (Click info icon) ---
window.showInfoTooltip = (evt, key) => {
    evt.stopPropagation();
    let infoBox = document.getElementById('metric-info-popup');
    if (!infoBox) return;

    const def = METRIC_DEFINITIONS[key];
    infoBox.innerHTML = `
        <div class="space-y-3">
            <h4 class="text-white font-bold border-b border-slate-700 pb-2 flex items-center gap-2">
                <i class="fa-solid fa-circle-info text-blue-400"></i> ${def.title}
            </h4>
            <div class="text-[11px] text-slate-300">${def.description}</div>
            <div class="text-[11px] text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                <strong>Improvement:</strong><br>${def.improvement}
            </div>
            <div class="text-[9px] text-slate-500 text-center pt-1 italic">Click to close</div>
        </div>
    `;
    
    infoBox.style.left = `${evt.clientX + 10}px`;
    infoBox.style.top = `${evt.clientY + 10}px`;
    infoBox.classList.remove('opacity-0', 'pointer-events-none');
};

// --- DATA TOOLTIP (Click data point) ---
window.showMetricTooltip = (evt, date, name, val, unitLabel, breakdown) => {
    evt.stopPropagation();
    let tooltip = document.getElementById('metric-tooltip-popup');
    if (!tooltip) return;

    tooltip.innerHTML = `
        <div class="text-center">
            <div class="text-[10px] text-slate-400 mb-1 border-b border-slate-700 pb-1">${date}</div>
            <div class="text-white font-bold text-xs mb-1">${name}</div>
            <div class="text-emerald-400 font-mono font-bold text-lg">${val} <span class="text-[10px] text-slate-500">${unitLabel}</span></div>
            <div class="text-[10px] text-slate-300 font-mono bg-slate-800 rounded px-2 py-0.5 mt-1 border border-slate-700">${breakdown}</div>
        </div>
    `;
    
    tooltip.style.left = `${evt.clientX + 15}px`;
    tooltip.style.top = `${evt.clientY - 50}px`;
    tooltip.classList.remove('opacity-0', 'pointer-events-none');
};

const calculateTrendline = (dataPoints) => {
    const n = dataPoints.length;
    if (n < 2) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i; sumY += dataPoints[i].val;
        sumXY += i * dataPoints[i].val; sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { startVal: intercept, endVal: intercept + slope * (n - 1) };
};

const buildMetricChart = (dataPoints, key, color, unitLabel) => {
    const def = METRIC_DEFINITIONS[key];
    if (!dataPoints || dataPoints.length < 2) {
        return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-6 flex items-center justify-center min-h-[150px] h-full"><p class="text-xs text-slate-500 italic">No Garmin labels matched.</p></div>`;
    }
    const width = 800;
    const height = 150;
    const pad = { t: 20, b: 30, l: 40, r: 20 };
    const getX = (d, i) => pad.l + (i / (dataPoints.length - 1)) * (width - pad.l - pad.r);
    const values = dataPoints.map(d => d.val);
    const minV = Math.min(...values) * 0.95;
    const maxV = Math.max(...values) * 1.05;
    const getY = (val) => height - pad.b - ((val - minV) / (maxV - minV)) * (height - pad.t - pad.b);

    const trend = calculateTrendline(dataPoints);
    let trendlineHtml = '';
    if (trend) {
        trendlineHtml = `<line x1="${getX(null, 0)}" y1="${getY(trend.startVal)}" x2="${getX(null, dataPoints.length - 1)}" y2="${getY(trend.endVal)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.4" />`;
    }

    let pathD = `M ${getX(dataPoints[0], 0)} ${getY(dataPoints[0].val)}`;
    let pointsHtml = '';
    dataPoints.forEach((d, i) => {
        const x = getX(d, i);
        const y = getY(d.val);
        pathD += ` L ${x} ${y}`;
        pointsHtml += `<circle cx="${x}" cy="${y}" r="3.5" fill="#0f172a" stroke="${color}" stroke-width="2" class="cursor-pointer hover:stroke-white transition-all" onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown}')"></circle>`;
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-xs font-bold text-white flex items-center gap-2">
                    <i class="fa-solid ${def.icon} ${def.styleClass}"></i> ${def.title}
                </h3>
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-crosshairs text-slate-500 hover:text-emerald-400 cursor-pointer text-[11px]" title="Target Ranges" onclick="window.showRangeTooltip(event, '${key}')"></i>
                    <i class="fa-solid fa-circle-info text-slate-500 hover:text-blue-400 cursor-pointer text-[11px]" title="Definitions & Drills" onclick="window.showInfoTooltip(event, '${key}')"></i>
                </div>
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
        if(btn) btn.className = metricsState.timeRange === range ? "bg-emerald-500 text-white font-bold px-3 py-1 rounded text-[10px] transition-all" : "bg-slate-800 text-slate-400 hover:text-white px-3 py-1 rounded text-[10px] transition-all";
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
                <div class="flex gap-1.5">${buildToggle('30d', '30 Days')}${buildToggle('90d', '90 Days')}${buildToggle('6m', '6 Months')}</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="metric-chart-endurance"></div><div id="metric-chart-strength"></div>
                <div id="metric-chart-economy"></div><div id="metric-chart-mechanics"></div>
            </div>
        </div>
        <div id="metric-tooltip-popup" onclick="window.hideMetricTooltip()" class="z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs opacity-0 transition-opacity fixed pointer-events-auto cursor-pointer"></div>
        <div id="metric-info-popup" onclick="window.hideMetricTooltip()" class="z-50 bg-slate-800 border border-blue-500/50 p-4 rounded-xl shadow-2xl text-xs opacity-0 transition-opacity fixed pointer-events-auto cursor-pointer max-w-[300px]"></div>
        <div id="metric-ranges-popup" onclick="window.hideMetricTooltip()" class="z-50 bg-slate-800 border border-emerald-500/50 p-4 rounded-xl shadow-2xl text-xs opacity-0 transition-opacity fixed pointer-events-auto cursor-pointer max-w-[250px]"></div>
    `;
}
