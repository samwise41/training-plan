// js/views/metrics.js

// --- STATE MANAGEMENT ---
let metricsState = { timeRange: '6m' };
let cachedData = [];

// --- TOOLTIP STATE MANAGER ---
let activeTooltips = {
    data: null,   // Chart dots
    static: null  // Analysis icon
};
let tooltipTimers = {
    data: null,
    static: null
};

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

    if (activeTooltips[channel] && activeTooltips[channel].trigger === triggerEl) {
        closeTooltip(channel);
        return;
    }

    closeTooltip(channel);

    const tooltip = document.getElementById(id);
    if (!tooltip) return;

    tooltip.innerHTML = contentHTML;
    tooltip.classList.remove('opacity-0', 'pointer-events-none');

    const x = evt.pageX;
    const y = evt.pageY;
    const viewportWidth = window.innerWidth;

    // Horizontal Position
    if (x > viewportWidth * 0.6) {
        tooltip.style.right = `${viewportWidth - x + 10}px`;
        tooltip.style.left = 'auto';
    } else {
        tooltip.style.left = `${x + 10}px`;
        tooltip.style.right = 'auto';
    }
    
    // Vertical Position
    if (channel === 'data') {
        tooltip.style.top = `${y - tooltip.offsetHeight - 15}px`;
    } else {
        tooltip.style.top = `${y + 20}px`;
    }

    activeTooltips[channel] = { id, trigger: triggerEl };

    if (tooltipTimers[channel]) clearTimeout(tooltipTimers[channel]);
    tooltipTimers[channel] = setTimeout(() => closeTooltip(channel), 10000);
};

window.addEventListener('click', (e) => {
    ['data', 'static'].forEach(channel => {
        const active = activeTooltips[channel];
        if (active) {
            const tooltipEl = document.getElementById(active.id);
            if (tooltipEl && tooltipEl.contains(e.target)) {
                closeTooltip(channel);
                return;
            }
            if (e.target !== active.trigger) {
                closeTooltip(channel);
            }
        }
    });
});

window.toggleMetricsTime = (range) => {
    metricsState.timeRange = range;
    updateMetricsCharts();
};

window.hideMetricTooltip = () => {
    closeTooltip('all');
};

// --- DEFINITIONS ---
const METRIC_DEFINITIONS = {
    // BIKE METRICS
    endurance: {
        title: "Aerobic Efficiency",
        sport: "Bike",
        icon: "fa-bicycle",
        colorVar: "var(--color-bike)",
        refMin: 1.30, refMax: 1.70,
        invertRanges: false,
        rangeInfo: "1.30 – 1.70 EF",
        description: "Watts produced per heartbeat. Rising values mean your engine is getting more efficient.",
        improvement: "• Long Z2 Rides<br>• Consistent Volume"
    },
    strength: {
        title: "Torque Efficiency",
        sport: "Bike",
        icon: "fa-bicycle",
        colorVar: "var(--color-bike)",
        refMin: 2.5, refMax: 3.5,
        invertRanges: false,
        rangeInfo: "2.5 – 3.5 W/RPM",
        description: "Watts per Revolution. High values indicate strong muscular force application (pushing bigger gears).",
        improvement: "• Low Cadence Intervals (50-60 RPM)<br>• Seated Climbing"
    },
    // RUN METRICS
    run: {
        title: "Running Economy",
        sport: "Run",
        icon: "fa-person-running",
        colorVar: "var(--color-run)",
        // FIXED RANGE: Meters per Heartbeat. 1.0 (Fair) to 1.6 (Elite)
        refMin: 1.0, refMax: 1.6,
        invertRanges: false,
        rangeInfo: "1.0 – 1.6 m/beat",
        description: "Distance traveled per heartbeat. A higher number means you run faster at a lower cardiac cost.",
        improvement: "• Strides & Hill Sprints<br>• Plyometrics"
    },
    mechanical: {
        title: "Mechanical Stiffness",
        sport: "Run",
        icon: "fa-person-running",
        colorVar: "var(--color-run)",
        refMin: 0.75, refMax: 0.95,
        invertRanges: false,
        rangeInfo: "0.75 – 0.95 Ratio",
        description: "Ratio of Speed vs. Power. Indicates how well you convert raw power into forward motion.",
        improvement: "• High Cadence (170+)<br>• Form Drills (A-Skips)"
    },
    gct: {
        title: "Ground Contact Time",
        sport: "Run",
        icon: "fa-person-running",
        colorVar: "var(--color-run)",
        refMin: 220, refMax: 260,
        invertRanges: true, // Lower is Better
        rangeInfo: "< 260 ms",
        description: "Time spent on the ground each step. Lower values indicate better tendon elasticity.",
        improvement: "• Increase Cadence<br>• 'Hot Coals' Imagery"
    },
    vert: {
        title: "Vertical Oscillation",
        sport: "Run",
        icon: "fa-person-running",
        colorVar: "var(--color-run)",
        refMin: 6.0, refMax: 9.0,
        invertRanges: true, // Lower is Better
        rangeInfo: "6.0 – 9.0 cm",
        description: "Vertical bounce. Too much bounce wastes energy moving UP instead of FORWARD.",
        improvement: "• Core Stability<br>• Hill Repeats"
    },
    // PHYSIOLOGY (ALL)
    vo2max: {
        title: "VO₂ Max Trend",
        sport: "All",
        icon: "fa-heart-pulse",
        colorVar: "var(--color-all)",
        refMin: 45, refMax: 60,
        invertRanges: false,
        rangeInfo: "45 – 60+",
        description: "Your aerobic ceiling. An upward trend proves your cardiovascular engine is growing.",
        improvement: "• VO2 Max Intervals (3-5m)<br>• Years of Consistency"
    },
    tss: {
        title: "Weekly TSS Load",
        sport: "All",
        icon: "fa-layer-group",
        colorVar: "var(--color-all)",
        refMin: 300, refMax: 600,
        invertRanges: false,
        rangeInfo: "300 – 600 TSS",
        description: "Total physiological load. Rising TSS with stable fatigue indicates increased work capacity.",
        improvement: "• Increase Volume<br>• Increase Intensity (IF)"
    },
    anaerobic: {
        title: "Anaerobic Impact",
        sport: "All",
        icon: "fa-fire",
        colorVar: "#ef4444", // Keep Red for Intensity
        refMin: 2.0, refMax: 4.0,
        invertRanges: false,
        rangeInfo: "2.0 – 4.0 (Intervals)",
        description: "Training Effect on interval days. Ensures you are hitting the high-intensity stimulus needed for growth.",
        improvement: "• All-out Sprints<br>• Full Recovery Between Sets"
    }
};

