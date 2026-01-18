// js/views/metrics/table.js
import { METRIC_DEFINITIONS } from './definitions.js';

// --- 1. TREND CALCULATOR ---
const calcTrend = (data) => {
    const n = data.length;
    if (n < 3) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i; sumY += data[i].val;
        sumXY += i * data[i].val; sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
};

const getIcon = (slope, invert) => {
    if (Math.abs(slope) < 0.001) return { icon: 'fa-arrow-right', color: 'text-slate-500' };
    const isUp = slope > 0;
    const isGood = invert ? !isUp : isUp;
    return { 
        icon: isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down', 
        color: isGood ? 'text-emerald-400' : 'text-red-400' 
    };
};

// --- 2. DATA EXTRACTOR ---
const getMetricData = (allData, key) => {
    const def = METRIC_DEFINITIONS[key];
    if (!def) return [];

    return allData
        .filter(d => {
            if (def.sport !== 'All' && d.sport !== def.sport) return false;
            return def.getValue(d) !== null;
        })
        .map(d => ({
            date: d.date,
            val: def.getValue(d)
        }))
        .sort((a,b) => a.date - b.date);
};

// --- 3. RENDER TABLE ---
export const renderSummaryTable = (allData) => {
    if(!allData || allData.length === 0) return '';

    const groups = [
        { name: 'General Fitness', keys: ['vo2max', 'tss', 'anaerobic'] },
        { name: 'Cycling Metrics', keys: ['subjective_bike', 'endurance', 'strength'] },
        { name: 'Running Metrics', keys: ['subjective_run', 'run', 'mechanical', 'gct', 'vert'] },
        { name: 'Swimming Metrics', keys: ['subjective_swim', 'swim'] }
    ];

    let rows = '';
    const now = new Date();

    groups.forEach(group => {
        rows += `
            <tr class="bg-slate-900/80">
                <td colspan="5" class="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700">
                    ${group.name}
                </td>
            </tr>
        `;

        group.keys.forEach(key => {
            const def = METRIC_DEFINITIONS[key];
            if (!def) return;

            const data = getMetricData(allData, key);
            if (data.length === 0) return;

            const getT = (days) => {
                const cutoff = new Date();
                cutoff.setDate(now.getDate() - days);
                const subset = data.filter(d => d.date >= cutoff);
                const slope = calcTrend(subset);
                return slope !== null ? getIcon(slope, def.invertRanges) : { icon: 'fa-minus', color: 'text-slate-600' };
            };

            const t30 = getT(30);
            const t90 = getT(90);
            const t6m = getT(180);

            const recent = data.filter(d => d.date >= new Date(now.getTime() - 30 * 86400000));
            let statusHtml = '<span class="text-slate-600 text-[10px]">--</span>';
            
            if (recent.length > 0 && def.refMin && def.refMax) {
                const avg = recent.reduce((a,b) => a + b.val, 0) / recent.length;
                let isGood = false;
                if (def.invertRanges) isGood = avg <= def.refMax; 
                else isGood = avg >= def.refMin; 

                if (isGood) statusHtml = '<span class="text-emerald-400 font-bold text-[10px] bg-emerald-900/30 px-1.5 py-0.5 rounded">✅ On Target</span>';
                else statusHtml = '<span class="text-yellow-400 font-bold text-[10px] bg-yellow-900/30 px-1.5 py-0.5 rounded">⚠️ Off Target</span>';
            }

            // UPDATED: Added Formula to Title
            rows += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors group">
                    <td class="px-4 py-3 flex items-center gap-3">
                        <div class="w-6 h-6 rounded flex items-center justify-center bg-slate-800 border border-slate-700">
                            <i class="fa-solid ${def.icon} text-xs" style="color: ${def.colorVar}"></i>
                        </div>
                        <div>
                            <div class="font-bold text-slate-200 text-xs">
                                ${def.title}
                                <span class="text-[9px] text-slate-500 font-mono ml-1 font-normal">${def.formula || ''}</span>
                            </div>
                            <div class="text-[9px] text-slate-500 font-mono">${def.rangeInfo || ''}</div>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-center"><i class="fa-solid ${t30.icon} ${t30.color}"></i></td>
                    <td class="px-4 py-3 text-center"><i class="fa-solid ${t90.icon} ${t90.color}"></i></td>
                    <td class="px-4 py-3 text-center"><i class="fa-solid ${t6m.icon} ${t6m.color}"></i></td>
                    <td class="px-4 py-3 text-right">${statusHtml}</td>
                </tr>`;
        });
    });

    return `
        <div class="overflow-x-auto bg-slate-800/30 border border-slate-700 rounded-xl mb-8 shadow-sm">
            <table class="w-full text-left">
                <thead class="bg-slate-900/50 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                        <th class="px-4 py-3">Metric</th>
                        <th class="px-4 py-3 text-center">30d</th>
                        <th class="px-4 py-3 text-center">90d</th>
                        <th class="px-4 py-3 text-center">6m</th>
                        <th class="px-4 py-3 text-right">Status</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-700/50 text-slate-300">
                    ${rows}
                </tbody>
            </table>
        </div>`;
};
