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
    if (tooltip) tooltip.classList.add('opacity-0', 'pointer-events-none');
    if (info) info.classList.add('opacity-0', 'pointer-events-none');
};

const METRIC_DEFINITIONS = {
    endurance: {
        title: "Aerobic Efficiency",
        icon: "fa-bicycle", 
        styleClass: "icon-bike",
        description: "<strong>The Engine Check.</strong><br>Are you producing more Power for the same Heart Rate?<br><br>📈 <strong>Trend UP:</strong> Good. Your heart is working less.<br>📉 <strong>Trend DOWN:</strong> Fatigue or Cardiac Drift.",
        improvement: "• <strong>Z2 Volume:</strong> Long, steady rides.<br>• <strong>Consistency:</strong> Stack aerobic days."
    },
    strength: {
        title: "Strength & Torque",
        icon: "fa-bicycle",
        styleClass: "icon-bike",
        description: "<strong>The Muscle Check.</strong><br>Measures Watts per Revolution. High values mean you are pushing bigger gears (Force).",
        improvement: "• <strong>Low Cadence Intervals:</strong> 50-60 RPM.<br>• <strong>Hill Repeats:</strong> Seated climbing."
    },
    run: {
        title: "Running Economy",
        icon: "fa-person-running",
        styleClass: "icon-run",
        description: "<strong>The Efficiency Check.</strong><br>How fast do you run per heartbeat?",
        improvement: "• <strong>Strides:</strong> 6x20sec bursts.<br>• <strong>Hill Sprints:</strong> Short, max effort (10-15s)."
    },
    mechanical: {
        title: "Mechanical Efficiency",
        icon: "fa-person-running",
        styleClass: "icon-run",
        description: "<strong>The Form Check.</strong><br>Speed vs. Power. Are you converting Watts into actual Speed?<br><br>📈 <strong>Trend UP:</strong> Good stiffness.",
        improvement: "• <strong>Cadence:</strong> Aim for 170-180 spm.<br>• <strong>Drills:</strong> A-Skips, B-Skips, High Knees."
    }
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
                    <i class="fa-solid fa-circle-info text-slate-500 hover:text-blue-400 cursor-pointer text-[10px]" onclick="window.showInfoTooltip(event, '${key}')"></i>
                </h3>
            </div>
            <div class="flex-1 w-full h-[120px]">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8" />
                    ${pointsHtml}
                </svg>
            </div>
        </div>
    `;
};

// ... (keep updateMetricsCharts as is) ...

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
    `;
}
