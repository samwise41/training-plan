// js/views/metrics.js

// --- GLOBAL TOOLTIP HANDLER FOR METRICS ---
window.showMetricTooltip = (evt, date, name, val, unitLabel, breakdown) => {
    let tooltip = document.getElementById('metric-tooltip-popup');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'metric-tooltip-popup';
        tooltip.className = 'z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed min-w-[150px]';
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
        <div class="text-center">
            <div class="text-[10px] text-slate-400 font-normal mb-1 border-b border-slate-700 pb-1">
                ${date}
            </div>
            <div class="text-white font-bold text-sm mb-1 text-wrap max-w-[200px] leading-tight">
                ${name}
            </div>
            <div class="text-emerald-400 font-mono font-bold text-lg mb-1">
                ${val} <span class="text-[10px] text-slate-500">${unitLabel}</span>
            </div>
            <div class="text-[10px] text-slate-300 font-mono bg-slate-800 rounded px-2 py-1 mt-1 inline-block border border-slate-700">
                ${breakdown}
            </div>
        </div>
    `;

    const x = evt.clientX;
    const y = evt.clientY;
    const viewportWidth = window.innerWidth;
    
    // Position above the cursor
    tooltip.style.top = `${y - 100}px`; 
    
    // Smart horizontal positioning
    if (x > viewportWidth * 0.60) {
        tooltip.style.right = `${viewportWidth - x + 10}px`;
        tooltip.style.left = 'auto';
    } else {
        tooltip.style.left = `${x - 75}px`; 
        tooltip.style.right = 'auto';
    }
    
    tooltip.classList.remove('opacity-0');
    
    if (window.metricTooltipTimer) clearTimeout(window.metricTooltipTimer);
    window.metricTooltipTimer = setTimeout(() => {
        tooltip.classList.add('opacity-0');
    }, 4000);
};

// --- DEFINITIONS ---
const METRIC_DEFINITIONS = {
    endurance: {
        title: "Aerobic Efficiency",
        purpose: "Base Building & Cardiac Drift",
        keywords: ["long", "steady", "endurance", "base", "z2", "zone 2", "recovery"],
        description: "Workouts focused on mitochondrial density. We want to see Power staying high while Heart Rate stays low."
    },
    strength: {
        title: "Strength & Power",
        purpose: "Force Production & Threshold",
        keywords: ["strength", "hill", "climb", "torque", "force", "alpe", "ftp", "race", "test", "threshold", "tempo", "sweet spot", "interval"],
        description: "High-load sessions. Includes Hill Climbs (Alpe du Zwift), FTP Tests, and Races. Tracks 'Torque' (Power per Revolution)."
    },
    run: {
        title: "Running Economy",
        purpose: "Speed Efficiency",
        keywords: ["tempo", "threshold", "speed", "interval", "fartlek", "long", "base", "z2"],
        description: "Measures how fast you run for every heartbeat. Includes both fast Tempo runs and steady Long Runs."
    }
};

// --- CHARTING HELPER ---
const buildMetricChart = (dataPoints, title, color, unitLabel) => {
    if (!dataPoints || dataPoints.length < 2) {
        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-6 flex flex-col items-center justify-center min-h-[200px]">
                <h3 class="text-sm font-bold text-white flex items-center gap-2 mb-2">
                    <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span> ${title}
                </h3>
                <p class="text-xs text-slate-500 italic">Not enough data points found.</p>
                <p class="text-[10px] text-slate-600 mt-1">Complete at least 2 matching workouts.</p>
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
        const valStr = d.val.toFixed(2);
        
        // Pass specific breakdown data for the tooltip
        const breakdown = d.breakdown || "";
        
        pathD += ` L ${x} ${y}`;
        
        pointsHtml += `
            <circle cx="${x}" cy="${y}" r="4" fill="#1e293b" stroke="${color}" stroke-width="2" 
                class="hover:r-6 hover:stroke-white transition-all cursor-pointer"
                onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${valStr}', '${unitLabel}', '${breakdown}')">
            </circle>
        `;
    });

    const n = dataPoints.length;
    const avg = values.reduce((a, b) => a + b, 0) / n;
    const avgY = getY(avg);

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-6">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span> ${title}
                </h3>
                <div class="text-right">
                    <span class="text-[10px] font-mono text-slate-400 block">Avg: ${avg.toFixed(2)}</span>
                    <span class="text-xs font-bold text-white block">Last: ${values[values.length-1].toFixed(2)}</span>
                </div>
            </div>
            
            <div class="w-full">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible">
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

// --- MAIN RENDER ---
export function renderMetrics(allData) {
    if (!allData || allData.length === 0) return '<div class="p-8 text-center text-slate-500">No data available yet. Please complete more workouts.</div>';

    const hasKeyword = (item, keywords) => {
        if (!item.planName && !item.actualName) return false;
        const text = ((item.planName || "") + " " + (item.actualName || "")).toLowerCase();
        return keywords.some(k => text.includes(k));
    };

    // 1. ENDURANCE (Aerobic Efficiency)
    const efData = allData
        .filter(d => 
            d.type === 'Bike' && d.avgPower > 0 && d.avgHR > 0 &&
            hasKeyword(d, METRIC_DEFINITIONS.endurance.keywords)
        )
        .map(d => ({
            date: d.date,
            dateStr: d.date.toISOString().split('T')[0],
            name: d.planName || d.actualName,
            val: d.avgPower / d.avgHR,
            breakdown: `Pwr: ${Math.round(d.avgPower)}W / HR: ${Math.round(d.avgHR)}`
        }))
        .sort((a,b) => a.date - b.date);

    // 2. STRENGTH (Torque / Force)
    const torqueData = allData
        .filter(d => 
            d.type === 'Bike' && d.avgPower > 0 && d.avgCadence > 0 &&
            hasKeyword(d, METRIC_DEFINITIONS.strength.keywords)
        )
        .map(d => ({
            date: d.date,
            dateStr: d.date.toISOString().split('T')[0],
            name: d.planName || d.actualName,
            val: d.avgPower / d.avgCadence,
            breakdown: `Pwr: ${Math.round(d.avgPower)}W / RPM: ${Math.round(d.avgCadence)}`
        }))
        .sort((a,b) => a.date - b.date);

    // 3. RUN ECONOMY (Efficiency)
    const runEconData = allData
        .filter(d => 
            d.type === 'Run' && d.avgSpeed > 0 && d.avgHR > 0 &&
            hasKeyword(d, METRIC_DEFINITIONS.run.keywords)
        )
        .map(d => ({
            date: d.date,
            dateStr: d.date.toISOString().split('T')[0],
            name: d.planName || d.actualName,
            val: (d.avgSpeed * 60) / d.avgHR,
            breakdown: `Pace: ${Math.round(d.avgSpeed * 60)} m/m / HR: ${Math.round(d.avgHR)}`
        }))
        .sort((a,b) => a.date - b.date);

    return `
        <div class="max-w-5xl mx-auto space-y-8">
            <div class="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <i class="fa-solid fa-tags text-blue-500"></i> Workout Categorization Logic
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-slate-900/50 p-3 rounded border border-slate-700/50 text-[10px] md:text-xs">
                        <h4 class="font-bold text-white mb-1 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> ${METRIC_DEFINITIONS.endurance.title}</h4>
                        <p class="text-slate-400 mb-2">${METRIC_DEFINITIONS.endurance.purpose}</p>
                    </div>
                    <div class="bg-slate-900/50 p-3 rounded border border-slate-700/50 text-[10px] md:text-xs">
                        <h4 class="font-bold text-white mb-1 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-violet-500"></span> ${METRIC_DEFINITIONS.strength.title}</h4>
                        <p class="text-slate-400 mb-2">${METRIC_DEFINITIONS.strength.purpose}</p>
                    </div>
                    <div class="bg-slate-900/50 p-3 rounded border border-slate-700/50 text-[10px] md:text-xs">
                        <h4 class="font-bold text-white mb-1 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-pink-500"></span> ${METRIC_DEFINITIONS.run.title}</h4>
                        <p class="text-slate-400 mb-2">${METRIC_DEFINITIONS.run.purpose}</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                <div class="col-span-1 lg:col-span-2">
                    <div class="bg-slate-800 border border-slate-700 p-6 rounded-xl">
                        <div class="mb-4">
                            <h2 class="text-xl font-bold text-white">1. Aerobic Efficiency (EF)</h2>
                            <p class="text-sm text-slate-400">Power output per heartbeat.</p>
                        </div>
                        ${buildMetricChart(efData, "Efficiency Factor (Watts / BPM)", "#10b981", "EF")}
                    </div>
                </div>

                <div>
                    <div class="bg-slate-800 border border-slate-700 p-6 rounded-xl h-full flex flex-col">
                        <div class="mb-4">
                            <h2 class="text-lg font-bold text-white">2. Strength & Power</h2>
                            <p class="text-xs text-slate-400">Torque Analysis (Watts per RPM).</p>
                        </div>
                        <div class="flex-1">
                            ${buildMetricChart(torqueData, "Torque Index", "#8b5cf6", "idx")}
                        </div>
                    </div>
                </div>

                <div>
                    <div class="bg-slate-800 border border-slate-700 p-6 rounded-xl h-full flex flex-col">
                        <div class="mb-4">
                            <h2 class="text-lg font-bold text-white">3. Running Economy</h2>
                            <p class="text-xs text-slate-400">Speed per heartbeat.</p>
                        </div>
                        <div class="flex-1">
                            ${buildMetricChart(runEconData, "Economy Index", "#ec4899", "idx")}
                        </div>
                    </div>
                </div>

            </div>
        </div>
        <div id="metric-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed min-w-[150px]"></div>
    `;
}
