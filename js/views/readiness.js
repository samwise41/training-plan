// js/views/readiness.js

export function renderReadiness(mergedLogData, planMd) {
    if (!planMd) return '<div class="p-8 text-slate-500 italic">No plan data found.</div>';

    const safePlan = typeof planMd === 'string' ? planMd : '';
    const lines = safePlan.split('\n');
    let inTable = false;
    let events = [];
    
    // 1. Parse Data
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('| **Date** |')) { inTable = true; continue; }
        if (inTable && line.startsWith('| :---')) continue; 
        if (inTable && line.startsWith('|')) {
            const cleanLine = line.replace(/^\||\|$/g, '');
            const cols = cleanLine.split('|').map(c => c.trim());
            if (cols.length >= 2) {
                events.push({
                    dateStr: cols[0], name: cols[1], priority: cols[3] || 'C',
                    swimGoal: cols[7] || '', bikeGoal: cols[9] || '', runGoal: cols[11] || ''
                });
            }
        } else if (inTable && line === '') { inTable = false; }
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    const upcomingEvents = events.filter(e => {
        const d = new Date(e.dateStr);
        return !isNaN(d.getTime()) && d >= today;
    }).sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));

    // 2. Helpers
    const parseDur = (str) => {
        if (!str || str === '-' || str.toLowerCase() === 'n/a') return 0;
        let mins = 0;
        if (str.includes('h')) {
            const hParts = str.split('h');
            mins += parseInt(hParts[0]) * 60;
            if (hParts[1] && hParts[1].includes('m')) mins += parseInt(hParts[1]);
        } else {
            mins = parseInt(str.replace(/[^\d]/g, '')) || 0;
        }
        return mins;
    };

    const formatTime = (mins) => `${Math.floor(mins / 60)}:${Math.round(mins % 60).toString().padStart(2, '0')}`;

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    let maxSwim = 0, maxBike = 0, maxRun = 0;
    const safeLog = Array.isArray(mergedLogData) ? mergedLogData : [];

    safeLog.forEach(d => {
        if (new Date(d.date) >= lookbackDate) {
            const dur = typeof d.actualDuration === 'number' ? d.actualDuration : parseDur(String(d.duration || 0));
            if (d.type === 'Swim') maxSwim = Math.max(maxSwim, dur);
            if (d.type === 'Bike') maxBike = Math.max(maxBike, dur);
            if (d.type === 'Run') maxRun = Math.max(maxRun, dur);
        }
    });

    // 3. STARTING HTML - This Guide section is now a fixed part of the string
    let html = `
    <div class="max-w-5xl mx-auto mb-8 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
        <div class="bg-slate-900/80 p-3 border-b border-slate-700 flex items-center gap-2">
            <i class="fa-solid fa-circle-info text-blue-400"></i>
            <span class="text-xs font-bold text-slate-300 uppercase tracking-wider">Readiness Guide</span>
        </div>
        <div class="grid grid-cols-3 text-center py-4 px-2">
            <div class="flex flex-col items-center">
                <div class="w-3 h-3 rounded-full bg-emerald-500 mb-2"></div>
                <span class="text-[10px] font-black text-emerald-500 uppercase">Race Ready</span>
                <span class="text-[10px] text-slate-400">85% - 100%</span>
            </div>
            <div class="flex flex-col items-center border-x border-slate-700">
                <div class="w-3 h-3 rounded-full bg-yellow-500 mb-2"></div>
                <span class="text-[10px] font-black text-yellow-500 uppercase">Developing</span>
                <span class="text-[10px] text-slate-400">60% - 84%</span>
            </div>
            <div class="flex flex-col items-center">
                <div class="w-3 h-3 rounded-full bg-red-500 mb-2"></div>
                <span class="text-[10px] font-black text-red-500 uppercase">Warning</span>
                <span class="text-[10px] text-slate-400">&lt; 60%</span>
            </div>
        </div>
    </div>`;

    if (upcomingEvents.length === 0) {
        return html + '<div class="p-8 text-center text-slate-500 text-lg">No upcoming events found.</div>';
    }

    // 4. Loop Events
    upcomingEvents.forEach(e => {
        const tgtSwim = parseDur(e.swimGoal);
        const tgtBike = parseDur(e.bikeGoal);
        const tgtRun  = parseDur(e.runGoal);

        const swimPct = tgtSwim > 0 ? Math.min(Math.round((maxSwim/tgtSwim)*100), 100) : 0;
        const bikePct = tgtBike > 0 ? Math.min(Math.round((maxBike/tgtBike)*100), 100) : 0;
        const runPct  = tgtRun > 0 ? Math.min(Math.round((maxRun/tgtRun)*100), 100) : 0;

        const activePcts = [];
        if (tgtSwim > 0) activePcts.push(swimPct);
        if (tgtBike > 0) activePcts.push(bikePct);
        if (tgtRun > 0)  activePcts.push(runPct);
        const readinessScore = activePcts.length > 0 ? Math.min(...activePcts) : 0;

        const scoreColor = readinessScore >= 85 ? "text-emerald-500" : (readinessScore >= 60 ? "text-yellow-500" : "text-red-500");
        const scoreLabel = readinessScore >= 85 ? "Race Ready" : (readinessScore >= 60 ? "Developing" : "Warning");

        const daysDiff = Math.ceil((new Date(e.dateStr) - today) / 86400000);
        
        html += `
        <div class="bg-slate-800 border border-slate-700 rounded-xl mb-8 overflow-hidden shadow-lg max-w-5xl mx-auto">
            <div class="bg-slate-900/50 border-b border-slate-700 p-4 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="bg-slate-700 p-2 rounded-lg text-white"><i class="fa-solid fa-flag-checkered"></i></div>
                    <div><h3 class="text-lg font-bold text-white">${e.name}</h3></div>
                </div>
                <div class="text-xs font-bold text-white bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                    ${Math.floor(daysDiff / 7)}W ${daysDiff % 7}D TO GO
                </div>
            </div>
            <div class="p-6 flex flex-col md:flex-row gap-8 items-center">
                <div class="md:w-1/4 text-center border-b md:border-b-0 md:border-r border-slate-700 pb-6 md:pb-0 md:pr-6">
                    <div class="text-6xl font-black ${scoreColor}">${readinessScore}%</div>
                    <div class="text-[10px] font-mono ${scoreColor} mt-1 uppercase">${scoreLabel}</div>
                </div>
                <div class="md:w-3/4 w-full">
                    ${tgtSwim > 0 ? buildBar('Swim', maxSwim, tgtSwim, swimPct, 'text-swim') : ''}
                    ${tgtBike > 0 ? buildBar('Bike', maxBike, tgtBike, bikePct, 'text-bike') : ''}
                    ${tgtRun > 0 ? buildBar('Run', maxRun, tgtRun, runPct, 'text-run') : ''}
                </div>
            </div>
        </div>`;
    });

    function buildBar(label, curr, tgt, pct, colorClass) {
        const barColor = pct >= 85 ? 'bg-emerald-500' : (pct >= 60 ? 'bg-yellow-500' : 'bg-red-500');
        return `
            <div class="mb-4 last:mb-0">
                <div class="flex justify-between text-[10px] font-bold mb-1">
                    <span class="${colorClass}">${label.toUpperCase()}</span>
                    <span class="text-white">${formatTime(curr)} / ${formatTime(tgt)}</span>
                </div>
                <div class="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                    <div class="${barColor} h-full transition-all duration-1000" style="width: ${pct}%"></div>
                </div>
            </div>`;
    }

    return html;
}

export function renderReadinessChart(logData) {}