// --- CONSOLIDATED TOOLTIP TRIGGER ---
window.showAnalysisTooltip = (evt, key) => {
    const def = METRIC_DEFINITIONS[key];
    
    // Range Bar Logic
    const rangeColor = def.invertRanges 
        ? "bg-gradient-to-r from-emerald-500 to-red-500" 
        : "bg-gradient-to-r from-red-500 to-emerald-500";

    const html = `
        <div class="w-[280px] space-y-3">
            <div class="flex items-center gap-2 border-b border-slate-700 pb-2">
                <i class="fa-solid ${def.icon} text-lg" style="color: ${def.colorVar}"></i>
                <div>
                    <h4 class="text-white font-bold text-sm leading-none">${def.title}</h4>
                    <span class="text-[10px] text-slate-400 font-mono">${def.sport.toUpperCase()} METRIC</span>
                </div>
            </div>

            <div class="text-xs text-slate-300 leading-relaxed">
                ${def.description}
            </div>

            <div class="bg-slate-800/50 rounded p-2 border border-slate-700">
                <div class="flex justify-between items-end mb-1">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Target Range</span>
                    <span class="text-xs font-mono font-bold text-emerald-400">${def.rangeInfo}</span>
                </div>
                <div class="h-1.5 w-full rounded-full ${rangeColor} opacity-80"></div>
                <div class="flex justify-between text-[8px] text-slate-500 mt-1 font-mono">
                    <span>${def.invertRanges ? "Lower is Better" : "Floor"}</span>
                    <span>${def.invertRanges ? "Ceiling" : "Higher is Better"}</span>
                </div>
            </div>

            <div>
                <span class="text-[10px] font-bold text-blue-400 uppercase tracking-wide">How to Improve</span>
                <div class="text-[11px] text-slate-400 mt-1 pl-2 border-l-2 border-blue-500/30">
                    ${def.improvement}
                </div>
            </div>
            
            <div class="text-[9px] text-slate-600 text-center pt-1 italic">Click anywhere to close</div>
        </div>`;
    
    manageTooltip(evt, 'metric-info-popup', html, 'static');
};

