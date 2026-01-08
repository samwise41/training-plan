// js/views/metrics.js

// --- STATE MANAGEMENT ---
let metricsState = { timeRange: '6m' }; 
let cachedData = [];

// --- GLOBAL HANDLERS ---
window.toggleMetricsTime = (range) => {
    metricsState.timeRange = range;
    updateMetricsCharts();
};

// 1. DATA POINT TOOLTIP
window.showMetricTooltip = (evt, date, name, val, unitLabel, breakdown) => {
    let tooltip = document.getElementById('metric-tooltip-popup');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'metric-tooltip-popup';
        // Added max-w-[90vw] to ensure it never exceeds screen width on mobile
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

// 2. DESCRIPTION TOOLTIP
window.showInfoTooltip = (evt, title, desc) => {
    let tooltip = document.getElementById('metric-info-popup');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'metric-info-popup';
        // Added max-w-[85vw] for mobile safety
        tooltip.className = 'z-50 bg-slate-800 border border-blue-500/50 p-4 rounded-xl shadow-2xl text-xs opacity-0 transition-opacity fixed max-w-[300px] w-[85vw] pointer-events-none text-left';
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
        <h4 class="text-white font-bold mb-3 flex items-center gap-2 border-b border-slate-700 pb-2">
            <i class="fa-solid fa-circle-info text-blue-400"></i> ${title}
        </h4>
        <div class="text-slate-300 leading-relaxed space-y-3">
            ${desc}
        </div>
    `;
    positionTooltip(evt, tooltip);
};

window.hideInfoTooltip = () => {
    const tooltip = document.getElementById('metric-info-popup');
    if (tooltip) {
        tooltip.classList.add('opacity-0');
        // Delay adding pointer-events-none to allow fade out
        setTimeout(() => tooltip.classList.add('pointer-events-none'), 300);
    }
};

// --- SMART POSITIONING LOGIC ---
const positionTooltip = (evt, el) => {
    // 1. Get Dimensions
    const x = evt.clientX;
    const y = evt.clientY;
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    
    // Make visible briefly to calculate dimensions if needed, 
    // but usually offsetWidth works if element is in DOM.
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    // 2. Horizontal Logic (Prevent Right/Left Overflow)
    let left = x + 15; // Default: Right of cursor
    
    // If it hits right edge, flip to left
    if (left + w > vW - 10) {
        left = x - w - 15;
    }
    
    // If flipping left hits left edge, force clamp to 10px
    if (left < 10) left = 10;

    // 3. Vertical Logic (Prevent Top/Bottom Overflow)
    let top = y - h - 15; // Default: Above cursor
    
    // If it hits top edge, flip to below cursor
    if (top < 10) {
        top = y + 25;
    }

    // 4. Apply
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.right = 'auto'; // Clear defaults
    
    // 5. Show & Set Timer
    el.classList.remove('opacity-0', 'pointer-events-none');
    
    if (window.metricTooltipTimer) clearTimeout(window.metricTooltipTimer);
    window.metricTooltipTimer = setTimeout(() => {
        el.classList.add('opacity-0');
        setTimeout(() => el.classList.add('pointer-events-none'), 300);
    }, 8000); // 8 Seconds duration
};

// --- DEFINITIONS ---
const METRIC_DEFINITIONS = {
    endurance: {
        title: "Aerobic Efficiency",
        icon: "fa-bicycle", 
        styleClass: "icon-bike",
        keywords: ["long", "steady", "endurance", "base", "z2", "zone 2", "recovery"],
        description: "<strong>The Engine Check.</strong><br>Are you producing more Power for the same Heart Rate?<br><br>📈 <strong>Trend UP:</strong> Good. Your heart is working less to do the same work.<br>📉 <strong>Trend DOWN:</strong> Fatigue or Cardiac Drift.",
        improvement: "<strong>How to Improve:</strong><br>• <strong>Z2 Volume:</strong> Long, steady rides (2-4hrs) without coasting.<br>• <strong>Pacing:</strong> Do not surge on hills. Keep effort flat.<br>• <strong>Consistency:</strong> Stack back-to-back aerobic days."
    },
    strength: {
        title: "Strength & Torque",
        icon: "fa-bicycle",
        styleClass: "icon-bike",
        keywords: ["strength", "hill", "climb", "torque", "force", "alpe", "ftp", "race", "test", "threshold", "tempo", "sweet spot", "interval"],
        description: "<strong>The Muscle Check.</strong><br>Measures Watts per Revolution. High values mean you are pushing bigger gears (Force) rather than just spinning fast (Cardio).<br><br>🎯 <strong>Goal:</strong> Steady increase during 'Hill' blocks.",
        improvement: "<strong>How to Improve:</strong><br>• <strong>Low Cadence Intervals:</strong> 3x10min @ Sweet Spot at 50-60 RPM.<br>• <strong>Hill Repeats:</strong> Seated climbing on steep gradients.<br>• <strong>Gym:</strong> Heavy squats and deadlifts."
    },
    run: {
        title: "Running Economy",
        icon: "fa-person-running",
        styleClass: "icon-run",
        keywords: ["tempo", "threshold", "speed", "interval", "fartlek", "long", "base", "z2"],
        description: "<strong>The Efficiency Check.</strong><br>How fast do you run per heartbeat?<br><br>📈 <strong>Trend UP:</strong> You are getting faster at the same physiological cost.",
        improvement: "<strong>How to Improve:</strong><br>• <strong>Strides:</strong> 6x20sec fast bursts after easy runs.<br>• <strong>Hill Sprints:</strong> Short, max effort sprints (10-15s) to recruit muscle.<br>• <strong>Plyometrics:</strong> Box jumps and jump rope."
    },
    mechanical: {
        title: "Mechanical Efficiency",
        icon: "fa-person-running",
        styleClass: "icon-run",
        keywords: ["run", "tempo", "threshold", "speed", "interval", "long", "base", "z2"],
        description: "<strong>The Form Check.</strong><br>Speed vs. Power. Are you converting raw Watts into actual Speed?<br><br>📈 <strong>Trend UP:</strong> Good form (stiffness).<br>📉 <strong>Trend DOWN:</strong> Sloppy form (bouncing up/down).",
        improvement: "<strong>How to Improve:</strong><br>• <strong>Cadence:</strong> Aim for 170-180 spm to reduce ground contact time.<br>• <strong>Drills:</strong> A-Skips, B-Skips, and High Knees.<br>• <strong>Core:</strong> Planks and stability work to stop energy leaks."
    }
};

// --- CHARTING HELPER ---
const buildMetricChart = (dataPoints, key, color, unitLabel) => {
    const def = METRIC_DEFINITIONS[key];
    
    if (!dataPoints || dataPoints.length < 2) {
        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-6 flex flex-col items-center justify-center min-h-[200px] h-full">
                <h3 class="text-sm font-bold text-white flex items-center gap-2 mb-2">
                    <i class="fa-solid ${def.icon} text-slate-500"></i> ${def.title}
                </h3>
                <p class="text-xs text-slate-500 italic">Not enough data in this range.</p>
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
        pointsHtml += `
            <circle cx="${x}" cy="${y}" r="4" fill="#1e293b" stroke="${color}" stroke-width="2" 
                class="hover:r-6 hover:stroke-white transition-all cursor-pointer"
                onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown}')">
            </circle>
        `;
    });

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const avgY = getY(avg);

    // Prepare Tooltip Content (Description + Improvement)
    const tooltipContent = `${def.description}<div class='border-t border-slate-600 my-2'></div>${def.improvement}`.replace(/'/g, "\\'").replace(/\n/g, "");

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-6 h-full flex flex-col">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
                        <i class="fa-solid ${def.icon} ${def.styleClass} text-lg"></i>
                    </div>
                    
                    <div class="flex flex-col">
                        <h3 class="text-sm font-bold text-white flex items-center gap-2">
                            ${def.title}
                            <i class="fa-solid fa-circle-info text-slate-500 hover:text-blue-400 cursor-pointer text-xs"
                               onmouseenter="window.showInfoTooltip(event, '${def.title}', '${tooltipContent}')"
                               onclick="window.showInfoTooltip(event, '${def.title}', '${tooltipContent}')"
                               onmouseleave="window.hideInfoTooltip()"></i>
                        </h3>
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
                    <text x="${width-pad.r}" y="${avgY - 5}" text-anchor="end" fill="#64748b" font-size="9">AVG</text>
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    ${pointsHtml}
                    <text x="${pad.l}" y="${height-10}" fill="#64748b" font-size="10" font-family="monospace">${dataPoints[0].dateStr}</text>
                    <text x="${width-pad.r}" y="${height-10}" text-anchor="end" fill="#64748b" font-size="10" font-family="monospace">${dataPoints[dataPoints.length-1].dateStr}</text>
                </svg>
            </div>
        </div>
    `;
};

