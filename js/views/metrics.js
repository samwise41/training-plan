// js/views/metrics.js

// --- STATE MANAGEMENT ---
let metricsState = { timeRange: '6m' };
let cachedData = [];

// --- TOOLTIP STATE MANAGER ---
let activeTooltip = null;
let tooltipTimer = null;

const closeTooltip = () => {
    if (!activeTooltip) return;
    const el = document.getElementById(activeTooltip.id);
    if (el) {
        el.classList.add('opacity-0', 'pointer-events-none');
    }
    activeTooltip = null;
    clearTimeout(tooltipTimer);
};

const manageTooltip = (evt, id, contentHTML) => {
    evt.stopPropagation(); // Stop propagation so document click doesn't kill it immediately
    const triggerEl = evt.target;

    // 1. Toggle: If clicking the same trigger, close it.
    if (activeTooltip && activeTooltip.trigger === triggerEl) {
        closeTooltip();
        return;
    }

    // 2. Switch: If clicking a different trigger, close old first.
    if (activeTooltip) {
        closeTooltip();
    }

    // 3. Open New
    const tooltip = document.getElementById(id);
    if (!tooltip) return;

    tooltip.innerHTML = contentHTML;
    tooltip.classList.remove('opacity-0', 'pointer-events-none');

    // 4. Positioning (Absolute to Document)
    // Use pageX/pageY so it sticks to the document position, not the screen
    const x = evt.pageX;
    const y = evt.pageY;
    const viewportWidth = window.innerWidth;

    let top = y - 10; // Slight offset
    let left = x + 15; 

    // Edge Detection: Flip to left if too close to right edge
    if (x > viewportWidth * 0.6) {
        left = 'auto'; // Reset left
        tooltip.style.right = `${viewportWidth - x + 15}px`;
        tooltip.style.left = 'auto';
    } else {
        tooltip.style.left = `${left}px`;
        tooltip.style.right = 'auto';
    }
    
    // Position above the cursor by default
    tooltip.style.top = `${top - tooltip.offsetHeight - 10}px`;
    // If that pushes it off top of page, flip to below
    if (y < 200) {
        tooltip.style.top = `${y + 20}px`;
    }

    activeTooltip = { id, trigger: triggerEl };

    // 5. Timer (10 Seconds)
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(closeTooltip, 10000);
};

// Global Listener to handle "Clicking off" or "Clicking Window"
window.addEventListener('click', (e) => {
    if (!activeTooltip) return;
    
    // If clicking the tooltip itself -> Close
    const tooltipEl = document.getElementById(activeTooltip.id);
    if (tooltipEl && tooltipEl.contains(e.target)) {
        closeTooltip();
        return;
    }

    // If clicking anywhere else (that isn't the trigger) -> Close
    if (e.target !== activeTooltip.trigger) {
        closeTooltip();
    }
});

// --- GLOBAL HANDLERS ---
window.toggleMetricsTime = (range) => {
    metricsState.timeRange = range;
    updateMetricsCharts();
};

window.hideMetricTooltip = () => {
    closeTooltip(); // Use shared closer
};

