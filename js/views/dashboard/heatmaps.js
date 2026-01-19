import { toLocalYMD } from './utils.js';

// --- 1. Helper: Detect Sport from Planned Workout Text ---
function detectPlannedSport(text) {
    if (!text) return null;
    const s = text.toUpperCase();
    if (s.includes('RUN') || s.includes('JOG')) return 'Run';
    if (s.includes('BIKE') || s.includes('RIDE') || s.includes('CYCL')) return 'Bike';
    if (s.includes('SWIM') || s.includes('POOL')) return 'Swim';
    return null;
}

// --- 2. Aggregation Logic ---
function getComplianceMap(fullLog) {
    const map = {};

    if (!fullLog || !Array.isArray(fullLog)) {
        console.warn("Heatmaps: No log data found.");
        return map;
    }

    // Step 1: Aggregate Plan and Actuals by Date
    fullLog.forEach(d => {
        const k = toLocalYMD(d.date);
        
        // Ensure Day Entry Exists
        if (!map[k]) map[k] = { 
            planned: 0, 
            actualMatching: 0, 
            plannedSports: new Set(),
            rawActuals: [], // Store actuals to match later
            details: [] 
        };

        const src = d.source || {};

        // A. Process PLAN
        // Use EXACT fields from training_log.json
        const pDur = Number(src.plannedDuration) || 0;
        const pText = src.plannedWorkout || "";

        if (pDur > 0) {
            map[k].planned += pDur;
            
            // Detect sport from the text (e.g. "Roy - Base Run" -> "Run")
            const detectedSport = detectPlannedSport(pText);
            if (detectedSport) {
                map[k].plannedSports.add(detectedSport);
            } else {
                // Fallback: if no sport found in text, assume the actualSport matches the plan
                // (This handles cases like "Zone 2" where sport isn't explicit in title)
                if (src.actualSport) map[k].plannedSports.add(src.actualSport);
            }

            map[k].details.push(`Plan: ${pText || "Workout"} (${Math.round(pDur)}m)`);
        }

        // B. Process ACTUAL
        // Use EXACT fields from training_log.json
        const aDur = Number(src.actualDuration) || 0;
        const aSport = src.actualSport || "Other";
        const aText = src.actualWorkout || "Workout";

        if (aDur > 0) {
            map[k].rawActuals.push({ sport: aSport, dur: aDur });
            
            // Icon for tooltip
            let icon = '▪️';
            if (aSport === 'Run') icon = '🏃';
            if (aSport === 'Bike') icon = '🚴';
            if (aSport === 'Swim') icon = '🏊';

            map[k].details.push(`Act: ${icon} ${aText} (${Math.round(aDur)}m)`);
        }
    });

    // Step 2: Calculate Compliance (Sum matching actuals)
    Object.keys(map).forEach(k => {
        const day = map[k];
        
        if (day.planned > 0) {
            day.rawActuals.forEach(act => {
                // If the actual sport matches ANY planned sport for that day, count it.
                // If plannedSports is empty (fallback), we accept everything.
                if (day.plannedSports.size === 0 || day.plannedSports.has(act.sport)) {
                    day.actualMatching += act.dur;
                }
            });
        }
    });

    return map;
}

// --- 3. Grid Builder ---
function buildHeatmap(dataMap, startDate, endDate, title, containerId) {
    const startDay = startDate.getDay(); 
    let cells = '';
    
    // Grid Alignment Offset
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
        const uniqueDetails = entry.details ? [...new Set(entry.details)] : [];
        const detailsStr = uniqueDetails.join('<br>');

        // --- COLOR LOGIC ---
        if (planned > 0) {
            if (isFuture) {
                bg = 'bg-slate-700'; // Future Plan
                tooltip = `Planned: ${Math.round(planned)}m`;
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
            // No Plan = Gray
            bg = cur.getDay() === 0 ? 'bg-slate-800/30' : 'bg-slate-800/50';
        }

        const clickAttr = (planned > 0 || uniqueDetails.length > 0) ? 
            `onclick="window.showDashboardTooltip(event, '${k}', ${Math.round(planned)}, ${Math.round(actualMatching)}, '${tooltip}', '#fff', 'Compliance', '${detailsStr.replace(/'/g, "")}')"` : '';
        
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
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-emerald-500"></div> Done</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-yellow-500"></div> Partial</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-red-500"></div> Missed</div>
                <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-sm bg-slate-700"></div> Planned</div>
            </div>
        </div>
    `;
}

// --- 4. Main Export ---
export function renderHeatmaps(cleanLogData) {
    const complianceMap = getComplianceMap(cleanLogData);
    
    const today = new Date(); 
    today.setHours(0,0,0,0);
    
    // 6 Month Window
    const startWindow = new Date(today);
    startWindow.setMonth(today.getMonth() - 6);
    
    // Align to Sunday
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
