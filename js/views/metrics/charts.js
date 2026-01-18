// js/views/metrics/charts.js
import { METRIC_DEFINITIONS } from './definitions.js';

// --- 1. DATA PREPARATION ---
const prepareData = (allData, key) => {
    const def = METRIC_DEFINITIONS[key];
    if (!def) return [];

    if (def.isWeekly) {
        const weeks = {};
        allData.forEach(d => {
            const val = d.tss || 0;
            if (val <= 0) return;
            
            const date = d.date instanceof Date ? d.date : new Date(d.date);
            if(isNaN(date)) return;

            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? 0 : 7);
            const weekEnd = new Date(date);
            weekEnd.setDate(diff);
            weekEnd.setHours(0,0,0,0);
            
            const k = weekEnd.toISOString().split('T')[0];
            weeks[k] = (weeks[k] || 0) + val;
        });

        return Object.keys(weeks).sort().map(k => ({
            date: new Date(k),
            dateStr: k,
            val: weeks[k],
            label: `${Math.round(weeks[k])} TSS`
        }));
    }

    return allData
        .filter(d => {
            if (def.sport !== 'All' && d.sport !== def.sport) return false;
            return def.getValue(d) !== null;
        })
        .map(d => ({
            date: d.date,
            dateStr: d.dateStr || d.date.toISOString().split('T')[0],
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
    return { start: intercept, end: intercept + slope * (n - 1), slope: slope };
};

// --- 3. CHART RENDERER ---
const renderChart = (data, def, key) => {
    if (!data || data.length < 2) {
        return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-[150px] flex items-center justify-center text-xs text-slate-500 italic">No data available for ${def.title}</div>`;
    }

    const w = 800, h = 150;
    const pad = { t: 20, b: 20, l: 40, r: 10 };
    
    const vals = data.map(d => d.val);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    
    if (def.refMin !== undefined) min = Math.min(min, def.refMin);
    if (def.refMax !== undefined) max = Math.max(max, def.refMax);
    
    const range = max - min || 1;
    min -= range * 0.1; max += range * 0.1;

    const getX = (i) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
    const getY = (v) => h - pad.b - ((v - min) / (max - min)) * (h - pad.t - pad.b);

    let svgContent = '';

    if (def.refMin !== undefined && def.refMax !== undefined) {
        const yMin = getY(def.refMin);
        const yMax = getY(def.refMax);
        const cGood = '#10b981'; const cBad = '#ef4444';
        const cTop = def.invertRanges ? cBad : cGood;
        const cBot = def.invertRanges ? cGood : cBad;

        if(yMax > pad.t && yMax < h-pad.b) svgContent += `<line x1="${pad.l}" y1="${yMax}" x2="${w-pad.r}" y2="${yMax}" stroke="${cTop}" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />`;
        if(yMin > pad.t && yMin < h-pad.b) svgContent += `<line x1="${pad.l}" y1="${yMin}" x2="${w-pad.r}" y2="${yMin}" stroke="${cBot}" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />`;
    }

    const pathD = data.map((d, i) => `${i===0?'M':'L'} ${getX(i)} ${getY(d.val)}`).join(' ');
    svgContent += `<path d="${pathD}" fill="none" stroke="${def.colorVar}" stroke-width="2" opacity="0.8" />`;

    const trend = calcTrend(data);
    if (trend) {
        svgContent += `<line x1="${getX(0)}" y1="${getY(trend.start)}" x2="${getX(data.length-1)}" y2="${getY(trend.end)}" stroke="white" stroke-width="1" stroke-dasharray="2,2" opacity="0.3" />`;
    }

    data.forEach((d, i) => {
        const cx = getX(i); const cy = getY(d.val);
        svgContent += `<circle cx="${cx}" cy="${cy}" r="3" fill="#0f172a" stroke="${def.colorVar}" stroke-width="2" class="cursor-pointer hover:stroke-white transition-all" 
            onclick="window.showMetricTooltip(event, '${d.dateStr}', '${(d.title||"").replace(/'/g,"")}', '${d.val.toFixed(2)}', '', '${d.label}', '${def.colorVar}')" />`;
    });

    svgContent += `<text x="${pad.l-5}" y="${getY(max)+4}" text-anchor="end" font-size="9" fill="#64748b">${max.toFixed(1)}</text>
                   <text x="${pad.l-5}" y="${getY(min)+4}" text-anchor="end" font-size="9" fill="#64748b">${min.toFixed(1)}</text>`;

    // --- RESTORED HEADER WITH INFO ICON ---
    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col hover:border-slate-600 transition-colors">
            <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-700">
                <div class="flex items-center gap-2">
                    <h3 class="text-xs font-bold text-white flex items-center gap-2">
                        <i class="fa-solid ${def.icon}" style="color: ${def.colorVar}"></i> ${def.title}
                    </h3>
                </div>
                <div class="cursor-pointer text-slate-500 hover:text-blue-400 transition-colors p-1" onclick="window.showAnalysisTooltip(event, '${key}')">
                    <i class="fa-solid fa-circle-info text-sm"></i>
                </div>
            </div>
            <div class="flex-1 w-full h-[120px]">
                <svg viewBox="0 0 ${w} ${h}" class="w-full h-full overflow-visible">${svgContent}</svg>
            </div>
        </div>`;
};

// --- 4. MAIN EXPORT ---
export const updateCharts = (allData, timeRange) => {
    const cutoff = new Date();
    const rangeKey = timeRange || '6m';
    
    if (rangeKey === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (rangeKey === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (rangeKey === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (rangeKey === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);

    Object.keys(METRIC_DEFINITIONS).forEach(key => {
        const container = document.getElementById(`metric-chart-${key}`);
        if (container) {
            const fullData = prepareData(allData, key);
            const displayData = fullData.filter(d => d.date >= cutoff);
            container.innerHTML = renderChart(displayData, METRIC_DEFINITIONS[key], key);
        }
    });

    ['30d', '90d', '6m', '1y'].forEach(r => {
        const btn = document.getElementById(`btn-metric-${r}`);
        if(btn) {
            btn.className = "px-3 py-1 rounded text-[10px] font-bold transition-all ";
            if (r === rangeKey) {
                btn.className += "bg-emerald-500 text-white shadow-lg scale-105";
            } else {
                btn.className += "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700";
            }
        }
    });
};
