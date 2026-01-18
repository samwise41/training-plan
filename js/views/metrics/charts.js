// js/views/metrics/charts.js
import { METRIC_DEFINITIONS } from './definitions.js';

// --- 1. DATA PREPARATION ---
const prepareData = (allData, key) => {
    const def = METRIC_DEFINITIONS[key];
    if (!def) return [];

    // Special Case: Weekly TSS Aggregation
    if (def.isWeekly) {
        const weeks = {};
        allData.forEach(d => {
            if (!d.tss) return;
            // Calculate "Week Ending" date
            const date = new Date(d.date);
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? 0 : 7); // Adjust to Sunday
            const weekEnd = new Date(date.setDate(diff));
            weekEnd.setHours(0,0,0,0);
            const k = weekEnd.toISOString().split('T')[0];
            
            weeks[k] = (weeks[k] || 0) + d.tss;
        });
        return Object.keys(weeks).sort().map(k => ({
            date: new Date(k),
            dateStr: k,
            val: weeks[k],
            label: `${Math.round(weeks[k])} TSS`
        }));
    }

    // Standard Case: Daily Metrics
    return allData
        .filter(d => {
            // Filter by Sport (if specified)
            if (def.sport !== 'All' && d.sport !== def.sport) return false;
            // Check if value exists
            const v = def.getValue(d);
            return v !== null;
        })
        .map(d => ({
            date: d.date,
            dateStr: d.dateStr,
            val: def.getValue(d),
            label: def.getLabel(d),
            title: d.title
        }))
        .sort((a, b) => a.date - b.date);
};

// --- 2. TREND CALCULATOR ---
const calcTrend = (data) => {
    const n = data.length;
    if (n < 3) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i; sumY += data[i].val;
        sumXY += i * data[i].val; sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { 
        start: intercept, 
        end: intercept + slope * (n - 1),
        slope: slope 
    };
};

// --- 3. CHART RENDERER ---
const renderChart = (data, def) => {
    if (!data || data.length < 2) {
        return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-[150px] flex items-center justify-center text-xs text-slate-500 italic">No data found for ${def.title}</div>`;
    }

    const w = 800, h = 150;
    const pad = { t: 20, b: 20, l: 40, r: 10 };
    
    // Scale Y-Axis
    const vals = data.map(d => d.val);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    
    // Expand to include targets
    if (def.refMin) min = Math.min(min, def.refMin);
    if (def.refMax) max = Math.max(max, def.refMax);
    
    // Add padding
    const range = max - min || 1;
    min -= range * 0.1;
    max += range * 0.1;

    const getX = (i) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
    const getY = (v) => h - pad.b - ((v - min) / (max - min)) * (h - pad.t - pad.b);

    // SVG Components
    let svgContent = '';

    // A. Target Lines
    if (def.refMin && def.refMax) {
        const yMin = getY(def.refMin);
        const yMax = getY(def.refMax);
        const colorGood = def.invertRanges ? '#10b981' : '#10b981'; // Green
        const colorBad = '#ef4444'; // Red
        
        // If Standard (High=Good): Top is Green, Bottom is Red
        // If Inverted (Low=Good): Top is Red, Bottom is Green
        const cTop = def.invertRanges ? colorBad : colorGood;
        const cBot = def.invertRanges ? colorGood : colorBad;

        if(yMax > pad.t && yMax < h-pad.b) svgContent += `<line x1="${pad.l}" y1="${yMax}" x2="${w-pad.r}" y2="${yMax}" stroke="${cTop}" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />`;
        if(yMin > pad.t && yMin < h-pad.b) svgContent += `<line x1="${pad.l}" y1="${yMin}" x2="${w-pad.r}" y2="${yMin}" stroke="${cBot}" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />`;
    }

    // B. Data Line
    const pathD = data.map((d, i) => `${i===0?'M':'L'} ${getX(i)} ${getY(d.val)}`).join(' ');
    svgContent += `<path d="${pathD}" fill="none" stroke="${def.colorVar}" stroke-width="2" opacity="0.8" />`;

    // C. Trend Line
    const trend = calcTrend(data);
    if (trend) {
        svgContent += `<line x1="${getX(0)}" y1="${getY(trend.start)}" x2="${getX(data.length-1)}" y2="${getY(trend.end)}" stroke="white" stroke-width="1" stroke-dasharray="2,2" opacity="0.3" />`;
    }

    // D. Interactive Points
    data.forEach((d, i) => {
        const cx = getX(i);
        const cy = getY(d.val);
        svgContent += `<circle cx="${cx}" cy="${cy}" r="3" fill="#0f172a" stroke="${def.colorVar}" stroke-width="2" class="cursor-pointer hover:stroke-white transition-all" 
            onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.title.replace(/'/g,"")}', '${d.val.toFixed(2)}', '', '${d.label}', '${def.colorVar}')" />`;
    });

    // E. Y-Axis Text
    svgContent += `
        <text x="${pad.l-5}" y="${getY(max)+4}" text-anchor="end" font-size="9" fill="#64748b">${max.toFixed(1)}</text>
        <text x="${pad.l-5}" y="${getY(min)+4}" text-anchor="end" font-size="9" fill="#64748b">${min.toFixed(1)}</text>
    `;

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col hover:border-slate-600 transition-colors">
            <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-700">
                <h3 class="text-xs font-bold text-white flex items-center gap-2">
                    <i class="fa-solid ${def.icon}" style="color: ${def.colorVar}"></i> ${def.title}
                </h3>
            </div>
            <div class="flex-1 w-full h-[120px]">
                <svg viewBox="0 0 ${w} ${h}" class="w-full h-full overflow-visible">
                    ${svgContent}
                </svg>
            </div>
        </div>
    `;
};

// --- 4. MAIN EXPORT ---
export const updateCharts = (allData, timeRange) => {
    // 1. Determine Date Cutoff
    const cutoff = new Date();
    if (timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (timeRange === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (timeRange === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);

    // 2. Render Loop
    Object.keys(METRIC_DEFINITIONS).forEach(key => {
        const container = document.getElementById(`metric-chart-${key}`);
        if (container) {
            // Get Data
            const fullData = prepareData(allData, key);
            // Filter by Time
            const displayData = fullData.filter(d => d.date >= cutoff);
            // Render
            container.innerHTML = renderChart(displayData, METRIC_DEFINITIONS[key]);
        }
    });

    // 3. Update Buttons
    ['30d', '90d', '6m', '1y'].forEach(range => {
        const btn = document.getElementById(`btn-metric-${range}`);
        if(btn) {
            btn.className = timeRange === range ? 
                "bg-emerald-500 text-white font-bold px-3 py-1 rounded text-[10px] transition-all shadow-lg" : 
                "bg-slate-800 text-slate-400 hover:text-white px-3 py-1 rounded text-[10px] transition-all hover:bg-slate-700";
        }
    });
};
