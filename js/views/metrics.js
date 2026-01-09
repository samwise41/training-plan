// js/views/metrics.js

// --- STATE MANAGEMENT ---
let metricsState = { timeRange: '6m' };
let cachedData = [];

// --- TOOLTIP STATE MANAGER ---
// We separate state into two "channels" so they don't conflict
let activeTooltips = {
    data: null,   // For Chart Dots
    static: null  // For Info (i) and Ranges (Target)
};
let tooltipTimers = {
    data: null,
    static: null
};

// Close a specific channel or both
const closeTooltip = (channel) => {
    if (channel === 'all') {
        closeTooltip('data');
        closeTooltip('static');
        return;
    }

    const active = activeTooltips[channel];
    if (active) {
        const el = document.getElementById(active.id);
        if (el) el.classList.add('opacity-0', 'pointer-events-none');
        activeTooltips[channel] = null;
        if (tooltipTimers[channel]) clearTimeout(tooltipTimers[channel]);
    }
};

const manageTooltip = (evt, id, contentHTML, channel) => {
    evt.stopPropagation(); 
    const triggerEl = evt.target;

    // 1. Toggle: If clicking the same trigger, close it.
    if (activeTooltips[channel] && activeTooltips[channel].trigger === triggerEl) {
        closeTooltip(channel);
        return;
    }

    // 2. Switch: Close any existing tooltip in this channel
    closeTooltip(channel);

    // 3. Open New
    const tooltip = document.getElementById(id);
    if (!tooltip) return;

    tooltip.innerHTML = contentHTML;
    tooltip.classList.remove('opacity-0', 'pointer-events-none');

    // 4. Positioning (Absolute to Document)
    const x = evt.pageX;
    const y = evt.pageY;
    const viewportWidth = window.innerWidth;

    let top = y - 10;
    let left = x + 15; 

    // Edge Detection
    if (x > viewportWidth * 0.6) {
        tooltip.style.right = `${viewportWidth - x + 15}px`;
        tooltip.style.left = 'auto';
    } else {
        tooltip.style.left = `${left}px`;
        tooltip.style.right = 'auto';
    }
    
    // Vertical positioning
    tooltip.style.top = `${top - tooltip.offsetHeight - 10}px`;
    if (y < 200) tooltip.style.top = `${y + 20}px`;

    // 5. Update State
    activeTooltips[channel] = { id, trigger: triggerEl };

    // 6. Timer (10 Seconds)
    if (tooltipTimers[channel]) clearTimeout(tooltipTimers[channel]);
    tooltipTimers[channel] = setTimeout(() => closeTooltip(channel), 10000);
};

// Global Listener: Clicking blank space closes ALL tooltips
// Clicking a tooltip itself keeps it open
window.addEventListener('click', (e) => {
    ['data', 'static'].forEach(channel => {
        const active = activeTooltips[channel];
        if (active) {
            const tooltipEl = document.getElementById(active.id);
            // If click is NOT inside the tooltip AND NOT the trigger -> Close
            if (tooltipEl && !tooltipEl.contains(e.target) && e.target !== active.trigger) {
                closeTooltip(channel);
            }
        }
    });
});

// --- GLOBAL HANDLERS ---
window.toggleMetricsTime = (range) => {
    metricsState.timeRange = range;
    updateMetricsCharts();
};

window.hideMetricTooltip = () => {
    closeTooltip('all');
};