// --- DATA UPDATE & FILTERING ---
const updateMetricsCharts = () => {
    if (!cachedData || cachedData.length === 0) return;

    const now = new Date();
    const cutoff = new Date();
    
    if (metricsState.timeRange === '30d') cutoff.setDate(now.getDate() - 30);
    else if (metricsState.timeRange === '60d') cutoff.setDate(now.getDate() - 60);
    else if (metricsState.timeRange === '90d') cutoff.setDate(now.getDate() - 90);
    else if (metricsState.timeRange === '6m') cutoff.setMonth(now.getMonth() - 6);
    
    const filteredData = cachedData.filter(d => d.date >= cutoff);

    const hasKeyword = (item, keywords) => {
        if (!item.planName && !item.actualName) return false;
        const text = ((item.planName || "") + " " + (item.actualName || "")).toLowerCase();
        return keywords.some(k => text.includes(k));
    };

    // A. ENDURANCE
    const efData = filteredData
        .filter(d => d.type === 'Bike' && d.avgPower > 0 && d.avgHR > 0 && hasKeyword(d, METRIC_DEFINITIONS.endurance.keywords))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.planName || d.actualName, val: d.avgPower / d.avgHR, breakdown: `Pwr: ${Math.round(d.avgPower)}W / HR: ${Math.round(d.avgHR)}` }))
        .sort((a,b) => a.date - b.date);

    // B. STRENGTH
    const torqueData = filteredData
        .filter(d => d.type === 'Bike' && d.avgPower > 0 && d.avgCadence > 0 && hasKeyword(d, METRIC_DEFINITIONS.strength.keywords))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.planName || d.actualName, val: d.avgPower / d.avgCadence, breakdown: `Pwr: ${Math.round(d.avgPower)}W / RPM: ${Math.round(d.avgCadence)}` }))
        .sort((a,b) => a.date - b.date);

    // C. ECONOMY
    const runEconData = filteredData
        .filter(d => d.type === 'Run' && d.avgSpeed > 0 && d.avgHR > 0 && hasKeyword(d, METRIC_DEFINITIONS.run.keywords))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.planName || d.actualName, val: (d.avgSpeed * 60) / d.avgHR, breakdown: `Pace: ${Math.round(d.avgSpeed * 60)} m/m / HR: ${Math.round(d.avgHR)}` }))
        .sort((a,b) => a.date - b.date);

    // D. MECHANICS
    const mechData = filteredData
        .filter(d => d.type === 'Run' && d.avgSpeed > 0 && d.avgPower > 0 && hasKeyword(d, METRIC_DEFINITIONS.mechanical.keywords))
        .map(d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.planName || d.actualName, val: (d.avgSpeed * 100) / d.avgPower, breakdown: `Spd: ${d.avgSpeed.toFixed(2)} m/s / Pwr: ${Math.round(d.avgPower)}W` }))
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
        if(btn) {
            const isActive = metricsState.timeRange === range;
            btn.className = isActive 
                ? "bg-slate-200 text-slate-900 font-bold border border-transparent px-3 py-1 rounded text-xs transition-all hover:opacity-90"
                : "bg-slate-800 text-slate-400 border border-slate-600 px-3 py-1 rounded text-xs transition-all hover:opacity-90 hover:text-white";
        }
    });
};

