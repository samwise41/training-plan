// js/views/metrics.js

// --- CHARTING HELPER (Responsive & Interactive) ---
const buildMetricChart = (dataPoints, title, color, unitLabel) => {
    if (!dataPoints || dataPoints.length < 2) {
        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-6 flex flex-col items-center justify-center min-h-[200px]">
                <h3 class="text-sm font-bold text-white flex items-center gap-2 mb-2">
                    <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span> ${title}
                </h3>
                <p class="text-xs text-slate-500 italic">Not enough data points found yet.</p>
                <p class="text-[10px] text-slate-600 mt-1">Need at least 2 matching workouts.</p>
            </div>`;
    }

    const width = 800;
    const height = 200;
    const pad = { t: 20, b: 30, l: 40, r: 20 };
    
    // Calculate Scales
    const values = dataPoints.map(d => d.val);
    const minVal = Math.min(...values) * 0.95;
    const maxVal = Math.max(...values) * 1.05;
    const minTime = dataPoints[0].date.getTime();
    const maxTime = dataPoints[dataPoints.length - 1].date.getTime();

    const getX = (d) => pad.l + ((d.date.getTime() - minTime) / (maxTime - minTime)) * (width - pad.l - pad.r);
    const getY = (val) => height - pad.b - ((val - minVal) / (maxVal - minVal)) * (height - pad.t - pad.b);

    // Build Line Path
    let pathD = `M ${getX(dataPoints[0])} ${getY(dataPoints[0].val)}`;
    let pointsHtml = '';

    dataPoints.forEach(d => {
        const x = getX(d);
        const y = getY(d.val);
        pathD += ` L ${x} ${y}`;
        
        pointsHtml += `
            <circle cx="${x}" cy="${y}" r="3" fill="#1e293b" stroke="${color}" stroke-width="2" class="hover:r-5 transition-all cursor-pointer">
                <title>${d.dateStr} (${d.name}): ${d.val.toFixed(2)} ${unitLabel}</title>
            </circle>
        `;
    });

    // Calculate Trend (Simple Average Line for context)
    const n = dataPoints.length;
    const ySum = values.reduce((acc, v) => acc + v, 0);
    const avg = ySum / n;
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
            <div class="w-full overflow-x-auto">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto min-w-[600px] overflow-visible">
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

export function renderMetrics(allData) {
    if (!allData || allData.length === 0) return '<div class="p-8 text-center text-slate-500">No data available yet. Please complete more workouts.</div>';

    // --- 1. SMART FILTERING (Keyword Matching) ---
    
    // Helper to check keywords safely
    const hasKeyword = (item, keywords) => {
        if (!item.planName && !item.actualName) return false;
        const text = ((item.planName || "") + " " + (item.actualName || "")).toLowerCase();
        return keywords.some(k => text.includes(k));
    };

    // A. Aerobic Efficiency (Cycling)
    // Filter: Bike Activities + Keywords (Long, Steady, Endurance, Base)
    // Metric: Power / HR
    const efData = allData
        .filter(d => 
            d.type === 'Bike' && 
            d.avgPower > 0 && d.avgHR > 0 &&
            hasKeyword(d, ['long', 'steady', 'endurance', 'base', 'z2', 'zone 2'])
        )
        .map(d => ({
            date: d.date,
            dateStr: d.date.toISOString().split('T')[0],
            name: d.planName || d.actualName,
            val: d.avgPower / d.avgHR
        }))
        .sort((a,b) => a.date - b.date);

    // B. Strength Endurance (Cycling)
    // Filter: Bike Activities + Keywords (Strength, Hill, Low Cadence, Torque)
    // Metric: Power / Cadence (Torque Proxy)
    const torqueData = allData
        .filter(d => 
            d.type === 'Bike' && 
            d.avgPower > 0 && d.avgCadence > 0 &&
            hasKeyword(d, ['strength', 'hill', 'climb', 'torque', 'force'])
        )
        .map(d => ({
            date: d.date,
            dateStr: d.date.toISOString().split('T')[0],
            name: d.planName || d.actualName,
            val: d.avgPower / d.avgCadence
        }))
        .sort((a,b) => a.date - b.date);

    // C. Running Economy
    // Filter: Run Activities + Keywords (Tempo, Threshold, Speed, Interval)
    // Metric: Speed (Efficiency Index) / HR
    // Speed in Garmin is m/s. We multiply by 60 to get m/min relative to HR
    const runEconData = allData
        .filter(d => 
            d.type === 'Run' && 
            d.avgSpeed > 0 && d.avgHR > 0 &&
            hasKeyword(d, ['tempo', 'threshold', 'speed', 'interval', 'fartlek'])
        )
        .map(d => ({
            date: d.date,
            dateStr: d.date.toISOString().split('T')[0],
            name: d.planName || d.actualName,
            val: (d.avgSpeed * 60) / d.avgHR 
        }))
        .sort((a,b) => a.date - b.date);

    // --- 2. RENDER LAYOUT ---
    return `
        <div class="max-w-5xl mx-auto space-y-8">
            
            <div class="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <h2 class="text-xl font-bold text-white mb-2">Performance Signatures</h2>
                <p class="text-sm text-slate-400">
                    These charts automatically detect your key workout types based on naming conventions (e.g. "Hill", "Tempo", "Long") regardless of which day they were performed.
                </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="col-span-1 lg:col-span-2">
                    <div class="bg-slate-800 border border-slate-700 p-6 rounded-xl">
                        <div class="mb-4 flex justify-between items-start">
                            <div>
                                <h2 class="text-xl font-bold text-white">1. Aerobic Efficiency (Cardiac Drift)</h2>
                                <p class="text-xs text-slate-400 mt-1">Matches: "Long", "Steady", "Endurance"</p>
                            </div>
                            <div class="text-right">
                                <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider">Goal: Increasing Trend</span>
                            </div>
                        </div>
                        ${buildMetricChart(efData, "Efficiency Factor (Watts / BPM)", "#10b981", "EF")}
                        <div class="text-xs text-slate-500 bg-slate-900/50 p-3 rounded border border-slate-700/50">
                            <strong>Coach's Note:</strong> This tracks your <strong>Century Readiness</strong>. We want to see this line go UP (producing more watts at the same heart rate) or stay flat as ride duration increases. A dropping line on long rides indicates cardiac drift (fatigue).
                        </div>
                    </div>
                </div>

                <div>
                    <div class="bg-slate-800 border border-slate-700 p-6 rounded-xl h-full flex flex-col">
                        <div class="mb-4">
                            <h2 class="text-lg font-bold text-white">2. Strength Endurance</h2>
                            <p class="text-xs text-slate-400 mt-1">Matches: "Strength", "Hill", "Climb"</p>
                        </div>
                        <div class="flex-1">
                            ${buildMetricChart(torqueData, "Torque Index (Power / Cadence)", "#8b5cf6", "idx")}
                        </div>
                        <div class="mt-4 pt-3 border-t border-slate-700/50 text-[10px] text-slate-500">
                            <strong>Jordanelle Prep:</strong> Higher values mean you are pushing harder gears at lower cadences (muscular force) without HR spiking.
                        </div>
                    </div>
                </div>

                <div>
                    <div class="bg-slate-800 border border-slate-700 p-6 rounded-xl h-full flex flex-col">
                        <div class="mb-4">
                            <h2 class="text-lg font-bold text-white">3. Running Economy</h2>
                            <p class="text-xs text-slate-400 mt-1">Matches: "Tempo", "Threshold", "Speed"</p>
                        </div>
                        <div class="flex-1">
                            ${buildMetricChart(runEconData, "Economy Index (Speed / HR)", "#ec4899", "idx")}
                        </div>
                        <div class="mt-4 pt-3 border-t border-slate-700/50 text-[10px] text-slate-500">
                            <strong>Olympic Tri Prep:</strong> Measures how fast you run per heartbeat. An upward trend means you are getting faster at the same physiological cost.
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `;
}
