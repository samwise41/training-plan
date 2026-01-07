// js/views/readiness.js

export function renderReadiness(mergedLogData, planMd) {
    // 1. Parse Event Schedule
    if (!planMd) return '<div class="p-8 text-slate-500 italic">No plan data found.</div>';

    // Handle case where planMd might be passed as object or wrong type
    const safePlan = typeof planMd === 'string' ? planMd : '';
    if (!safePlan) return '<div class="p-8 text-slate-500 italic">Invalid plan format.</div>';

    const lines = safePlan.split('\n');
    let inTable = false;
    let events = [];
    
    // Parse the Markdown Table for Events
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('| **Date** |')) {
            inTable = true;
            continue; 
        }
        if (inTable && line.startsWith('| :---')) continue; 
        if (inTable && line.startsWith('|')) {
            const cols = line.split('|').map(c => c.trim()).filter(c => c !== '');
            // Ensure we have enough columns (up to Run Goal index 11)
            if (cols.length >= 10) {
                events.push({
                    dateStr: cols[0],
                    name: cols[1],
                    goal: cols[2],
                    priority: cols[3],
                    swimGoal: cols[7],
                    bikeGoal: cols[9],
                    runGoal: cols[11]
                });
            }
        } else if (inTable && line === '') {
            inTable = false; 
        }
    }

    // Sort events by date
    events.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));

    // Filter out past events
    const today = new Date();
    today.setHours(0,0,0,0);
    const upcomingEvents = events.filter(e => {
        const d = new Date(e.dateStr);
        return !isNaN(d.getTime()) && d >= today;
    });

    if (upcomingEvents.length === 0) {
        return '<div class="p-8 text-center text-slate-500 text-lg">No upcoming events found in your plan.</div>';
    }

    // 2. Helper Functions
    const parseDur = (str) => {
        if (!str) return 0;
        // Clean string
        const clean = str.replace(/[^\d:]/g, ''); 
        const parts = clean.split(':');
        let mins = 0;
        if (parts.length === 3) {
            mins = parseInt(parts[0])*60 + parseInt(parts[1]) + parseInt(parts[2])/60;
        } else if (parts.length === 2) {
            mins = parseInt(parts[0])*60 + parseInt(parts[1]); 
        } else {
             mins = parseInt(clean) || 0;
        }
        return Math.round(mins);
    };

    // Calculate Max Duration in last 30 days per sport
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    
    let maxSwim = 0, maxBike = 0, maxRun = 0;
    
    // Safety check for array
    const safeLog = Array.isArray(mergedLogData) ? mergedLogData : [];

    if (safeLog.length > 0) {
        safeLog.forEach(d => {
            const entryDate = new Date(d.date);
            if (entryDate >= lookbackDate) {
                // Parse duration from log entry (usually "1h 30m" format or minutes)
                let dur = 0;
                if (typeof d.actualDuration === 'number') {
                    dur = d.actualDuration;
                } else if (typeof d.duration === 'string') {
                     // Parse "1h 30m" string to minutes
                    let m = 0;
                    if(d.duration.includes('h')) m += parseInt(d.duration.split('h')[0]) * 60;
                    if(d.duration.includes('m')) m += parseInt(d.duration.split('m')[0].split(' ').pop());
                    dur = m;
                }

                if (d.type === 'Swim') maxSwim = Math.max(maxSwim, dur);
                if (d.type === 'Bike') maxBike = Math.max(maxBike, dur);
                if (d.type === 'Run') maxRun = Math.max(maxRun, dur);
            }
        });
    }

    // 3. Build Widgets
    let html = '';

    upcomingEvents.forEach(e => {
        const raceDate = new Date(e.dateStr);
        
        // Goals
        const tgtSwim = parseDur(e.swimGoal);
        const tgtBike = parseDur(e.bikeGoal);
        const tgtRun = parseDur(e.runGoal);

        // Percentages
        const getPct = (curr, tgt) => tgt > 0 ? Math.min(Math.round((curr/tgt)*100), 100) : 0;
        
        const swimPct = getPct(maxSwim, tgtSwim);
        const bikePct = getPct(maxBike, tgtBike);
        const runPct = getPct(maxRun, tgtRun);

        // --- WEAKEST LINK LOGIC ---
        const activePcts = [];
        if (tgtSwim > 0) activePcts.push(swimPct);
        if (tgtBike > 0) activePcts.push(bikePct);
        if (tgtRun > 0) activePcts.push(runPct);
        
        const readinessScore = activePcts.length > 0 ? Math.min(...activePcts) : 0;

        // --- TIER LOGIC ---
        let scoreColor = "text-red-500";
        let scoreLabel = "Warning";
        let cardBorder = "border-slate-700";

        if (readinessScore >= 85) {
            scoreColor = "text-emerald-500";
            scoreLabel = "Race Ready";
        } else if (readinessScore >= 60) {
            scoreColor = "text-yellow-500";
            scoreLabel = "Developing";
        }

        // Time to Go
        const daysDiff = Math.ceil((raceDate - today) / (1000 * 60 * 60 * 24));
        const weeks = Math.floor(daysDiff / 7);
        const days = daysDiff % 7;
        const timeString = `${weeks}W ${days}D TO GO`;

        // Bar Builder
        const buildBar = (label, current, target, pct) => {
            if (!target || target === 0) return ''; 
            const barColor = pct >= 85 ? 'bg-emerald-500' : (pct >= 60 ? 'bg-yellow-500' : 'bg-red-500');
            
            return `
                <div class="mb-5 last:mb-0">
                    <div class="flex justify-between items-end mb-1">
                        <span class="text-xs font-bold text-slate-400">${label}</span>
                        <div class="text-right">
                             <span class="text-xs font-bold text-white">${current}m / ${target}m</span>
                        </div>
                    </div>
                    <div class="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden relative">
                        <div class="${barColor} h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style="width: ${pct}%"></div>
                    </div>
                    <div class="text-right mt-0.5">
                        <span class="text-[10px] font-bold ${pct >= 85 ? 'text-emerald-500' : (pct >= 60 ? 'text-yellow-500' : 'text-red-500')}">${pct}%</span>
                    </div>
                </div>
            `;
        };

        html += `
        <div class="bg-slate-800 border ${cardBorder} rounded-xl p-0 mb-8 overflow-hidden shadow-lg relative max-w-5xl mx-auto">
            
            <div class="bg-slate-900/50 border-b border-slate-700 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-center gap-3">
                    <i class="fa-solid fa-flag-checkered text-white bg-slate-700 p-2 rounded-lg"></i>
                    <div>
                        <h3 class="text-lg font-bold text-white leading-none">${e.name}</h3>
                        <div class="text-xs text-slate-500 font-mono mt-1">${e.priority} Event</div>
                    </div>
                </div>
                <div class="flex items-center gap-4 text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
                    <div class="flex items-center gap-2"><i class="fa-regular fa-calendar"></i> ${raceDate.toLocaleDateString()}</div>
                    <div class="w-px h-3 bg-slate-600"></div>
                    <div class="flex items-center gap-2 font-bold text-white"><i class="fa-solid fa-hourglass-half"></i> ${timeString}</div>
                </div>
            </div>

            <div class="p-6 flex flex-col md:flex-row gap-8 items-center">
                
                <div class="md:w-1/4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-700 pb-6 md:pb-0 md:pr-6 w-full">
                    <div class="text-6xl font-black ${scoreColor} tracking-tighter drop-shadow-sm">${readinessScore}%</div>
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Readiness</div>
                    <div class="text-[10px] font-mono ${scoreColor} mt-1 border border-slate-700/50 px-2 py-0.5 rounded bg-slate-900/30">
                        ${scoreLabel}
                    </div>
                </div>

                <div class="md:w-3/4 w-full">
                    ${buildBar('Swim Longest Session (30d)', maxSwim, tgtSwim, swimPct)}
                    ${buildBar('Bike Longest Session (30d)', maxBike, tgtBike, bikePct)}
                    ${buildBar('Run Longest Session (30d)', maxRun, tgtRun, runPct)}
                    
                    <div class="mt-6 pt-4 border-t border-slate-700/50 text-[10px] text-slate-500 italic flex items-start gap-2">
                        <i class="fa-solid fa-circle-info mt-0.5"></i>
                        <span>Score is determined by your <strong>weakest discipline</strong>. Even if your total volume is high, falling behind on the specific Long Session duration for any single sport will drag your readiness score down to prevent injury risks.</span>
                    </div>
                </div>

            </div>
            
            <div class="px-6 pb-6 w-full">
                <canvas id="chart-${e.dateStr}" class="w-full h-16"></canvas>
            </div>
        </div>
        `;
    });

    return html;
}

// Added this function so App.js doesn't crash when it calls it
export function renderReadinessChart(logData) {
    // This is optional if you want a global chart. 
    // The main visualization is now inside the HTML generated above.
    console.log("Readiness charts are rendered inline.");
}
