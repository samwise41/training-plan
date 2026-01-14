// js/views/metrics/charts.js
import { METRIC_DEFINITIONS } from './definitions.js';
import { calculateTrend, getTrendIcon } from './utils.js';
import { extractMetricData } from './table.js';

// Helper: Subjective Efficiency Calculation
const calculateSubjectiveEfficiency = (allData, sportMode) => {
    return allData
        .filter(d => !d.isHealth && d.RPE > 0)
        .map(d => {
            let val = 0;
            let breakdown = "";
            let match = false;

            if (sportMode === 'bike' && (d.sportTypeId == '2' || d.activityType?.includes('cycl') || d.activityType?.includes('virt'))) {
                if (d.avgPower > 0) { val = d.avgPower / d.RPE; breakdown = `${Math.round(d.avgPower)}W / ${d.RPE}`; match = true; }
            }
            else if (sportMode === 'run' && (d.sportTypeId == '1' || d.activityType?.includes('run'))) {
                if (d.avgSpeed > 0) { val = d.avgSpeed / d.RPE; breakdown = `${d.avgSpeed.toFixed(2)}m/s / ${d.RPE}`; match = true; }
            }
            else if (sportMode === 'swim' && (d.sportTypeId == '5' || d.activityType?.includes('swim'))) {
                if (d.avgSpeed > 0) { val = d.avgSpeed / d.RPE; breakdown = `${d.avgSpeed.toFixed(2)}m/s / ${d.RPE}`; match = true; }
            }

            if (match && val > 0) return {
                date: d.date,
                dateStr: d.date.toISOString().split('T')[0],
                val: val,
                name: d.actualName || 'Activity',
                breakdown: breakdown
            };
            return null;
        })
        .filter(Boolean)
        .sort((a, b) => a.date - b.date);
};

const buildMetricChart = (displayData, fullData, key) => {
    const def = METRIC_DEFINITIONS[key];
    if (!def) return `<div class="p-4 text-xs text-red-400">Definition missing: ${key}</div>`;

    const unitLabel = def.rangeInfo || ''; 
    const color = def.colorVar;

    if (!displayData || displayData.length < 2) {
        return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col justify-between min-h-[150px]">
            <div class="text-xs font-bold text-slate-400 flex gap-2"><i class="fa-solid ${def.icon}"></i> ${def.title}</div>
            <div class="flex-1 flex items-center justify-center text-xs text-slate-600 italic">No data</div>
        </div>`;
    }

    const width = 800, height = 150;
    const pad = { t: 20, b: 30, l: 50, r: 20 };
    const getX = (d, i) => pad.l + (i / (displayData.length - 1)) * (width - pad.l - pad.r);
    
    const vals = displayData.map(d => d.val);
    const minV = Math.min(...vals) * 0.9;
    const maxV = Math.max(...vals) * 1.1;
    const getY = (val) => height - pad.b - ((val - minV) / (maxV - minV)) * (height - pad.t - pad.b);

    let pathD = `M ${getX(displayData[0], 0)} ${getY(displayData[0].val)}`;
    let pointsHtml = '';
    displayData.forEach((d, i) => {
        const x = getX(d, i), y = getY(d.val);
        pathD += ` L ${x} ${y}`;
        pointsHtml += `<circle cx="${x}" cy="${y}" r="3" fill="#0f172a" stroke="${color}" stroke-width="2" class="cursor-pointer hover:r-5 transition-all" onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown || ""}', '${color}')"><title>${d.dateStr}: ${d.val.toFixed(2)}</title></circle>`;
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col hover:border-slate-600 transition-colors">
            <div class="flex justify-between items-center mb-2 border-b border-slate-700/50 pb-2">
                <div class="text-xs font-bold text-white flex gap-2"><i class="fa-solid ${def.icon}" style="color:${color}"></i> ${def.title}</div>
            </div>
            <div class="flex-1 w-full h-[120px]">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-full">
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" opacity="0.8" />
                    ${pointsHtml}
                </svg>
            </div>
        </div>
    `;
};

export const updateCharts = (allData, timeRange) => {
    if (!allData || allData.length === 0) return;
    
    const cutoff = new Date();
    if (timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (timeRange === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (timeRange === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);
    
    const chartKeys = [
        'vo2max', 'anaerobic', 
        'subjective_bike', 'subjective_run', 'subjective_swim',
        'endurance', 'strength', 
        'run', 'mechanical', 'gct', 'vert', 
        'swim'
    ];

    chartKeys.forEach(key => {
        const el = document.getElementById(`metric-chart-${key}`);
        if (el) {
            try {
                let full;
                if (key.startsWith('subjective_')) {
                    full = calculateSubjectiveEfficiency(allData, key.split('_')[1]);
                } else {
                    full = extractMetricData(allData, key).sort((a,b) => a.date - b.date);
                }
                const display = full.filter(d => d.date >= cutoff);
                el.innerHTML = buildMetricChart(display, full, key);
            } catch (err) {
                console.error(`Error rendering ${key}:`, err);
                el.innerHTML = `<div class="text-red-500 text-xs p-4">Error loading chart</div>`;
            }
        }
    });

    ['30d', '90d', '6m', '1y'].forEach(range => {
        const btn = document.getElementById(`btn-metric-${range}`);
        if(btn) btn.className = timeRange === range ? "bg-emerald-500 text-white font-bold px-2 py-1 rounded text-[10px]" : "bg-slate-800 text-slate-400 px-2 py-1 rounded text-[10px]";
    });
};