window.showMetricTooltip = (evt, date, name, val, unitLabel, breakdown, colorVar) => {
    const html = `
        <div class="text-center min-w-[100px]">
            <div class="text-[10px] text-slate-400 mb-1 border-b border-slate-700 pb-1">${date}</div>
            <div class="text-white font-bold text-xs mb-1">${name}</div>
            <div class="font-mono font-bold text-xl" style="color: ${colorVar}">${val} <span class="text-[10px] text-slate-500">${unitLabel}</span></div>
            ${breakdown ? `<div class="text-[10px] text-slate-300 font-mono bg-slate-800 rounded px-2 py-0.5 mt-1 border border-slate-700">${breakdown}</div>` : ''}
        </div>`;
    manageTooltip(evt, 'metric-tooltip-popup', html, 'data');
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

const buildMetricChart = (dataPoints, key) => {
    const def = METRIC_DEFINITIONS[key];
    const unitLabel = def.rangeInfo.split(' ').pop(); // Extract unit from range string
    const color = def.colorVar;

    if (!dataPoints || dataPoints.length < 2) {
        return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col justify-between">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-xs font-bold text-white flex items-center gap-2">
                    <i class="fa-solid ${def.icon}" style="color: ${color}"></i> ${def.title}
                </h3>
            </div>
            <div class="flex-1 flex items-center justify-center"><p class="text-xs text-slate-500 italic">No data available.</p></div>
        </div>`;
    }

    const width = 800, height = 150;
    const pad = { t: 20, b: 30, l: 50, r: 20 };
    const getX = (d, i) => pad.l + (i / (dataPoints.length - 1)) * (width - pad.l - pad.r);
    
    // Scale Logic
    const dataValues = dataPoints.map(d => d.val);
    let minV = Math.min(...dataValues);
    let maxV = Math.max(...dataValues);

    if (def.refMin !== undefined) minV = Math.min(minV, def.refMin);
    if (def.refMax !== undefined) maxV = Math.max(maxV, def.refMax);

    const range = maxV - minV;
    const buf = range * 0.15 || (maxV * 0.1); 
    const domainMin = Math.max(0, minV - buf);
    const domainMax = maxV + buf;

    const getY = (val) => height - pad.b - ((val - domainMin) / (domainMax - domainMin)) * (height - pad.t - pad.b);

    // Reference Lines (Red/Green Logic)
    let refLinesHtml = '';
    if (def.refMin !== undefined && def.refMax !== undefined) {
        const yMin = getY(def.refMin);
        const yMax = getY(def.refMax);
        
        const colorMax = def.invertRanges ? '#ef4444' : '#10b981'; // Red or Green
        const colorMin = def.invertRanges ? '#10b981' : '#ef4444'; // Green or Red

        if (yMin >= pad.t && yMin <= height - pad.b) {
            refLinesHtml += `<line x1="${pad.l}" y1="${yMin}" x2="${width - pad.r}" y2="${yMin}" stroke="${colorMin}" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />`;
        }
        if (yMax >= pad.t && yMax <= height - pad.b) {
            refLinesHtml += `<line x1="${pad.l}" y1="${yMax}" x2="${width - pad.r}" y2="${yMax}" stroke="${colorMax}" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />`;
        }
    }

    // Axis
    const yAxisLine = `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" stroke="#475569" stroke-width="1" />`;
    const yMid = (domainMin + domainMax) / 2;
    const axisLabelsHtml = `
        <text x="${pad.l - 6}" y="${getY(domainMax) + 4}" text-anchor="end" font-size="9" fill="#64748b">${domainMax.toFixed(1)}</text>
        <text x="${pad.l - 6}" y="${getY(yMid) + 4}" text-anchor="end" font-size="9" fill="#64748b">${yMid.toFixed(1)}</text>
        <text x="${pad.l - 6}" y="${getY(domainMin) + 4}" text-anchor="end" font-size="9" fill="#64748b">${domainMin.toFixed(1)}</text>
    `;

    // Trend & Points
    const trend = calculateTrendline(dataPoints);
    let trendHtml = trend ? `<line x1="${getX(null, 0)}" y1="${getY(trend.startVal)}" x2="${getX(null, dataPoints.length - 1)}" y2="${getY(trend.endVal)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.5" />` : '';
    
    let pathD = `M ${getX(dataPoints[0], 0)} ${getY(dataPoints[0].val)}`;
    let pointsHtml = '';
    dataPoints.forEach((d, i) => {
        const x = getX(d, i), y = getY(d.val);
        pathD += ` L ${x} ${y}`;
        pointsHtml += `<circle cx="${x}" cy="${y}" r="3.5" fill="#0f172a" stroke="${color}" stroke-width="2" class="cursor-pointer hover:stroke-white transition-all" onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown || ""}', '${color}')"></circle>`;
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col hover:border-slate-600 transition-colors">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded flex items-center justify-center bg-slate-800 border border-slate-700">
                        <i class="fa-solid ${def.icon} text-xs" style="color: ${color}"></i>
                    </div>
                    <h3 class="text-xs font-bold text-white uppercase tracking-wide">${def.title}</h3>
                </div>
                <div class="cursor-pointer text-slate-500 hover:text-blue-400 transition-colors" onclick="window.showAnalysisTooltip(event, '${key}')">
                    <i class="fa-solid fa-circle-info text-sm"></i>
                </div>
            </div>
            <div class="flex-1 w-full h-[120px]">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
                    ${yAxisLine}
                    ${axisLabelsHtml}
                    ${refLinesHtml}
                    ${trendHtml}
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.9" />
                    ${pointsHtml}
                </svg>
            </div>
        </div>
    `;
};

// --- DATA AGGREGATION ---
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

    // 1. EFFICIENCY (BIKE)
    const efData = filteredData.filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgHR > 0 && isIntensity(d, ['AEROBIC_BASE', 'RECOVERY']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: d.avgPower / d.avgHR, breakdown: `Pwr:${Math.round(d.avgPower)} / HR:${Math.round(d.avgHR)}` }));

    const torqueData = filteredData.filter(d => d.actualType === 'Bike' && d.avgPower > 0 && d.avgCadence > 0 && isIntensity(d, ['VO2MAX', 'LACTATE_THRESHOLD', 'TEMPO', 'ANAEROBIC_CAPACITY']))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: d.avgPower / d.avgCadence, breakdown: `Pwr:${Math.round(d.avgPower)} / RPM:${Math.round(d.avgCadence)}` }));

    // 2. RUN ECONOMY (Fixed Calculation: Meters / Beat)
    const runEconData = filteredData.filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgHR > 0)
        .map(d => {
            // avgSpeed is m/s. 
            // m/min = speed * 60.
            // m/beat = (m/min) / bpm
            const metersPerMin = d.avgSpeed * 60;
            const metersPerBeat = metersPerMin / d.avgHR;
            return { 
                date: d.date, 
                dateStr: d.date.toISOString().split('T')[0], 
                name: d.actualName, 
                val: metersPerBeat, 
                breakdown: `Pace:${Math.round(metersPerMin)}m/m / HR:${Math.round(d.avgHR)}` 
            };
        });

    const mechData = filteredData.filter(d => d.actualType === 'Run' && d.avgSpeed > 0 && d.avgPower > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: (d.avgSpeed * 100) / d.avgPower, breakdown: `Spd:${d.avgSpeed.toFixed(1)} / Pwr:${Math.round(d.avgPower)}` }));

    // 3. CAPACITY
    const vo2Data = filteredData.filter(d => d.vO2MaxValue > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: "VO2 Estimate", val: parseFloat(d.vO2MaxValue), breakdown: `Score: ${d.vO2MaxValue}` }));

    const fullTss = aggregateWeeklyTSS(cachedData);
    const tssData = fullTss.filter(d => d.date >= cutoff);

    // 4. RUN DYNAMICS
    const gctData = filteredData.filter(d => d.actualType === 'Run' && d.avgGroundContactTime > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: parseFloat(d.avgGroundContactTime), breakdown: `${Math.round(d.avgGroundContactTime)} ms` }));

    const vertData = filteredData.filter(d => d.actualType === 'Run' && d.avgVerticalOscillation > 0)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: parseFloat(d.avgVerticalOscillation), breakdown: `${d.avgVerticalOscillation.toFixed(1)} cm` }));

    const anaData = filteredData.filter(d => d.anaerobicTrainingEffect > 0.5)
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: parseFloat(d.anaerobicTrainingEffect), breakdown: `Anaerobic: ${d.anaerobicTrainingEffect}` }));

    const render = (id, data, key) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = buildMetricChart(data, key);
    };

    render('metric-chart-endurance', efData, 'endurance');
    render('metric-chart-strength', torqueData, 'strength');
    render('metric-chart-economy', runEconData, 'run');
    render('metric-chart-mechanics', mechData, 'mechanical');
    render('metric-chart-vo2', vo2Data, 'vo2max');
    render('metric-chart-tss', tssData, 'tss');
    render('metric-chart-gct', gctData, 'gct');
    render('metric-chart-vert', vertData, 'vert');
    render('metric-chart-anaerobic', anaData, 'anaerobic');

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
        <div id="metric-info-popup" class="z-50 bg-slate-800 border border-blue-500/50 p-4 rounded-xl shadow-2xl text-xs opacity-0 transition-opacity absolute pointer-events-auto cursor-pointer max-w-[320px]"></div>
    `;
}