// --- DEFINITIONS WITH RANGES ---
const METRIC_DEFINITIONS = {
    endurance: {
        title: "Aerobic Efficiency (EF)",
        icon: "fa-heart-pulse", 
        styleClass: "icon-bike",
        refMin: 1.30, refMax: 1.70, // Horizontal Line Targets
        rangeInfo: "<strong>Healthy Range: 1.30 – 1.70</strong><br>Watts per Heartbeat.",
        description: "<strong>The Engine Check.</strong><br>Are you getting fitter at base intensity?",
        improvement: "• <strong>Z2 Volume:</strong> Long, steady rides."
    },
    strength: {
        title: "Torque Efficiency",
        icon: "fa-bolt",
        styleClass: "icon-bike",
        refMin: 2.5, refMax: 3.5,
        rangeInfo: "<strong>Healthy Range: 2.5 – 3.5</strong><br>Watts per RPM.",
        description: "<strong>The Muscle Check.</strong><br>Measures muscular force per pedal stroke.",
        improvement: "• <strong>Low Cadence:</strong> Intervals at 50-60 RPM."
    },
    run: {
        title: "Running Economy",
        icon: "fa-person-running",
        styleClass: "icon-run",
        refMin: 5.0, refMax: 7.0,
        rangeInfo: "<strong>Healthy Range: 5.0 – 7.0</strong><br>Speed (m/min) per Heartbeat.",
        description: "<strong>The Efficiency Check.</strong><br>Speed generated per heart beat.",
        improvement: "• <strong>Strides:</strong> Short bursts of speed."
    },
    mechanical: {
        title: "Mechanical Stiffness",
        icon: "fa-ruler-horizontal",
        styleClass: "icon-run",
        refMin: 0.75, refMax: 0.95,
        rangeInfo: "<strong>Healthy Range: 0.75 – 0.95</strong><br>Speed vs. Power ratio.",
        description: "<strong>The Form Check.</strong><br>Are you converting Watts into Speed?",
        improvement: "• <strong>Plyometrics:</strong> Jump rope, box jumps."
    },
    vo2max: {
        title: "VO₂ Max Trend",
        icon: "fa-lungs",
        styleClass: "text-purple-400",
        refMin: 45, refMax: 55, // Estimated Range
        rangeInfo: "<strong>Target: 45 – 55+</strong><br>The aerobic ceiling.",
        description: "<strong>The Ceiling.</strong><br>An upward trend proves your engine size is increasing.",
        improvement: "• <strong>VO2 Intervals:</strong> 3-5 min max efforts."
    },
    tss: {
        title: "Weekly TSS Load",
        icon: "fa-layer-group",
        styleClass: "text-blue-400",
        refMin: 300, refMax: 600,
        rangeInfo: "<strong>Target: 300 – 600</strong><br>Training Stress Score.",
        description: "<strong>The Capacity Check.</strong><br>Rising TSS with stable fatigue = strength.",
        improvement: "• <strong>Volume:</strong> Add more hours."
    },
    gct: {
        title: "Ground Contact Time",
        icon: "fa-shoe-prints",
        styleClass: "text-orange-400",
        refMin: 220, refMax: 260, // Lower is better, but this is the "Good" band
        rangeInfo: "<strong>Target: < 260ms</strong><br>Time spent on the ground.",
        description: "<strong>The Elasticity Check.</strong><br>Lower time = better energy return.",
        improvement: "• <strong>Cadence:</strong> Increase step rate."
    },
    vert: {
        title: "Vertical Oscillation",
        icon: "fa-arrows-up-down",
        styleClass: "text-pink-400",
        refMin: 6.0, refMax: 9.0,
        rangeInfo: "<strong>Target: 6.0 – 9.0 cm</strong><br>Vertical bounce.",
        description: "<strong>The Bounce Check.</strong><br>Energy used to go UP isn't moving you FORWARD.",
        improvement: "• <strong>Drills:</strong> High knees, A-Skips."
    },
    anaerobic: {
        title: "Anaerobic Impact",
        icon: "fa-fire",
        styleClass: "text-red-500",
        refMin: 2.0, refMax: 4.0,
        rangeInfo: "<strong>Target: 2.0 – 4.0+</strong><br>On Interval Days.",
        description: "<strong>The Intensity Check.</strong><br>Are you hitting the high notes?",
        improvement: "• <strong>Sprints:</strong> All-out 30s efforts."
    }
};

// --- TRIGGER FUNCTIONS (Routed to Channels) ---
window.showRangeTooltip = (evt, key) => {
    const def = METRIC_DEFINITIONS[key];
    const html = `
        <div class="space-y-3">
            <h4 class="text-white font-bold border-b border-slate-700 pb-2 flex items-center gap-2">
                <i class="fa-solid fa-crosshairs text-emerald-400"></i> Target Range
            </h4>
            <div class="text-[11px] text-slate-300 leading-relaxed">${def.rangeInfo}</div>
            <div class="text-[9px] text-slate-500 text-center pt-1 italic">Click to close</div>
        </div>`;
    manageTooltip(evt, 'metric-ranges-popup', html, 'static'); // Channel: Static
};

