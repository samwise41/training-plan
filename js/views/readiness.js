// js/views/readiness.js

export function renderReadiness(mergedLogData, planMd) {
    // 1. Parse Event Schedule
    if (!planMd) return '<div class="p-8 text-slate-500 italic">No plan data found.</div>';

    const safePlan = typeof planMd === 'string' ? planMd : '';
    if (!safePlan) return '<div class="p-8 text-slate-500 italic">Invalid plan format.</div>';

    const lines = safePlan.split('\n');
    let inTable = false;
    let events = [];
    
    // Parse the Markdown Table for Events
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Detect table start
        if (line.includes('| **Date** |')) {
            inTable = true;
            continue; 
        }
        // Skip separator lines
        if (inTable && line.startsWith('| :---')) continue; 
        
        // Process Data Rows
        if (inTable && line.startsWith('|')) {
            const cols = line.split('|').map(c => c.trim()).filter(c => c !== '');
            // We need at least the Date and Name (index 0 and 1)
            if (cols.length >= 2) {
                // Safe access to columns (handle missing columns for single-sport events)
                events.push({
                    dateStr: cols[0],
                    name: cols[1],
                    priority: cols[3] || 'C', // Default to C priority if missing
                    swimGoal: cols[7] || '',
                    bikeGoal: cols[9] || '',
                    runGoal: cols[11] || ''
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
    
    // Parse Duration (handles "1h 30m", "45m", "-", "N/A")
    const parseDur = (str) => {
        if (!str || str === '-' || str.toLowerCase() === 'n/a') return 0;
        
        // If it's just a number, assume minutes
        if (!isNaN(str)) return parseInt(str);

        let mins = 0;
        // Parse "1h 30m" format
        if (str.includes('h')) {
            const hParts = str.split('h');
            mins += parseInt(hParts[0]) * 60;
            if (hParts[1] && hParts[1].includes('m')) {
                mins += parseInt(hParts[1]);
            }
        } else if (str.includes('m')) {
            mins += parseInt(str);
        } else if (str.includes(':')) {
            // Parse "1:30" format
            const parts = str.split(':');
            mins += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        return Math.round(mins);
    };

    // Calculate Max Duration in last 30 days per sport
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    
    let maxSwim = 0, maxBike = 0, maxRun = 0;
    
    const safeLog = Array.isArray(mergedLogData) ? mergedLogData : [];

    if (safeLog.length > 0) {
        safeLog.forEach(d => {
            const entryDate = new Date(d.date);
            if (entryDate >= lookbackDate) {
                let dur = 0;
                if (typeof d.actualDuration === 'number') {
                    dur = d.actualDuration;
                } else if (typeof d.duration === 'string') {
                    dur = parseDur(d.duration);
                }

                if (d.type === 'Swim') maxSwim = Math.max(maxSwim, dur);
                if (d.type === 'Bike') maxBike = Math.max(maxBike, dur);
                if (d.type === 'Run') maxRun = Math.max(maxRun, dur);
            }
        });
    }

    // 3. Configuration for Colors & Icons
    const sportConfig = {
        swim: { color: 'text-cyan-400', barBg: 'bg-cyan-500', icon: 'fa-person-swimming', label: 'Swim' },
        bike: { color: 'text-purple-400', barBg: 'bg-purple-500', icon: 'fa-person-biking', label: 'Bike' },
        run:  { color: 'text-pink-400', barBg: 'bg-pink-500', icon: 'fa-person-running', label: 'Run' }
    };

    // 4. Build HTML
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

        // --- READINESS SCORE LOGIC ---
        // Only include sports that have a target > 0
        const activePcts = [];
        if (tgtSwim > 0) activePcts.push(swimPct);
        if (tgtBike > 0) activePcts.push(bikePct);
        if (tgtRun > 0) activePcts.push(runPct);
        
        // If no sports found (e.g. data error), default to 0
        const readinessScore = activePcts.length > 0 ? Math.min(...activePcts) : 0;

        // --- TIER LOGIC ---
        let scoreColor = "text-red-500";
        let scoreLabel = "Warning";
        
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

        // Bar Builder Helper
        const buildBar = (type, current, target, pct) => {
            if (!target || target === 0) return ''; // Hide bar if not part of event
            
            const config = sportConfig[type];
            
            return `
                <div class="mb-5 last:mb-0">
                    <div class="flex justify-between items-end mb-1">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid ${config.icon} ${config.color}"></i>
                            <span class="text-xs font-bold text-slate-400">${config.label}</span>
                        </div>
                        <div class="text-right">
                             <span class="text-xs font-bold text-white">${current}m / ${target}m</span>
                        </div>
                    </div>
                    <div class="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden relative">
                        <div class="${config.barBg} h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.3)]" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        };

        html += `
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-0 mb-8 overflow-hidden shadow-lg relative max-w-5xl mx-auto">
            
            <div class="bg-slate-900/50 border-b border-slate-700 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-center gap-3">
                    <div class="bg-slate-700 p-2 rounded-lg text-white">
                        <i class="fa-solid fa-flag-checkered"></i>
                    </div>
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
                    ${buildBar('swim', maxSwim, tgtSwim, swimPct)}
                    ${buildBar('bike', maxBike, tgtBike, bikePct)}
                    ${buildBar('run', maxRun, tgtRun, runPct)}
                    
                    <div class="mt-6 pt-4 border-t border-slate-700/50 text-[10px] text-slate-500 italic flex items-start gap-2">
                        <i class="fa-solid fa-circle-info mt-0.5"></i>
                        <span>Score based on your <strong>weakest discipline</strong> vs target (Longest session in last 30d).</span>
                    </div>
                </div>

            </div>
        </div>
        `;
    });

    return html;
}

export function renderReadinessChart(logData) {
    // Placeholder to satisfy App.js import
}
