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

window.showInfoTooltip = (evt, title, desc) => {
    let tooltip = document.getElementById('metric-info-popup');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'metric-info-popup';
        tooltip.className = 'z-50 bg-slate-800 border border-blue-500/50 p-4 rounded-xl shadow-2xl text-xs opacity-0 transition-opacity fixed max-w-[300px] w-[85vw] pointer-events-none text-left';
        document.body.appendChild(tooltip);
    }
    tooltip.innerHTML = `
        <h4 class="text-white font-bold mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
            <i class="fa-solid fa-circle-info text-blue-400"></i> ${title}
        </h4>
        <div class="text-slate-300 leading-relaxed space-y-3">${desc}</div>
    `;
    positionTooltip(evt, tooltip);
};

window.hideInfoTooltip = () => {
    const tooltip = document.getElementById('metric-info-popup');
    if (tooltip) {
        tooltip.classList.add('opacity-0');
        setTimeout(() => tooltip.classList.add('pointer-events-none'), 300);
    }
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
    el.style.right = 'auto';
    el.classList.remove('opacity-0', 'pointer-events-none');
    if (window.metricTooltipTimer) clearTimeout(window.metricTooltipTimer);
    window.metricTooltipTimer = setTimeout(() => {
        el.classList.add('opacity-0');
        setTimeout(() => el.classList.add('pointer-events-none'), 300);
    }, 8000);
};

const METRIC_DEFINITIONS = {
    endurance: {
        title: "Aerobic Efficiency",
        icon: "fa-bicycle", 
        styleClass: "icon-bike",
        description: "<strong>The Engine Check.</strong><br>Watts per Heartbeat for <strong>Aerobic Base</strong> sessions.",
        improvement: "<strong>How to Improve:</strong> Keep heart rate steady in Zone 2."
    },
    strength: {
        title: "Strength & Torque",
        icon: "fa-bicycle",
        styleClass: "icon-bike",
        description: "<strong>The Muscle Check.</strong><br>Watts per Revolution for <strong>High Intensity</strong> sessions.",
        improvement: "<strong>How to Improve:</strong> Focus on low-cadence, high-force climbing."
    },
    run: {
        title: "Running Economy",
        icon: "fa-person-running",
        styleClass: "icon-run",
        description: "<strong>The Efficiency Check.</strong><br>Speed per heartbeat during <strong>Quality</strong> runs.",
        improvement: "<strong>How to Improve:</strong> Focus on form stiffness and strides."
    },
    mechanical: {
        title: "Mechanical Efficiency",
        icon: "fa-person-running",
        styleClass: "icon-run",
        description: "<strong>The Form Check.</strong><br>Speed vs Power. Shows how well you convert energy into forward motion.",
        improvement: "<strong>How to Improve:</strong> Increase cadence to reduce ground contact time."
    }
};

