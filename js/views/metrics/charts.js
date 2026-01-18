// js/views/metrics/charts.js
import { METRIC_DEFINITIONS } from './definitions.js';
import { calculateTrend, getTrendIcon, checkSport, aggregateWeeklyTSS } from './utils.js';

// --- DATA EXTRACTION ---

const extractChartData = (allData, key) => {
    const valid = (val) => typeof val === 'number' && val > 0;

    switch(key) {
        // --- CYCLING ---
        case 'endurance': 
            return allData.filter(d => checkSport(d, 'BIKE') && valid(d.normPower) && valid(d.avgHR))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: d.normPower / d.avgHR,
                    name: d.actualName,
                    breakdown: `${Math.round(d.normPower)}w / ${Math.round(d.avgHR)}bpm`
                }));

        case 'strength': 
            return allData.filter(d => checkSport(d, 'BIKE') && valid(d.avgPower) && valid(d.avgCadence))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: d.avgPower / d.avgCadence,
                    name: d.actualName,
                    breakdown: `${Math.round(d.avgPower)}w / ${Math.round(d.avgCadence)}rpm`
                }));

        case 'subjective_bike': 
            return allData.filter(d => checkSport(d, 'BIKE') && valid(d.avgPower) && valid(d.RPE))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: d.avgPower / d.RPE,
                    name: d.actualName,
                    breakdown: `${Math.round(d.avgPower)}w / ${d.RPE} RPE`
                }));

        // --- RUNNING ---
        case 'run': 
            return allData.filter(d => checkSport(d, 'RUN') && valid(d.avgSpeed) && valid(d.avgHR))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: (d.avgSpeed * 60) / d.avgHR,
                    name: d.actualName,
                    breakdown: `${(1000/(d.avgSpeed*60)).toFixed(2)} / ${Math.round(d.avgHR)}bpm`
                }));

        case 'subjective_run': 
            return allData.filter(d => checkSport(d, 'RUN') && valid(d.avgSpeed) && valid(d.RPE))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: d.avgSpeed / d.RPE,
                    name: d.actualName,
                    breakdown: `${d.avgSpeed.toFixed(2)}m/s / ${d.RPE} RPE`
                }));

        case 'mechanical': 
            return allData.filter(d => checkSport(d, 'RUN') && valid(d.avgSpeed) && valid(d.avgPower))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: (d.avgSpeed * 100) / d.avgPower,
                    name: d.actualName,
                    breakdown: `${d.avgSpeed.toFixed(1)}m/s / ${Math.round(d.avgPower)}w`
                }));

        case 'gct': 
            return allData.filter(d => checkSport(d, 'RUN') && valid(d.avgGroundContactTime))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: d.avgGroundContactTime,
                    name: d.actualName,
                    breakdown: `${Math.round(d.avgGroundContactTime)}ms`
                }));

        case 'vert': 
            return allData.filter(d => checkSport(d, 'RUN') && valid(d.avgVerticalOscillation))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: d.avgVerticalOscillation,
                    name: d.actualName,
                    breakdown: `${d.avgVerticalOscillation.toFixed(1)}cm`
                }));

        // --- SWIMMING ---
        case 'swim': 
            return allData.filter(d => checkSport(d, 'SWIM') && valid(d.avgSpeed) && valid(d.avgHR))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: (d.avgSpeed * 60) / d.avgHR,
                    name: d.actualName,
                    breakdown: `${(d.avgSpeed*60).toFixed(1)}m/min / ${Math.round(d.avgHR)}bpm`
                }));

        case 'subjective_swim': 
            return allData.filter(d => checkSport(d, 'SWIM') && valid(d.avgSpeed) && valid(d.RPE))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: d.avgSpeed / d.RPE,
                    name: d.actualName,
                    breakdown: `${d.avgSpeed.toFixed(1)}m/s / ${d.RPE} RPE`
                }));

        // --- PHYSIOLOGY ---
        case 'vo2max':
            return allData.filter(d => valid(d.vO2MaxValue))
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: d.vO2MaxValue,
                    name: "VO2 Max",
                    breakdown: `Score: ${d.vO2MaxValue}`
                }));

        case 'anaerobic':
            // Filter: Only significant Anaerobic Impact (>2.0)
            return allData.filter(d => valid(d.anaerobicTrainingEffect) && d.anaerobicTrainingEffect > 2.0)
                .map(d => ({
                    date: d.date,
                    dateStr: d.date.toISOString().split('T')[0],
                    val: d.anaerobicTrainingEffect,
                    name: d.actualName,
                    breakdown: `TE: ${d.anaerobicTrainingEffect}`
                }));

        case 'tss':
            // FIX: Use Weekly Aggregation for Load
            return aggregateWeeklyTSS(allData);

        default:
            return [];
    }
};