// --- MAIN RENDER ---
export function renderMetrics(allData) {
    cachedData = allData || [];

    const buildToggle = (range, label) => `
        <button id="btn-metric-${range}" onclick="window.toggleMetricsTime('${range}')" 
            class="bg-slate-800 text-slate-400 border border-slate-600 px-3 py-1 rounded text-xs transition-all hover:opacity-90">
            ${label}
        </button>
    `;

    setTimeout(updateMetricsCharts, 0);

    return `
        <div class="max-w-7xl mx-auto space-y-8">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 class="text-xl font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-microchip text-blue-500"></i> Performance Metrics
                    </h2>
                    <p class="text-xs text-slate-400 mt-1">Analyzing physiological trends based on Garmin data.</p>
                </div>
                <div class="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
                    ${buildToggle('30d', '30 Days')}
                    ${buildToggle('60d', '60 Days')}
                    ${buildToggle('90d', '90 Days')}
                    ${buildToggle('6m', '6 Months')}
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div id="metric-chart-endurance" class="h-full"></div>
                <div id="metric-chart-strength" class="h-full"></div>
                <div id="metric-chart-economy" class="h-full"></div>
                <div id="metric-chart-mechanics" class="h-full"></div>
            </div>
        </div>
        
        <div id="metric-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed min-w-[150px]"></div>
    `;
}