const buildMetricChart = (dataPoints, key, color, unitLabel) => {
    const def = METRIC_DEFINITIONS[key];
    if (!dataPoints || dataPoints.length < 2) {
        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-6 flex flex-col items-center justify-center min-h-[200px] h-full">
                <h3 class="text-sm font-bold text-white flex items-center gap-2 mb-2">
                    <i class="fa-solid ${def.icon} text-slate-500"></i> ${def.title}
                </h3>
                <p class="text-xs text-slate-500 italic">No data found in range.</p>
            </div>`;
    }
    const width = 800;
    const height = 200;
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
        pointsHtml += `<circle cx="${x}" cy="${y}" r="4" fill="#1e293b" stroke="${color}" stroke-width="2" class="hover:r-6 hover:stroke-white transition-all cursor-pointer" onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown}')"></circle>`;
    });
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const avgY = getY(avg);
    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-6 h-full flex flex-col">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
                        <i class="fa-solid ${def.icon} ${def.styleClass} text-lg"></i>
                    </div>
                    <div class="flex flex-col">
                        <h3 class="text-sm font-bold text-white">${def.title}</h3>
                        <span class="text-[10px] text-slate-500 font-mono">${values.length} sessions</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-[10px] font-mono text-slate-400 block">Avg: ${avg.toFixed(2)}</span>
                    <span class="text-xs font-bold text-white block" style="color: ${color}">Last: ${values[values.length-1].toFixed(2)}</span>
                </div>
            </div>
            <div class="w-full flex-1 min-h-[150px]">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
                    <line x1="${pad.l}" y1="${avgY}" x2="${width-pad.r}" y2="${avgY}" stroke="#475569" stroke-width="1" stroke-dasharray="4,4" opacity="0.3" />
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    ${pointsHtml}
                </svg>
            </div>
        </div>
    `;
};

const updateMetricsCharts = () => {
    if (!cachedData || cachedData.length === 0) return;

    const now = new Date();
    const cutoff = new Date();
    if (metricsState.timeRange === '30d') cutoff.setDate(now.getDate() - 30);
    else if (metricsState.timeRange === '60d') cutoff.setDate(now.getDate() - 60);
    else if (metricsState.timeRange === '90d') cutoff.setDate(now.getDate() - 90);
    else if (metricsState.timeRange === '6m') cutoff.setMonth(now.getMonth() - 6);
    
    const filteredData = cachedData.filter(d => d.date >= cutoff);

    // --- ENHANCED HELPER: CHECK LABEL, THEN NAME, THEN NOTES ---
    const isIntensity = (item, intensityTypes, keywords) => {
        const label = (item.trainingEffectLabel || "").toUpperCase();
        const text = ((item.actualName || "") + " " + (item.notes || "")).toLowerCase();
        
        // 1. Check Garmin Label first
        if (intensityTypes.some(type => label.includes(type.toUpperCase()))) return true;
        
        // 2. Fallback to keywords if label is missing
        if (keywords.some(k => text.includes(k.toLowerCase()))) return true;
        
        return false;
    };

    // A. ENDURANCE
    const efData = filteredData
        .filter(d => {
            const type = (d.actualType || "").toLowerCase();
            const isBike = type.includes('bike') || type.includes('cycling');
            return isBike && d.avgPower > 0 && d.avgHR > 0 && isIntensity(d, ['AEROBIC_BASE', 'RECOVERY'], ['base', 'z2', 'easy', 'long', 'endurance']);
        })
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Ride", val: d.avgPower / d.avgHR, breakdown: `Pwr: ${Math.round(d.avgPower)}W / HR: ${Math.round(d.avgHR)}` }))
        .sort((a,b) => a.date - b.date);

    // B. STRENGTH
    const torqueData = filteredData
        .filter(d => {
            const type = (d.actualType || "").toLowerCase();
            const isBike = type.includes('bike') || type.includes('cycling');
            return isBike && d.avgPower > 0 && d.avgCadence > 0 && isIntensity(d, ['VO2MAX', 'THRESHOLD', 'TEMPO', 'ANAEROBIC'], ['hill', 'climb', 'torque', 'interval', 'ftp', 'race']);
        })
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Ride", val: d.avgPower / d.avgCadence, breakdown: `Pwr: ${Math.round(d.avgPower)}W / RPM: ${Math.round(d.avgCadence)}` }))
        .sort((a,b) => a.date - b.date);

    // C. RUN ECONOMY
    const runEconData = filteredData
        .filter(d => {
            const type = (d.actualType || "").toLowerCase();
            return type.includes('run') && d.avgSpeed > 0 && d.avgHR > 0;
        })
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Run", val: (d.avgSpeed * 60) / d.avgHR, breakdown: `Pace: ${Math.round(d.avgSpeed * 60)} m/m / HR: ${Math.round(d.avgHR)}` }))
        .sort((a,b) => a.date - b.date);

    // D. MECHANICAL
    const mechData = filteredData
        .filter(d => {
            const type = (d.actualType || "").toLowerCase();
            return type.includes('run') && d.avgSpeed > 0 && d.avgPower > 0;
        })
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName || "Run", val: (d.avgSpeed * 100) / d.avgPower, breakdown: `Spd: ${d.avgSpeed.toFixed(2)} m/s / Pwr: ${Math.round(d.avgPower)}W` }))
        .sort((a,b) => a.date - b.date);

    const chartEndurance = document.getElementById('metric-chart-endurance');
    const chartStrength = document.getElementById('metric-chart-strength');
    const chartEconomy = document.getElementById('metric-chart-economy');
    const chartMechanics = document.getElementById('metric-chart-mechanics');

    if(chartEndurance) chartEndurance.innerHTML = buildMetricChart(efData, 'endurance', "#10b981", "EF");
    if(chartStrength) chartStrength.innerHTML = buildMetricChart(torqueData, 'strength', "#8b5cf6", "idx");
    if(chartEconomy) chartEconomy.innerHTML = buildMetricChart(runEconData, 'run', "#ec4899", "idx");
    if(chartMechanics) chartMechanics.innerHTML = buildMetricChart(mechData, 'mechanical', "#f97316", "idx");

    ['30d', '60d', '90d', '6m'].forEach(range => {
        const btn = document.getElementById(`btn-metric-${range}`);
        if(btn) btn.className = metricsState.timeRange === range ? "bg-slate-200 text-slate-900 font-bold px-3 py-1 rounded text-xs" : "bg-slate-800 text-slate-400 px-3 py-1 rounded text-xs";
    });
};

export function renderMetrics(allData) {
    cachedData = allData || [];
    setTimeout(updateMetricsCharts, 0);
    const buildToggle = (range, label) => `<button id="btn-metric-${range}" onclick="window.toggleMetricsTime('${range}')" class="bg-slate-800 text-slate-400 px-3 py-1 rounded text-xs transition-all hover:text-white">${label}</button>`;
    return `
        <div class="max-w-7xl mx-auto space-y-8">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-white">Performance Metrics</h2>
                <div class="flex gap-2 bg-slate-900/50 p-1 rounded-lg">
                    ${buildToggle('30d', '30d')}${buildToggle('60d', '60d')}${buildToggle('90d', '90d')}${buildToggle('6m', '6m')}
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div id="metric-chart-endurance"></div>
                <div id="metric-chart-strength"></div>
                <div id="metric-chart-economy"></div>
                <div id="metric-chart-mechanics"></div>
            </div>
        </div>
    `;
}
