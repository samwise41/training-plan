// js/views/readiness.js

// --- GLOBAL TOGGLE (Safe Declaration) ---
if (!window.toggleSection) {
    window.toggleSection = (id) => {
        const content = document.getElementById(id);
        if (!content) return;
        const header = content.previousElementSibling;
        const icon = header.querySelector('i.fa-caret-down');

        const isCollapsed = content.classList.contains('max-h-0');

        if (isCollapsed) {
            content.classList.remove('max-h-0', 'opacity-0', 'py-0', 'mb-0');
            content.classList.add('max-h-[5000px]', 'opacity-100', 'py-4', 'mb-8'); 
            if (icon) {
                icon.classList.add('rotate-0');
                icon.classList.remove('-rotate-90');
            }
        } else {
            content.classList.add('max-h-0', 'opacity-0', 'py-0', 'mb-0');
            content.classList.remove('max-h-[5000px]', 'opacity-100', 'py-4', 'mb-8');
            if (icon) {
                icon.classList.remove('rotate-0');
                icon.classList.add('-rotate-90');
            }
        }
    };
}

// --- HELPER: COLLAPSIBLE SECTION ---
const buildCollapsibleSection = (id, title, contentHtml, isOpen = true) => {
    const contentClasses = isOpen 
        ? "max-h-[5000px] opacity-100 py-4 mb-8" 
        : "max-h-0 opacity-0 py-0 mb-0";
    const iconClasses = isOpen 
        ? "rotate-0" 
        : "-rotate-90";

    return `
        <div class="w-full">
            <div class="flex items-center gap-2 cursor-pointer py-3 border-b-2 border-slate-700 hover:border-slate-500 transition-colors group select-none" onclick="window.toggleSection('${id}')">
                <i class="fa-solid fa-caret-down text-slate-400 text-base transition-transform duration-300 group-hover:text-white ${iconClasses}"></i>
                <h2 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">${title}</h2>
            </div>
            <div id="${id}" class="collapsible-content overflow-hidden transition-all duration-500 ease-in-out ${contentClasses}">
                ${contentHtml}
            </div>
        </div>
    `;
};