window.showInfoTooltip = (evt, key) => {
    const def = METRIC_DEFINITIONS[key];
    const html = `
        <div class="space-y-3">
            <h4 class="text-white font-bold border-b border-slate-700 pb-2 flex items-center gap-2">
                <i class="fa-solid fa-circle-info text-blue-400"></i> ${def.title}
            </h4>
            <div class="text-[11px] text-slate-300">${def.description}</div>
            <div class="text-[11px] text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                <strong>Improvement:</strong><br>${def.improvement}
            </div>
            <div class="text-[9px] text-slate-500 text-center pt-1 italic">Click to close</div>
        </div>`;
    manageTooltip(evt, 'metric-info-popup', html, 'static'); // Channel: Static
};

window.showMetricTooltip = (evt, date, name, val, unitLabel, breakdown) => {
    const html = `
        <div class="text-center">
            <div class="text-[10px] text-slate-400 mb-1 border-b border-slate-700 pb-1">${date}</div>
            <div class="text-white font-bold text-xs mb-1">${name}</div>
            <div class="text-emerald-400 font-mono font-bold text-lg">${val} <span class="text-[10px] text-slate-500">${unitLabel}</span></div>
            ${breakdown ? `<div class="text-[10px] text-slate-300 font-mono bg-slate-800 rounded px-2 py-0.5 mt-1 border border-slate-700">${breakdown}</div>` : ''}
        </div>`;
    manageTooltip(evt, 'metric-tooltip-popup', html, 'data'); // Channel: Data
};

