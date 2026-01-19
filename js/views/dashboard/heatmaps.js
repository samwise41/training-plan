import { toLocalYMD } from './utils.js';

function getComplianceMap(fullLog, plannedJson) {
    const map = {};
    if (plannedJson && Array.isArray(plannedJson)) {
        plannedJson.forEach(w => {
            const k = toLocalYMD(w.date);
            if (!map[k]) map[k] = { planned: 0, actual: 0, details: [] };
            const dur = w.plannedDuration || 0;
            if (dur > 0) {
                map[k].planned += dur;
                map[k].details.push(`Plan: ${w.activityName} (${dur}m)`);
            }
        });
    }
    if (fullLog) {
        fullLog.forEach(d => {
            const k = toLocalYMD(d.date);
            if (!map[k]) map[k] = { planned: 0, actual: 0, details: [] };
            map[k].actual += (d.duration || 0);
            if (d.duration > 0) map[k].details.push(`Act: ${d.sport} (${Math.round(d.duration)}m)`);
        });
    }
    return map;
}

function buildHeatmap(dataMap, startDate, endDate, title, containerId) {
    const startDay = startDate.getDay();
    let cells = '';
    for(let i=0; i<startDay; i++) cells += `<div class="w-3 h-3 m-[1px] opacity-0"></div>`;

    let cur = new Date(startDate);
    const today = new Date(); today.setHours(0,0,0,0);
    const maxLoops = 400; let l = 0;

    while(cur <= endDate && l < maxLoops) {
        l++;
        const k = toLocalYMD(cur);
        const entry = dataMap[k] || { planned: 0, actual: 0, details: [] };
        const isFuture = cur > today;
        let bg = 'bg-slate-800';
        let tooltip = '';
        const { planned, actual } = entry;
        const detailsStr = entry.details.join('<br>');

        if (isFuture) {
            if (planned > 0) { bg = 'bg-slate-700'; tooltip = `Planned: ${planned}m`; }
        } else {
            if (planned > 0) {
                if (actual === 0) { bg = 'bg-red-500'; tooltip = 'Missed'; }
                else {
                    const ratio = actual / planned;
                    if (ratio >= 0.95) { bg = 'bg-emerald-500'; tooltip = 'Completed'; }
                    else { bg = 'bg-yellow-500'; tooltip = `Partial (${Math.round(ratio*100)}%)`; }
                }
            } else if (actual > 0) { bg = 'bg-blue-500'; tooltip = 'Unplanned'; }
            else { bg = cur.getDay() === 0 ? 'bg-slate-800/30' : 'bg-slate-800/50'; }
        }

        const clickAttr = (planned > 0 || actual > 0) ? 
            `onclick="window.showDashboardTooltip(event, '${k}', ${planned}, ${actual}, '${tooltip}', '#fff', 'Compliance', '${detailsStr.replace(/'/g, "")}')"` : '';
        const cursor = (planned > 0 || actual > 0) ? 'cursor-pointer hover:opacity-80' : '';
        cells += `<div class="w-3 h-3 rounded-sm ${bg} ${cursor} m-[1px]" ${clickAttr}></div>`;
        cur.setDate(cur.getDate()+1);
    }

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
            <h3 class="text-sm font-bold text-white mb-4"><i class="fa-solid fa-calendar-check text-slate-400 mr-2"></i> ${title}</h3>
            <div id="${containerId}" class="overflow-x-auto pb-4 flex-grow">
                <div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">${cells}</div>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-4 mt-2 text-[10px] text-slate-400 font-mono">
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-emerald-500"></div> Done</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-yellow-500"></div> Partial</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-red-500"></div> Missed</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-blue-500"></div> Extra</div>
            </div>
        </div>
    `;
}

export function renderHeatmaps(cleanLogData, plannedJson) {
    const complianceMap = getComplianceMap(cleanLogData, plannedJson);
    const today = new Date(); today.setHours(0,0,0,0);
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);
    const yearHtml = buildHeatmap(complianceMap, startYear, endYear, `Annual Compliance (${today.getFullYear()})`, 'heatmap-annual-scroll');

    setTimeout(() => {
        const el = document.getElementById('heatmap-annual-scroll');
        if(el) el.scrollLeft = el.scrollWidth;
    }, 50);

    return `<div class="mt-8">${yearHtml}</div>`;
}