export function renderReadiness(mergedLogData, planMd) {
    // --- 1. SCOPED VARIABLES (Fixes 'not defined' error) ---
    let maxSwim = 0;
    let maxBike = 0;
    let maxRun = 0;

    // --- 2. DATA PROCESSING ---
    if (!planMd) return '<div class="p-8 text-slate-500 italic">No plan data found.</div>';
    
    // Parse Plan
    const lines = planMd.split('\n');
    let inTable = false;
    let events = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('| **Date** |')) { inTable = true; continue; }
        if (inTable && line.startsWith('| :---')) continue; 
        if (inTable && line.startsWith('|')) {
            const cleanLine = line.replace(/^\||\|$/g, '');
            const cols = cleanLine.split('|').map(c => c.trim());
            if (cols.length >= 2) {
                events.push({
                    dateStr: cols[0],
                    name: cols[1],
                    priority: cols[3] || 'C',
                    swimGoal: cols[7] || '',
                    bikeGoal: cols[9] || '',
                    runGoal: cols[11] || ''
                });
            }
        } else if (inTable && line === '') { inTable = false; }
    }

    events.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
    const today = new Date();
    today.setHours(0,0,0,0);
    const upcomingEvents = events.filter(e => {
        const d = new Date(e.dateStr);
        return !isNaN(d.getTime()) && d >= today;
    });

    // Parse Log Data for Max Durations
    const parseDur = (str) => {
        if (!str || str === '-' || str.toLowerCase() === 'n/a') return 0;
        if (str.includes('km') || str.includes('mi')) return 0;
        if (!isNaN(str) && str.trim() !== '') return parseInt(str);
        let mins = 0;
        if (str.includes('h')) {
            const hParts = str.split('h');
            mins += parseInt(hParts[0]) * 60;
            if (hParts[1] && hParts[1].includes('m')) mins += parseInt(hParts[1]);
        } else if (str.includes('m')) {
            mins += parseInt(str);
        } else if (str.includes(':')) {
            const parts = str.split(':');
            mins += parseInt(parts[0]) * 60 + parseInt(parts[1] || 0); 
        }
        return Math.round(mins);
    };

    const formatTime = (mins) => {
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    const safeLog = Array.isArray(mergedLogData) ? mergedLogData : [];

    safeLog.forEach(d => {
        const entryDate = new Date(d.date);
        if (entryDate >= lookbackDate) {
            let dur = 0;
            if (typeof d.actualDuration === 'number') dur = d.actualDuration;
            else if (typeof d.duration === 'string') dur = parseDur(d.duration);
            
            if (d.type === 'Swim') maxSwim = Math.max(maxSwim, dur);
            if (d.type === 'Bike') maxBike = Math.max(maxBike, dur);
            if (d.type === 'Run') maxRun = Math.max(maxRun, dur);
        }
    });

    // --- 3. BUILD SECTIONS ---

    // A. GUIDE SECTION
    const guideHtml = `
    <div class="max-w-5xl mx-auto bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
        <div class="bg-slate-900/80 p-3 border-b border-slate-700 flex items-center gap-2">
            <i class="fa-solid fa-circle-info text-blue-400"></i>
            <span class="text-xs font-bold text-slate-300 uppercase tracking-wider">Readiness Guide</span>
        </div>
        <div class="grid grid-cols-3 text-center py-4 px-2">
            <div class="flex flex-col items-center">
                <div class="w-3 h-3 rounded-full bg-emerald-500 mb-2 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <span class="text-[10px] font-black text-emerald-500 uppercase">Race Ready</span>
                <span class="text-[10px] text-slate-400">85% - 100%</span>
            </div>
            <div class="flex flex-col items-center border-x border-slate-700">
                <div class="w-3 h-3 rounded-full bg-yellow-500 mb-2 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                <span class="text-[10px] font-black text-yellow-500 uppercase">Developing</span>
                <span class="text-[10px] text-slate-400">60% - 84%</span>
            </div>
            <div class="flex flex-col items-center">
                <div class="w-3 h-3 rounded-full bg-red-500 mb-2 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                <span class="text-[10px] font-black text-red-500 uppercase">Warning</span>
                <span class="text-[10px] text-slate-400">&lt; 60%</span>
            </div>
        </div>
        <div class="bg-slate-900/30 p-2 text-center border-t border-slate-700/50">
            <p class="text-[9px] text-slate-500 italic">Score = (Longest Session in 30 Days / Goal) for your <strong>weakest</strong> discipline.</p>
        </div>
    </div>`;

    // B. EVENTS SECTION
    let eventsHtml = '';
    const sportConfig = {
        swim: { color: 'text-swim', icon: 'fa-person-swimming', label: 'Swim' },
        bike: { color: 'text-bike', icon: 'fa-person-biking', label: 'Bike' },
        run:  { color: 'text-run',  icon: 'fa-person-running',  label: 'Run' }
    };

    if (upcomingEvents.length === 0) {
        eventsHtml = '<div class="p-8 text-center text-slate-500 text-lg">No upcoming events found in your plan.</div>';
    } else {
        upcomingEvents.forEach(e => {
            const raceDate = new Date(e.dateStr);
            const tgtSwim = parseDur(e.swimGoal);
            const tgtBike = parseDur(e.bikeGoal);
            const tgtRun  = parseDur(e.runGoal);

            const getPct = (curr, tgt) => tgt > 0 ? Math.min(Math.round((curr/tgt)*100), 100) : 0;
            const swimPct = getPct(maxSwim, tgtSwim);
            const bikePct = getPct(maxBike, tgtBike);
            const runPct  = getPct(maxRun, tgtRun);

            const activePcts = [];
            if (tgtSwim > 0) activePcts.push(swimPct);
            if (tgtBike > 0) activePcts.push(bikePct);
            if (tgtRun > 0)  activePcts.push(runPct);
            
            const readinessScore = activePcts.length > 0 ? Math.min(...activePcts) : 0;

            let scoreColor = "text-red-500";
            let scoreLabel = "Warning";
            if (readinessScore >= 85) { scoreColor = "text-emerald-500"; scoreLabel = "Race Ready"; }
            else if (readinessScore >= 60) { scoreColor = "text-yellow-500"; scoreLabel = "Developing"; }

            const daysDiff = Math.ceil((raceDate - today) / (1000 * 60 * 60 * 24));
            const weeks = Math.floor(daysDiff / 7);
            const days = daysDiff % 7;
            const timeString = `${weeks}W ${days}D TO GO`;

            // Inner helper to ensure 'maxBike' is accessible via arguments
            const buildBar = (type, current, target, pct) => {
                if (!target || target === 0) return ''; 
                const config = sportConfig[type];
                const barColor = pct >= 85 ? 'bg-emerald-500' : (pct >= 60 ? 'bg-yellow-500' : 'bg-red-500');
                
                return `
                    <div class="mb-5 last:mb-0">
                        <div class="flex justify-between items-end mb-1">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid ${config.icon} ${config.color}"></i>
                                <span class="text-xs font-bold text-slate-400">${config.label}</span>
                            </div>
                            <div class="text-right">
                                 <span class="text-xs font-bold text-white">${formatTime(current)} / ${formatTime(target)}</span>
                            </div>
                        </div>
                        <div class="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden relative">
                            <div class="${barColor} h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.3)]" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            };

            eventsHtml += `
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-0 mb-8 overflow-hidden shadow-lg relative max-w-5xl mx-auto">
                <div class="bg-slate-900/50 border-b border-slate-700 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <div class="bg-slate-700 p-2 rounded-lg text-white"><i class="fa-solid fa-flag-checkered"></i></div>
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
                        <div class="text-[10px] font-mono ${scoreColor} mt-1 border border-slate-700/50 px-2 py-0.5 rounded bg-slate-900/30">${scoreLabel}</div>
                    </div>
                    <div class="md:w-3/4 w-full">
                        ${buildBar('swim', maxSwim, tgtSwim, swimPct)}
                        ${buildBar('bike', maxBike, tgtBike, bikePct)}
                        ${buildBar('run', maxRun, tgtRun, runPct)}
                    </div>
                </div>
            </div>`;
        });
    }

    // --- 4. RETURN COLLAPSIBLE LAYOUT ---
    return `
        <div class="max-w-5xl mx-auto space-y-4">
            ${buildCollapsibleSection('readiness-guide', 'Legend & Logic', guideHtml, true)}
            ${buildCollapsibleSection('readiness-events', 'Event Status', eventsHtml, true)}
        </div>
    `;
}

export function renderReadinessChart(logData) {
    // Placeholder to satisfy imports
}
