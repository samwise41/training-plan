// js/views/dashboard/heatmaps.js
import { toLocalYMD, getSportColorVar } from './utils.js';

function parseEvents(planMd) {
    // (Same parsing logic as before, just kept compact)
    const eventMap = {};
    if (!planMd) return eventMap;
    const lines = planMd.split('\n');
    let inEvent = false;
    lines.forEach(line => {
        if(line.includes('1. Event Schedule')) inEvent=true;
        if(line.includes('2. User Profile')) inEvent=false;
        if(inEvent && line.trim().startsWith('|') && !line.includes('---')) {
            const p = line.split('|').map(x=>x.trim());
            if(p.length>2) {
                const d = new Date(p[1]);
                if(!isNaN(d)) eventMap[toLocalYMD(d)] = p[2];
            }
        }
    });
    return eventMap;
}

function buildHeatmap(fullLog, eventMap, startDate, endDate, title, containerId) {
    if (!fullLog) fullLog = [];
    const dataMap = {};
    
    fullLog.forEach(d => {
        if(d.duration > 0) {
            const k = toLocalYMD(d.date);
            if(!dataMap[k]) dataMap[k] = [];
            dataMap[k].push(d);
        }
    });

    const today = new Date(); today.setHours(0,0,0,0);
    const startDay = startDate.getDay();
    let cells = '';
    for(let i=0; i<startDay; i++) cells += `<div class="w-3 h-3 m-[1px] opacity-0"></div>`;

    let cur = new Date(startDate);
    const maxLoops = 400; let l = 0;

    while(cur <= endDate && l < maxLoops) {
        l++;
        const k = toLocalYMD(cur);
        const dayItems = dataMap[k];
        const eventName = eventMap[k];
        const isFuture = cur > today;
        const dayOfWeek = cur.getDay();

        let bg = 'bg-slate-800';
        let style = '';
        let tooltipData = '';

        if (eventName) {
            bg = 'bg-purple-500';
            tooltipData = `onclick="window.showDashboardTooltip(event, '${k}', 0, 0, '${eventName.replace(/'/g, "")}', '#a855f7', 'Event', '')"`;
        } else if (dayItems) {
            let total = 0;
            const sports = new Set();
            const details = [];
            dayItems.forEach(x => {
                total += x.duration;
                sports.add(x.sport);
                details.push(`${x.sport}: ${x.duration}m`);
            });
            
            // Color Logic
            const sportArr = Array.from(sports);
            if (sportArr.length === 1) {
                style = `background-color: ${getSportColorVar(sportArr[0])}`;
                bg = '';
            } else {
                style = `background: linear-gradient(135deg, ${getSportColorVar(sportArr[0])} 50%, ${getSportColorVar(sportArr[1]||sportArr[0])} 50%)`;
                bg = '';
            }
            
            tooltipData = `onclick="window.showDashboardTooltip(event, '${k}', 0, ${total}, 'Completed', '#10b981', '${sportArr.join('+')}', '${details.join('<br>')}')"`;
        } else {
            if (dayOfWeek === 0) { style='opacity:0'; bg=''; } // Hide empty Sundays
        }

        const cursor = (eventName || dayItems) ? 'cursor-pointer hover:opacity-80' : '';
        cells += `<div class="w-3 h-3 rounded-sm ${bg} ${cursor} m-[1px]" style="${style}" ${tooltipData}></div>`;
        cur.setDate(cur.getDate()+1);
    }

    // Scroll container
    const idAttr = containerId ? `id="${containerId}"` : '';
    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
            <h3 class="text-sm font-bold text-white mb-4"><i class="fa-solid fa-fire text-slate-400 mr-2"></i> ${title}</h3>
            <div ${idAttr} class="overflow-x-auto pb-4 flex-grow">
                <div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">${cells}</div>
            </div>
        </div>
    `;
}

export function renderHeatmaps(fullLogData, planMd) {
    const eventMap = parseEvents(planMd);
    const today = new Date(); today.setHours(0,0,0,0);
    
    // Trailing 6 Months
    const end = new Date(today); end.setDate(end.getDate() + (6 - end.getDay())); // Next Sat
    const start = new Date(end); start.setMonth(start.getMonth() - 6);
    
    // Annual
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);

    const trailingHtml = buildHeatmap(fullLogData, eventMap, start, end, "Recent Consistency", "heatmap-trail");
    const yearHtml = buildHeatmap(fullLogData, eventMap, startYear, endYear, `Annual Overview ${today.getFullYear()}`, null);

    setTimeout(() => {
        const el = document.getElementById('heatmap-trail');
        if(el) el.scrollLeft = el.scrollWidth;
    }, 50);

    return `<div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">${trailingHtml}${yearHtml}</div>`;
}