// --- CHART BUILDERS ---
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
        return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col justify-between">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-xs font-bold text-white flex items-center gap-2"><i class="fa-solid ${def.icon} ${def.styleClass}"></i> ${def.title}</h3>
            </div>
            <div class="flex-1 flex items-center justify-center"><p class="text-xs text-slate-500 italic">No data available.</p></div>
        </div>`;
    }
    const width = 800, height = 150;
    const pad = { t: 20, b: 30, l: 50, r: 20 }; // Increased Left Padding for Axis
    const getX = (d, i) => pad.l + (i / (dataPoints.length - 1)) * (width - pad.l - pad.r);
    
    // --- Y-AXIS SCALING ---
    const dataValues = dataPoints.map(d => d.val);
    let minV = Math.min(...dataValues);
    let maxV = Math.max(...dataValues);

    // Expand Domain to include Ideal Range Lines (if they exist)
    if (def.refMin !== undefined) minV = Math.min(minV, def.refMin);
    if (def.refMax !== undefined) maxV = Math.max(maxV, def.refMax);

    // Add 10% buffer
    const range = maxV - minV;
    const buf = range * 0.1 || (maxV * 0.1); 
    const domainMin = Math.max(0, minV - buf);
    const domainMax = maxV + buf;

    const getY = (val) => height - pad.b - ((val - domainMin) / (domainMax - domainMin)) * (height - pad.t - pad.b);

    // --- REFERENCE LINES (Ideal Ranges) ---
    let refLinesHtml = '';
    if (def.refMin !== undefined && def.refMax !== undefined) {
        const yMin = getY(def.refMin);
        const yMax = getY(def.refMax);
        // Ensure lines stay within drawing area
        if (yMin >= pad.t && yMin <= height - pad.b) {
            refLinesHtml += `<line x1="${pad.l}" y1="${yMin}" x2="${width - pad.r}" y2="${yMin}" stroke="#10b981" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />`;
        }
        if (yMax >= pad.t && yMax <= height - pad.b) {
            refLinesHtml += `<line x1="${pad.l}" y1="${yMax}" x2="${width - pad.r}" y2="${yMax}" stroke="#10b981" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />`;
        }
    }

    // --- VERTICAL AXIS & LABELS ---
    const yAxisLine = `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" stroke="#475569" stroke-width="1" />`;
    const yMid = (domainMin + domainMax) / 2;
    
    const axisLabelsHtml = `
        <text x="${pad.l - 5}" y="${getY(domainMax) + 4}" text-anchor="end" font-size="9" fill="#64748b">${domainMax.toFixed(1)}</text>
        <text x="${pad.l - 5}" y="${getY(yMid) + 4}" text-anchor="end" font-size="9" fill="#64748b">${yMid.toFixed(1)}</text>
        <text x="${pad.l - 5}" y="${getY(domainMin) + 4}" text-anchor="end" font-size="9" fill="#64748b">${domainMin.toFixed(1)}</text>
    `;

    // --- TRENDLINE & DATA ---
    const trend = calculateTrendline(dataPoints);
    let trendHtml = trend ? `<line x1="${getX(null, 0)}" y1="${getY(trend.startVal)}" x2="${getX(null, dataPoints.length - 1)}" y2="${getY(trend.endVal)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.4" />` : '';
    
    let pathD = `M ${getX(dataPoints[0], 0)} ${getY(dataPoints[0].val)}`;
    let pointsHtml = '';
    dataPoints.forEach((d, i) => {
        const x = getX(d, i), y = getY(d.val);
        pathD += ` L ${x} ${y}`;
        pointsHtml += `<circle cx="${x}" cy="${y}" r="3.5" fill="#0f172a" stroke="${color}" stroke-width="2" class="cursor-pointer hover:stroke-white transition-all" onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown || ""}')"></circle>`;
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col hover:border-slate-600 transition-colors">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-xs font-bold text-white flex items-center gap-2"><i class="fa-solid ${def.icon} ${def.styleClass}"></i> ${def.title}</h3>
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-crosshairs text-slate-500 hover:text-emerald-400 cursor-pointer text-[11px]" onclick="window.showRangeTooltip(event, '${key}')"></i>
                    <i class="fa-solid fa-circle-info text-slate-500 hover:text-blue-400 cursor-pointer text-[11px]" onclick="window.showInfoTooltip(event, '${key}')"></i>
                </div>
            </div>
            <div class="flex-1 w-full h-[120px]">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
                    ${yAxisLine}
                    ${axisLabelsHtml}
                    ${refLinesHtml}
                    ${trendHtml}
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8" />
                    ${pointsHtml}
                </svg>
            </div>
        </div>
    `;
};

// --- DATA AGGREGATION HELPERS ---
const aggregateWeeklyTSS = (data) => {
    const weeks = {};
    data.forEach(d => {
        if (!d.trainingStressScore || d.trainingStressScore === 0) return;
        const date = new Date(d.date);
        const day = date.getDay(); 
        const diff = date.getDate() - day + (day === 0 ? 0 : 7); 
        const weekEnd = new Date(date.setDate(diff));
        weekEnd.setHours(0,0,0,0);
        const key = weekEnd.toISOString().split('T')[0];
        if (!weeks[key]) weeks[key] = 0;
        weeks[key] += parseFloat(d.trainingStressScore);
    });
    return Object.keys(weeks).sort().map(k => ({
        date: new Date(k),
        dateStr: `Week Ending ${k}`,
        name: "Weekly Load",
        val: weeks[k],
        breakdown: `Total TSS: ${Math.round(weeks[k])}`
    }));
};

const updateMetricsCharts = () => {
    if (!cachedData || cachedData.length === 0) return;
    
    const cutoff = new Date();
    if (metricsState.timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (metricsState.timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (metricsState.timeRange === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (metricsState.timeRange === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);
    
    const filteredData = cachedData.filter(d => d.date >= cutoff).sort((a,b) => a.date - b.date);
    const isIntensity = (item, labels) => {
        const l = (item.trainingEffectLabel || "").toString().toUpperCase().trim();
        return labels.some(allowed => l === allowed.toUpperCase());
    };

    // 1. EFFICIENCY
    const efData = filteredData.filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgHR > 0 && isIntensity(d, ['AEROBIC_BASE', 'RECOVERY']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: d.avgPower / d.avgHR, breakdown: `Pwr:${Math.round(d.avgPower)} / HR:${Math.round(d.avgHR)}` }));

    const torqueData = filteredData.filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgCadence > 0 && isIntensity(d, ['VO2MAX', 'LACTATE_THRESHOLD', 'TEMPO', 'ANAEROBIC_CAPACITY']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: d.avgPower / d.avgCadence, breakdown: `Pwr:${Math.round(d.avgPower)} / RPM:${Math.round(d.avgCadence)}` }));

    const runEconData = filteredData.filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgHR > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: (d.avgSpeed * 60) / d.avgHR, breakdown: `Pace:${Math.round(d.avgSpeed * 60)} m/m / HR:${Math.round(d.avgHR)}` }));

    const mechData = filteredData.filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgPower > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: (d.avgSpeed * 100) / d.avgPower, breakdown: `Spd:${d.avgSpeed.toFixed(1)} / Pwr:${Math.round(d.avgPower)}` }));

    // 2. CAPACITY & GROWTH
    const vo2Data = filteredData.filter(d => d.vO2MaxValue > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: "VO2 Estimate", val: parseFloat(d.vO2MaxValue), breakdown: `Score: ${d.vO2MaxValue}` }));

    const fullTss = aggregateWeeklyTSS(cachedData);
    const tssData = fullTss.filter(d => d.date >= cutoff);

    const gctData = filteredData.filter(d => d.actualType === 'Run' && d.avgGroundContactTime > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: parseFloat(d.avgGroundContactTime), breakdown: `${Math.round(d.avgGroundContactTime)} ms` }));

    const vertData = filteredData.filter(d => d.actualType === 'Run' && d.avgVerticalOscillation > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: parseFloat(d.avgVerticalOscillation), breakdown: `${d.avgVerticalOscillation.toFixed(1)} cm` }));

    const anaData = filteredData.filter(d => d.anaerobicTrainingEffect > 0.5)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: parseFloat(d.anaerobicTrainingEffect), breakdown: `Anaerobic: ${d.anaerobicTrainingEffect}` }));

    const render = (id, data, key, color, unit) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = buildMetricChart(data, key, color, unit);
    };

    render('metric-chart-endurance', efData, 'endurance', '#10b981', 'EF');
    render('metric-chart-strength', torqueData, 'strength', '#8b5cf6', 'Idx');
    render('metric-chart-economy', runEconData, 'run', '#ec4899', 'Idx');
    render('metric-chart-mechanics', mechData, 'mechanical', '#f97316', 'Idx');
    render('metric-chart-vo2', vo2Data, 'vo2max', '#a855f7', '');
    render('metric-chart-tss', tssData, 'tss', '#3b82f6', 'TSS');
    render('metric-chart-gct', gctData, 'gct', '#f59e0b', 'ms');
    render('metric-chart-vert', vertData, 'vert', '#ec4899', 'cm');
    render('metric-chart-anaerobic', anaData, 'anaerobic', '#ef4444', 'TE');

    ['30d', '90d', '6m', '1y'].forEach(range => {
        const btn = document.getElementById(`btn-metric-${range}`);
        if(btn) btn.className = metricsState.timeRange === range ? 
            "bg-emerald-500 text-white font-bold px-3 py-1 rounded text-[10px] transition-all shadow-lg" : 
            "bg-slate-800 text-slate-400 hover:text-white px-3 py-1 rounded text-[10px] transition-all hover:bg-slate-700";
    });
};

export function renderMetrics(allData) {
    cachedData = allData || [];
    setTimeout(updateMetricsCharts, 0);
    const buildToggle = (range, label) => `<button id="btn-metric-${range}" onclick="window.toggleMetricsTime('${range}')" class="bg-slate-800 text-slate-400 px-3 py-1 rounded text-[10px] transition-all">${label}</button>`;
    
    return `
        <div class="max-w-7xl mx-auto space-y-6 pb-12 relative">
            <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800 backdrop-blur-sm sticky top-0 z-10">
                <h2 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <i class="fa-solid fa-chart-area text-emerald-500"></i> Performance Lab
                </h2>
                <div class="flex gap-1.5">${buildToggle('30d', '30d')}${buildToggle('90d', '90d')}${buildToggle('6m', '6m')}${buildToggle('1y', '1y')}</div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="metric-chart-endurance"></div>
                <div id="metric-chart-strength"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="metric-chart-economy"></div>
                <div id="metric-chart-mechanics"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="metric-chart-vo2"></div>
                <div id="metric-chart-tss"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="metric-chart-gct"></div>
                <div id="metric-chart-vert"></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="metric-chart-anaerobic"></div>
                <div class="bg-slate-800/10 border border-slate-800 border-dashed rounded-xl p-6 flex items-center justify-center">
                    <p class="text-xs text-slate-600 font-mono">Future Metric Slot</p>
                </div>
            </div>
        </div>

        <div id="metric-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs opacity-0 transition-opacity absolute pointer-events-auto cursor-pointer"></div>
        <div id="metric-info-popup" class="z-50 bg-slate-800 border border-blue-500/50 p-4 rounded-xl shadow-2xl text-xs opacity-0 transition-opacity absolute pointer-events-auto cursor-pointer max-w-[300px]"></div>
        <div id="metric-ranges-popup" class="z-50 bg-slate-800 border border-emerald-500/50 p-4 rounded-xl shadow-2xl text-xs opacity-0 transition-opacity absolute pointer-events-auto cursor-pointer max-w-[250px]"></div>
    `;
}