// --- CHART BUILDER ---

const buildMetricChart = (displayData, fullData, key) => {
    const def = METRIC_DEFINITIONS[key];
    if (!def) return `<div class="p-4 text-red-500 text-xs">Error: Definition missing for ${key}</div>`;

    const unitLabel = def.rangeInfo ? def.rangeInfo.split(' ').pop() : '';
    const color = def.colorVar;

    // --- TREND INDICATORS ---
    const now = new Date();
    const getSlope = (days) => {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - days);
        const subset = fullData.filter(d => d.date >= cutoff);
        const trend = calculateTrend(subset);
        return trend ? getTrendIcon(trend.slope, def.invertRanges) : { icon: 'fa-minus', color: 'text-slate-600' };
    };
    const t30 = getSlope(30);
    const t90 = getSlope(90);
    const t6m = getSlope(180);

    const indicatorsHtml = `
        <div class="flex gap-1 ml-auto">
            <div class="flex items-center gap-1 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50" title="30d Trend">
                <span class="text-[8px] font-bold text-slate-400">30d</span><i class="fa-solid ${t30.icon} ${t30.color} text-[8px]"></i>
            </div>
            <div class="flex items-center gap-1 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50" title="90d Trend">
                <span class="text-[8px] font-bold text-slate-400">90d</span><i class="fa-solid ${t90.icon} ${t90.color} text-[8px]"></i>
            </div>
            <div class="flex items-center gap-1 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50" title="6m Trend">
                <span class="text-[8px] font-bold text-slate-400">6m</span><i class="fa-solid ${t6m.icon} ${t6m.color} text-[8px]"></i>
            </div>
        </div>`;

    const titleHtml = `
        <h3 class="text-xs font-bold text-white flex items-center gap-2">
            <i class="fa-solid ${def.icon}" style="color: ${color}"></i> 
            ${def.title}
        </h3>
    `;

    if (!displayData || displayData.length < 2) {
        return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col justify-between">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                ${titleHtml}
            </div>
            <div class="flex-1 flex items-center justify-center"><p class="text-xs text-slate-500 italic">Not enough data to chart.</p></div>
        </div>`;
    }

    // --- CHART MATH ---
    const width = 800, height = 150;
    const pad = { t: 20, b: 30, l: 50, r: 20 };
    
    const getX = (d, i) => pad.l + (i / (displayData.length - 1)) * (width - pad.l - pad.r);
    
    const vals = displayData.map(d => d.val);
    let minV = Math.min(...vals);
    let maxV = Math.max(...vals);

    // Expand range to include targets if defined
    if (def.refMin !== undefined) minV = Math.min(minV, def.refMin);
    if (def.refMax !== undefined) maxV = Math.max(maxV, def.refMax);

    const range = maxV - minV;
    const buf = range * 0.1 || (maxV * 0.05) || 1;
    const dMin = Math.max(0, minV - buf);
    const dMax = maxV + buf;

    const getY = (v) => height - pad.b - ((v - dMin) / (dMax - dMin)) * (height - pad.t - pad.b);

    // --- TARGET LINES ---
    let refLinesHtml = '';
    if (def.refMin !== undefined && def.refMax !== undefined) {
        const yMin = getY(def.refMin);
        const yMax = getY(def.refMax);
        
        // Color Logic: Invert = Low is Good (Green), High is Bad (Red)
        // Standard = Low is Bad (Red), High is Good (Green)
        const colorTop = def.invertRanges ? '#ef4444' : '#10b981'; // Red if inverted, Green if standard
        const colorBot = def.invertRanges ? '#10b981' : '#ef4444'; // Green if inverted, Red if standard

        // Top Line (Max)
        if (yMax >= pad.t && yMax <= height - pad.b) {
            refLinesHtml += `
                <line x1="${pad.l}" y1="${yMax}" x2="${width - pad.r}" y2="${yMax}" stroke="${colorTop}" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />
                <text x="${width - pad.r + 5}" y="${yMax + 3}" font-size="8" fill="${colorTop}" opacity="0.8">Target Max</text>
            `;
        }
        // Bottom Line (Min)
        if (yMin >= pad.t && yMin <= height - pad.b) {
            refLinesHtml += `
                <line x1="${pad.l}" y1="${yMin}" x2="${width - pad.r}" y2="${yMin}" stroke="${colorBot}" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />
                <text x="${width - pad.r + 5}" y="${yMin + 3}" font-size="8" fill="${colorBot}" opacity="0.8">Target Min</text>
            `;
        }
    }

    const yAxisLine = `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" stroke="#475569" stroke-width="1" />`;
    
    // Axis Labels
    const yMid = (dMin + dMax) / 2;
    const axisLabels = `
        <text x="${pad.l - 6}" y="${getY(dMax) + 4}" text-anchor="end" font-size="9" fill="#64748b">${dMax.toFixed(1)}</text>
        <text x="${pad.l - 6}" y="${getY(yMid) + 4}" text-anchor="end" font-size="9" fill="#64748b">${yMid.toFixed(1)}</text>
        <text x="${pad.l - 6}" y="${getY(dMin) + 4}" text-anchor="end" font-size="9" fill="#64748b">${dMin.toFixed(1)}</text>
    `;

    // Trend Line
    const trend = calculateTrend(displayData);
    const trendLine = trend ? 
        `<line x1="${getX(null,0)}" y1="${getY(trend.startVal)}" x2="${getX(null,displayData.length-1)}" y2="${getY(trend.endVal)}" stroke="${color}" stroke-width="2" stroke-dasharray="4,4" opacity="0.4" />` 
        : '';

    // Data Path & Points
    let pathD = `M ${getX(displayData[0], 0)} ${getY(displayData[0].val)}`;
    let points = '';
    
    displayData.forEach((d, i) => {
        const x = getX(d, i);
        const y = getY(d.val);
        pathD += ` L ${x} ${y}`;
        points += `<circle cx="${x}" cy="${y}" r="3" fill="#0f172a" stroke="${color}" stroke-width="2" class="cursor-pointer hover:stroke-white transition-all" 
            onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown}', '${color}')" />`;
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col hover:border-slate-600 transition-colors">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <div class="flex items-center gap-2">${titleHtml}</div>
                <div class="flex items-center gap-3">
                    ${indicatorsHtml}
                    <div class="cursor-pointer text-slate-500 hover:text-white transition-colors p-1" onclick="window.showAnalysisTooltip(event, '${key}')">
                        <i class="fa-solid fa-circle-info text-sm"></i>
                    </div>
                </div>
            </div>
            <div class="flex-1 w-full h-[120px]">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
                    ${yAxisLine}
                    ${axisLabels}
                    ${refLinesHtml}
                    ${trendLine}
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8" />
                    ${points}
                </svg>
            </div>
        </div>
    `;
};

// --- MAIN UPDATE FUNCTION ---

export const updateCharts = (allData, timeRange) => {
    if (!allData || allData.length === 0) return;
    
    const cutoff = new Date();
    if (timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (timeRange === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (timeRange === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);
    
    const render = (containerId, metricKey) => {
        const el = document.getElementById(containerId);
        if (el) {
            const fullSet = extractChartData(allData, metricKey).sort((a,b) => new Date(a.date) - new Date(b.date));
            const displaySet = fullSet.filter(d => d.date >= cutoff);
            el.innerHTML = buildMetricChart(displaySet, fullSet, metricKey);
        }
    };

    render('metric-chart-vo2max', 'vo2max');
    render('metric-chart-tss', 'tss');
    render('metric-chart-anaerobic', 'anaerobic');

    render('metric-chart-subjective_bike', 'subjective_bike');
    render('metric-chart-endurance', 'endurance');
    render('metric-chart-strength', 'strength');

    render('metric-chart-subjective_run', 'subjective_run');
    render('metric-chart-run', 'run');
    render('metric-chart-mechanical', 'mechanical');
    render('metric-chart-gct', 'gct');
    render('metric-chart-vert', 'vert');

    render('metric-chart-subjective_swim', 'subjective_swim');
    render('metric-chart-swim', 'swim');

    ['30d', '90d', '6m', '1y'].forEach(range => {
        const btn = document.getElementById(`btn-metric-${range}`);
        if(btn) {
            btn.className = timeRange === range ? 
                "bg-emerald-500 text-white font-bold px-3 py-1 rounded text-[10px] transition-all shadow-lg" : 
                "bg-slate-800 text-slate-400 hover:text-white px-3 py-1 rounded text-[10px] transition-all hover:bg-slate-700";
        }
    });
};
