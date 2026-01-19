import { toLocalYMD } from './utils.js';

// --- 1. Aggregation Logic (Multi-Sport / Volume Based) ---
function getComplianceMap(fullLog, plannedJson) {
    const map = {};

    // A. Map Planned Data (Aggregate by Date)
    if (plannedJson && Array.isArray(plannedJson)) {
        plannedJson.forEach(w => {
            const k = w.date.substring(0, 10); // Use string YYYY-MM-DD
            
            if (!map[k]) map[k] = { 
                planned: 0, 
                actualMatching: 0, 
                plannedSports: new Set(),
                details: [] 
            };
            
            const dur = w.plannedDuration || 0;
            if (dur > 0) {
                map[k].planned += dur;
                
                // Normalize sport name
                let sport = w.activityType || "Other";
                if(sport.toUpperCase() === 'RUN') sport = 'Run';
                if(sport.toUpperCase() === 'BIKE') sport = 'Bike';
                if(sport.toUpperCase() === 'SWIM') sport = 'Swim';
                if(sport.toUpperCase() === 'STRENGTH') sport = 'Strength';
                
                map[k].plannedSports.add(sport);
                map[k].details.push(`Plan: ${w.activityName} (${dur}m)`);
            }
        });
    }

    // B. Map Actual Data (Aggregate Matching Sports)
    if (fullLog) {
        fullLog.forEach(d => {
            const k = toLocalYMD(d.date);
            
            // We only care about matching actuals IF there is a plan
            if (map[k]) {
                const dur = d.duration || 0;
                
                // Check if this actual sport is in the planned sports set
                if (dur > 0 && map[k].plannedSports.has(d.sport)) {
                    map[k].actualMatching += dur;
                }

                // Add to details regardless (so user sees what they did)
                if (dur > 0) {
                    let icon = '';
                    if(d.sport === 'Run') icon = '🏃';
                    else if(d.sport === 'Bike') icon = '🚴';
                    else if(d.sport === 'Swim') icon = '🏊';
                    
                    map[k].details.push(`Act: ${icon} ${d.sport} (${Math.round(dur)}m)`);
                }
            }
        });
    }
    return map;
}

// --- 2. Grid Builder ---
function buildHeatmap(dataMap, startDate, endDate, title, containerId) {
    const startDay = startDate.getDay(); // 0=Sun
    let cells = '';
    
    // Offset empty cells
    for(let i=0; i<startDay; i++) cells += `<div class="w-3 h-3 m-[1px] opacity-0"></div>`;

    let cur = new Date(startDate);
    const today = new Date(); 
    today.setHours(0,0,0,0);
    
    const maxLoops = 400; 
    let l = 0;

    while(cur <= endDate && l < maxLoops) {
        l++;
        const k = toLocalYMD(cur);
        const entry = dataMap[k] || { planned: 0, actualMatching: 0, details: [] };
        const isFuture = cur > today;

        let bg = 'bg-slate-800'; // Default Empty
        let tooltip = '';
        const { planned, actualMatching } = entry;
        const detailsStr = entry.details ? entry.details.join('<br>') : '';

        if (isFuture) {
            // FUTURE
            if (planned > 0) { 
                bg = 'bg-slate-700'; 
                tooltip = `Planned: ${planned}m`; 
            }
        } else {
            // PAST
            if (planned > 0) {
                // We have a plan, check compliance
                if (actualMatching === 0) {
                    bg = 'bg-red-500'; // Missed (0% matching volume)
                    tooltip = 'Missed';
                } else {
                    const ratio = actualMatching / planned;
                    if (ratio >= 0.95) {
                        bg = 'bg-emerald-500'; // Target Met
                        tooltip = 'Completed';
                    } else {
                        bg = 'bg-yellow-500'; // Under Target
                        tooltip = `Partial (${Math.round(ratio*100)}%)`;
                    }
                }
            } 
            else {
                // NO PLAN (Ignore Actuals per requirements)
                bg = cur.getDay() === 0 ? 'bg-slate-800/30' : 'bg-slate-800/50'; 
            }
        }

        const clickAttr = (planned > 0 || (entry.details && entry.details.length > 0)) ? 
            `onclick="window.showDashboardTooltip(event, '${k}', ${planned}, ${actualMatching}, '${tooltip}', '#fff', 'Compliance', '${detailsStr.replace(/'/g, "")}')"` : '';
        
        const cursor = (planned > 0) ? 'cursor-pointer hover:opacity-80' : '';
        
        cells += `<div class="w-3 h-3 rounded-sm ${bg} ${cursor} m-[1px]" ${clickAttr}></div>`;
        cur.setDate(cur.getDate()+1);
    }

    return `
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 h-full flex flex-col shadow-lg">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center">
                <i class="fa-solid fa-calendar-check text-slate-400 mr-2"></i> ${title}
            </h3>
            
            <div id="${containerId}" class="overflow-x-auto pb-4 flex-grow scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                <div class="grid grid-rows-7 grid-flow-col gap-1 w-max mx-auto">${cells}</div>
            </div>
            
            <div class="flex flex-wrap items-center justify-center gap-4 mt-2 text-[10px] text-slate-400 font-mono">
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-emerald-500"></div> Done (95%+)</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-yellow-500"></div> Partial</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-red-500"></div> Missed</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-slate-700"></div> Planned</div>
            </div>
        </div>
    `;
}

// --- 3. Main Export ---
export function renderHeatmaps(cleanLogData, plannedJson) {
    const complianceMap = getComplianceMap(cleanLogData, plannedJson);
    
    const today = new Date(); 
    today.setHours(0,0,0,0);
    
    // 6-Month Rolling Window
    const startWindow = new Date(today);
    startWindow.setMonth(today.getMonth() - 6);
    
    // Normalize to start of week if desired, or just strictly 6 months. 
    // Let's keep strict 6 months for rolling window accuracy.
    
    const endWindow = new Date(today);

    const heatmapHtml = buildHeatmap(complianceMap, startWindow, endWindow, `Consistency (Last 6 Months)`, 'heatmap-scroll');

    // Auto-scroll logic
    setTimeout(() => {
        const el = document.getElementById('heatmap-scroll');
        if(el) el.scrollLeft = el.scrollWidth;
    }, 100);

    return `<div class="mt-8 mb-8">${heatmapHtml}</div>`;
}
