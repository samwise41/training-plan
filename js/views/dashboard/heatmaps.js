import { toLocalYMD } from './utils.js';

// --- 1. Helper: Parse Sport from Planned Text ---
function getPlannedSport(text) {
    if (!text) return null;
    const s = text.toUpperCase();
    if (s.includes('[RUN]') || s.includes('RUN')) return 'Run';
    if (s.includes('[BIKE]') || s.includes('BIKE') || s.includes('RIDE')) return 'Bike';
    if (s.includes('[SWIM]') || s.includes('SWIM') || s.includes('POOL')) return 'Swim';
    if (s.includes('[STRENGTH]') || s.includes('STRENGTH')) return 'Strength';
    return null;
}

// --- 2. Aggregation Logic (Single Source) ---
function getComplianceMap(fullLog) {
    const map = {};

    if (fullLog) {
        fullLog.forEach(d => {
            const k = toLocalYMD(d.date);
            
            // Init Day Entry
            if (!map[k]) map[k] = { 
                planned: 0, 
                actualMatching: 0, 
                plannedSports: new Set(),
                details: [] 
            };

            // A. Extract PLAN from the log entry (if available)
            // We check d.source because app.js stores the raw JSON there
            const rawPlanDur = d.source?.plannedDuration || d.source?.planned_duration || 0;
            const rawPlanText = d.source?.plannedWorkout || d.source?.planned_workout || "";
            
            // If this row has planning data, add it
            if (rawPlanDur > 0) {
                map[k].planned += Number(rawPlanDur);
                
                // Parse Sport from text (e.g. "[Run] Base miles")
                const pSport = getPlannedSport(rawPlanText);
                if (pSport) map[k].plannedSports.add(pSport);
                
                map[k].details.push(`Plan: ${rawPlanText} (${rawPlanDur}m)`);
            }

            // B. Extract ACTUAL from the log entry
            const actDur = d.duration || 0;
            if (actDur > 0) {
                // We store the actual, but we'll decide if it "matches" in the loop or after?
                // Actually, since we are looping one big list, we might process a "Plan Only" row 
                // and an "Actual Only" row for the same date. 
                
                // We can't determine matching perfectly until we know ALL planned sports for this day.
                // So we store the actuals in a temp array and process matching at the end?
                // OR: We just blindly add to details now and calculate matching sum later.
                
                // Let's store raw actuals to process after the loop
                if(!map[k].rawActuals) map[k].rawActuals = [];
                map[k].rawActuals.push({ sport: d.sport, dur: actDur });

                // Icon for tooltip
                let icon = '';
                if(d.sport === 'Run') icon = '🏃';
                else if(d.sport === 'Bike') icon = '🚴';
                else if(d.sport === 'Swim') icon = '🏊';
                
                map[k].details.push(`Act: ${icon} ${d.sport} (${Math.round(actDur)}m)`);
            }
        });
    }

    // C. Post-Process: Calculate Matching Actuals
    Object.keys(map).forEach(k => {
        const day = map[k];
        if (day.rawActuals) {
            day.rawActuals.forEach(act => {
                // If Plan exists, only count matching sports
                if (day.planned > 0) {
                    if (day.plannedSports.has(act.sport)) {
                        day.actualMatching += act.dur;
                    }
                } 
                // If No Plan exists, we don't really care about "matching" for the heatmap color (it stays gray)
            });
        }
    });

    return map;
}

// --- 3. Grid Builder ---
function buildHeatmap(dataMap, startDate, endDate, title, containerId) {
    const startDay = startDate.getDay(); // 0=Sun
    let cells = '';
    
    // Offset
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

        let bg = 'bg-slate-800'; 
        let tooltip = '';
        const { planned, actualMatching } = entry;
        const detailsStr = entry.details ? [...new Set(entry.details)].join('<br>') : ''; // Dedup details

        // --- COLOR LOGIC ---
        if (planned > 0) {
            if (isFuture) {
                bg = 'bg-slate-700'; 
                tooltip = `Planned: ${planned}m`;
            } else {
                if (actualMatching === 0) {
                    bg = 'bg-red-500'; // Missed
                    tooltip = 'Missed';
                } else {
                    const ratio = actualMatching / planned;
                    if (ratio >= 0.95) {
                        bg = 'bg-emerald-500'; // Completed
                        tooltip = 'Completed';
                    } else {
                        bg = 'bg-yellow-500'; // Partial
                        tooltip = `Partial (${Math.round(ratio*100)}%)`;
                    }
                }
            }
        } else {
            // No Plan
            bg = cur.getDay() === 0 ? 'bg-slate-800/30' : 'bg-slate-800/50';
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
// NOTE: We ignore the second argument (plannedJson) since we use ONLY cleanLogData
export function renderHeatmaps(cleanLogData) {
    const complianceMap = getComplianceMap(cleanLogData);
    
    const today = new Date(); 
    today.setHours(0,0,0,0);
    
    // 6-Month Rolling Window
    const startWindow = new Date(today);
    startWindow.setMonth(today.getMonth() - 6);
    
    // Align start to Sunday for cleaner grid
    const day = startWindow.getDay();
    startWindow.setDate(startWindow.getDate() - day);
    
    const endWindow = new Date(today);

    const heatmapHtml = buildHeatmap(complianceMap, startWindow, endWindow, `Consistency (Last 6 Months)`, 'heatmap-scroll');

    // Auto-scroll
    setTimeout(() => {
        const el = document.getElementById('heatmap-scroll');
        if(el) el.scrollLeft = el.scrollWidth;
    }, 100);

    return `<div class="mt-8 mb-8">${heatmapHtml}</div>`;
}