// --- DEFINITIONS ---
const METRIC_DEFINITIONS = {
    endurance: {
        title: "Aerobic Efficiency (EF)",
        icon: "fa-heart-pulse", 
        styleClass: "icon-bike",
        rangeInfo: "<strong>Healthy Range: 1.30 – 1.70</strong><br>Watts per Heartbeat. Rising values mean you produce more power for the same cardiac cost.",
        description: "<strong>The Engine Check.</strong><br>Are you getting fitter at base intensity?",
        improvement: "• <strong>Z2 Volume:</strong> Long, steady rides.<br>• <strong>Consistency:</strong> Stack aerobic days."
    },
    strength: {
        title: "Torque Efficiency",
        icon: "fa-bolt",
        styleClass: "icon-bike",
        rangeInfo: "<strong>Healthy Range: 2.5 – 3.5</strong><br>Watts per RPM. Measures muscular force application per pedal stroke.",
        description: "<strong>The Muscle Check.</strong><br>High values indicate you are pushing bigger gears (Force) rather than just spinning fast.",
        improvement: "• <strong>Low Cadence:</strong> Intervals at 50-60 RPM.<br>• <strong>Hill Repeats:</strong> Seated climbing."
    },
    run: {
        title: "Running Economy",
        icon: "fa-person-running",
        styleClass: "icon-run",
        rangeInfo: "<strong>Healthy Range: 5.0 – 7.0</strong><br>Speed (m/min) per Heartbeat. Higher is better.",
        description: "<strong>The Efficiency Check.</strong><br>How much speed do you generate for every heart beat?",
        improvement: "• <strong>Strides:</strong> Short bursts of speed.<br>• <strong>Hill Sprints:</strong> Max effort (10-15s)."
    },
    mechanical: {
        title: "Mechanical Stiffness",
        icon: "fa-ruler-horizontal",
        styleClass: "icon-run",
        rangeInfo: "<strong>Healthy Range: 0.75 – 0.95</strong><br>Speed vs. Power ratio. Higher means better form conversion.",
        description: "<strong>The Form Check.</strong><br>Are you converting Watts into actual forward Speed?",
        improvement: "• <strong>Cadence:</strong> Aim for 170-180 spm.<br>• <strong>Plyometrics:</strong> Jump rope, box jumps."
    },
    vo2max: {
        title: "VO₂ Max Trend",
        icon: "fa-lungs",
        styleClass: "text-purple-400",
        rangeInfo: "<strong>Range: 40 – 60+</strong><br>The absolute ceiling of your aerobic engine.",
        description: "<strong>The Ceiling.</strong><br>An upward trend here proves your engine size is increasing, regardless of daily fatigue.",
        improvement: "• <strong>VO2 Intervals:</strong> 3-5 min max efforts.<br>• <strong>Consistency:</strong> Years of aerobic base."
    },
    tss: {
        title: "Weekly TSS Load",
        icon: "fa-layer-group",
        styleClass: "text-blue-400",
        rangeInfo: "<strong>Range: 300 – 700+</strong><br>Training Stress Score. Measures total weekly physiological load.",
        description: "<strong>The Capacity Check.</strong><br>Are you handling more work? Rising TSS with stable fatigue means you are getting stronger.",
        improvement: "• <strong>Volume:</strong> Add more hours.<br>• <strong>Intensity:</strong> Increase IF of existing sessions."
    },
    gct: {
        title: "Ground Contact Time",
        icon: "fa-shoe-prints",
        styleClass: "text-orange-400",
        rangeInfo: "<strong>Target: < 260ms</strong><br>Time spent on the ground. Lower is better (more elastic).",
        description: "<strong>The Elasticity Check.</strong><br>Less time on the ground means better tendon energy return and less braking force.",
        improvement: "• <strong>Cadence:</strong> Increase step rate.<br>• <strong>Form:</strong> Land under hips, not in front."
    },
    vert: {
        title: "Vertical Oscillation",
        icon: "fa-arrows-up-down",
        styleClass: "text-pink-400",
        rangeInfo: "<strong>Target: 6.0 – 9.0 cm</strong><br>How much you bounce. Lower is usually more efficient.",
        description: "<strong>The Bounce Check.</strong><br>Energy used to go UP is energy not used to go FORWARD.",
        improvement: "• <strong>Drills:</strong> High knees, A-Skips.<br>• <strong>Core:</strong> Improve stability."
    },
    anaerobic: {
        title: "Anaerobic Impact",
        icon: "fa-fire",
        styleClass: "text-red-500",
        rangeInfo: "<strong>Score: 0.0 – 5.0</strong><br>Garmin Anaerobic Training Effect.",
        description: "<strong>The Intensity Check.</strong><br>Are you hitting the high notes? Ensures you aren't just doing 'grey zone' training.",
        improvement: "• <strong>Sprints:</strong> All-out 30s efforts.<br>• <strong>Recover:</strong> Rest fully between sets."
    }
};

// --- TOOLTIP TRIGGERS ---
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
    manageTooltip(evt, 'metric-ranges-popup', html);
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
    manageTooltip(evt, 'metric-info-popup', html);
};

window.showMetricTooltip = (evt, date, name, val, unitLabel, breakdown) => {
    const html = `
        <div class="text-center">
            <div class="text-[10px] text-slate-400 mb-1 border-b border-slate-700 pb-1">${date}</div>
            <div class="text-white font-bold text-xs mb-1">${name}</div>
            <div class="text-emerald-400 font-mono font-bold text-lg">${val} <span class="text-[10px] text-slate-500">${unitLabel}</span></div>
            ${breakdown ? `<div class="text-[10px] text-slate-300 font-mono bg-slate-800 rounded px-2 py-0.5 mt-1 border border-slate-700">${breakdown}</div>` : ''}
        </div>`;
    manageTooltip(evt, 'metric-tooltip-popup', html);
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
    const pad = { t: 20, b: 30, l: 40, r: 20 };
    const getX = (d, i) => pad.l + (i / (dataPoints.length - 1)) * (width - pad.l - pad.r);
    const values = dataPoints.map(d => d.val);
    const minV = Math.min(...values) * 0.95, maxV = Math.max(...values) * 1.05;
    const getY = (val) => height - pad.b - ((val - minV) / (maxV - minV)) * (height - pad.t - pad.b);

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

    // EXISTING METRICS
    const efData = filteredData.filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgHR > 0 && isIntensity(d, ['AEROBIC_BASE', 'RECOVERY']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: d.avgPower / d.avgHR, breakdown: `Pwr:${Math.round(d.avgPower)} / HR:${Math.round(d.avgHR)}` }));

    const torqueData = filteredData.filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgCadence > 0 && isIntensity(d, ['VO2MAX', 'LACTATE_THRESHOLD', 'TEMPO', 'ANAEROBIC_CAPACITY']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: d.avgPower / d.avgCadence, breakdown: `Pwr:${Math.round(d.avgPower)} / RPM:${Math.round(d.avgCadence)}` }));

    const runEconData = filteredData.filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgHR > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: (d.avgSpeed * 60) / d.avgHR, breakdown: `Pace:${Math.round(d.avgSpeed * 60)} m/m / HR:${Math.round(d.avgHR)}` }));

    const mechData = filteredData.filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgPower > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: (d.avgSpeed * 100) / d.avgPower, breakdown: `Spd:${d.avgSpeed.toFixed(1)} / Pwr:${Math.round(d.avgPower)}` }));

    // NEW GROWTH METRICS
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
    
    // Note: Tooltip classes changed from 'fixed' to 'absolute' to allow scrolling
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
