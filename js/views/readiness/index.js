// js/views/readiness/index.js

// --- 1. CONFIG & HELPERS ---

const SPORT_CONFIG = {
    swim: { color: 'text-cyan-400', bar: 'bg-cyan-500', icon: 'fa-person-swimming', label: 'Swim' },
    bike: { color: 'text-purple-400', bar: 'bg-purple-500', icon: 'fa-person-biking', label: 'Bike' },
    climb: { color: 'text-fuchsia-400', bar: 'bg-fuchsia-500', icon: 'fa-mountain', label: 'Bike (Climb)' },
    run:  { color: 'text-pink-400', bar: 'bg-pink-500', icon: 'fa-person-running',  label: 'Run' }
};

// Formats
const formatTime = (mins) => {
    if (!mins) return "0:00";
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
};

const formatElev = (ft) => {
    return Math.round(ft).toLocaleString() + " ft";
};

const parseGoalValue = (str) => {
    if (!str || typeof str !== 'string') return 0;
    const clean = str.toLowerCase().replace(/\*/g, '').trim();
    if (clean === '-' || clean === '') return 0;
    
    // Elevation (ft)
    if (clean.includes('ft') || (clean.match(/^\d{1,3}(,\d{3})*$/) && !clean.includes(':'))) {
        const numStr = clean.replace(/,/g, '').replace('ft', '').trim();
        return parseInt(numStr) || 0;
    }

    // Duration (1h 30m or 1:30)
    let totalMinutes = 0;
    const hMatch = clean.match(/(\d+)\s*h/);
    const mMatch = clean.match(/(\d+)\s*m/);
    if (hMatch) totalMinutes += parseInt(hMatch[1]) * 60;
    if (mMatch) totalMinutes += parseInt(mMatch[1]);
    
    if (clean.includes(':')) {
        const parts = clean.split(':');
        totalMinutes += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        return totalMinutes;
    }
    
    if (!hMatch && !mMatch && !isNaN(parseInt(clean))) {
        totalMinutes = parseInt(clean);
    }
    return totalMinutes;
};

// --- 2. LOGIC (Updated for New App.js Schema) ---

const getEvents = (planMd) => {
    if (!planMd) return [];
    const lines = planMd.split('\n');
    let inTable = false;
    const today = new Date(); today.setHours(0,0,0,0);
    const events = [];

    for (let line of lines) {
        if (line.includes('| **Date** |')) { inTable = true; continue; }
        if (inTable && line.startsWith('| :---')) continue;
        if (inTable && line.startsWith('|')) {
            const cols = line.split('|').map(c => c.trim());
            // Indexes based on standard plan format: Date=1, Name=2, Swim=8, Bike=10, Elev=11, Run=12
            if (cols.length >= 12) {
                const d = new Date(cols[1]);
                if (!isNaN(d) && d >= today) {
                    events.push({
                        name: cols[2].replace(/\*\*/g, ''),
                        priority: cols[2].includes('**A-Race**') ? 'A-Race' : (cols[2].includes('**B-Race**') ? 'B-Race' : 'Event'),
                        date: d,
                        goals: {
                            swim: parseGoalValue(cols[8]),
                            bike: parseGoalValue(cols[10]),
                            climb: parseGoalValue(cols[11]),
                            run: parseGoalValue(cols[12])
                        }
                    });
                }
            }
        }
    }
    return events.sort((a,b) => a.date - b.date);
};

const calculateCapabilities = (allData) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 42); // 6 Weeks

    const caps = { swim: 0, bike: 0, run: 0, climb: 0 };

    allData.forEach(d => {
        if (d.date >= cutoff) {
            // Using CLEAN SCHEMA from app.js (d.sport, d.duration)
            if (d.sport === 'Swim') caps.swim = Math.max(caps.swim, d.duration);
            if (d.sport === 'Bike') {
                caps.bike = Math.max(caps.bike, d.duration);
                // Handle Elevation (Convert meters to feet if needed, assuming DB is metric)
                const elev = d.source?.elevationGain || d.elevationGain || 0;
                caps.climb = Math.max(caps.climb, elev * 3.28084); 
            }
            if (d.sport === 'Run') caps.run = Math.max(caps.run, d.duration);
        }
    });
    return caps;
};

// --- 3. COMPONENT RENDERERS (Exact Visual Match) ---

const renderLegend = () => `
    <div class="max-w-5xl mx-auto bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg mb-8">
        <div class="bg-slate-900/80 p-3 border-b border-slate-700 flex items-center gap-2">
            <i class="fa-solid fa-circle-info text-blue-400"></i>
            <span class="text-xs font-bold text-slate-300 uppercase tracking-wider">Readiness Guide</span>
        </div>
        <div class="grid grid-cols-3 text-center py-4 px-2">
            <div class="flex flex-col items-center">
                <div class="w-3 h-3 rounded-full bg-red-500 mb-2 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                <span class="text-[10px] font-black text-red-500 uppercase">Warning</span>
                <span class="text-[10px] text-slate-400">&lt; 60%</span>
            </div>
            <div class="flex flex-col items-center border-x border-slate-700">
                <div class="w-3 h-3 rounded-full bg-yellow-500 mb-2 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                <span class="text-[10px] font-black text-yellow-500 uppercase">Developing</span>
                <span class="text-[10px] text-slate-400">60% - 84%</span>
            </div>
            <div class="flex flex-col items-center">
                <div class="w-3 h-3 rounded-full bg-emerald-500 mb-2 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <span class="text-[10px] font-black text-emerald-500 uppercase">Race Ready</span>
                <span class="text-[10px] text-slate-400">85% - 100%</span>
            </div>
        </div>
        <div class="bg-slate-900/30 p-2 text-center border-t border-slate-700/50">
            <p class="text-[9px] text-slate-500 italic">Score = (Longest Session in Last 6 Weeks / Goal) for your <strong>weakest</strong> discipline.</p>
        </div>
    </div>`;

const buildBar = (type, current, target, isElev = false) => {
    if (!target || target === 0) return '';
    
    const pct = Math.min(100, Math.round((current / target) * 100));
    const config = SPORT_CONFIG[type];
    
    // Color Logic matches Guide
    let barColor = 'bg-red-500';
    if (pct >= 85) barColor = 'bg-emerald-500';
    else if (pct >= 60) barColor = 'bg-yellow-500';

    const displayCurrent = isElev ? formatElev(current) : formatTime(current);
    const displayTarget  = isElev ? formatElev(target) : formatTime(target);

    return `
        <div class="mb-5 last:mb-0">
            <div class="flex justify-between items-end mb-1">
                <div class="flex items-center gap-2">
                    <i class="fa-solid ${config.icon} ${config.color}"></i>
                    <span class="text-xs font-bold text-slate-400">${config.label}</span>
                </div>
                <div class="text-right">
                     <span class="text-xs font-bold text-white">${displayCurrent} / ${displayTarget}</span>
                </div>
            </div>
            <div class="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden relative">
                <div class="${barColor} h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.3)]" style="width: ${pct}%"></div>
            </div>
        </div>
    `;
};

const renderEventCard = (evt, caps) => {
    // 1. Calculate Score (Weakest Link)
    const pcts = [];
    if (evt.goals.swim > 0) pcts.push(caps.swim / evt.goals.swim);
    if (evt.goals.bike > 0) pcts.push(caps.bike / evt.goals.bike);
    if (evt.goals.run > 0) pcts.push(caps.run / evt.goals.run);
    if (evt.goals.climb > 0) pcts.push(caps.climb / evt.goals.climb);

    const minRatio = pcts.length ? Math.min(...pcts) : 0;
    const readinessScore = Math.min(100, Math.round(minRatio * 100));

    // 2. Determine Labels
    let scoreColor = "text-red-500";
    let scoreLabel = "Warning";
    let badgeClass = "bg-red-500/10 border-red-500/20";
    
    if (readinessScore >= 85) { 
        scoreColor = "text-emerald-500"; 
        scoreLabel = "Race Ready";
        badgeClass = "bg-emerald-500/10 border-emerald-500/20";
    } else if (readinessScore >= 60) { 
        scoreColor = "text-yellow-500"; 
        scoreLabel = "Developing";
        badgeClass = "bg-yellow-500/10 border-yellow-500/20";
    }

    // 3. Date Math
    const diff = Math.ceil((evt.date - new Date()) / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diff / 7);
    const days = diff % 7;

    return `
    <div class="bg-slate-800 border border-slate-700 rounded-xl p-0 mb-8 overflow-hidden shadow-lg relative max-w-5xl mx-auto">
        <div class="bg-slate-900/50 border-b border-slate-700 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div class="flex items-center gap-3">
                <div class="bg-slate-700 p-2 rounded-lg text-white shadow-inner">
                    <i class="fa-solid fa-flag-checkered"></i>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-white leading-none">${evt.name}</h3>
                    <div class="text-xs text-slate-500 font-mono mt-1 font-bold uppercase tracking-wider">${evt.priority} Event</div>
                </div>
            </div>
            <div class="flex items-center gap-4 text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
                <div class="flex items-center gap-2">
                    <i class="fa-regular fa-calendar"></i> ${evt.date.toLocaleDateString()}
                </div>
                <div class="w-px h-3 bg-slate-600"></div>
                <div class="flex items-center gap-2 font-bold text-white">
                    <i class="fa-solid fa-hourglass-half"></i> ${weeks}W ${days}D TO GO
                </div>
            </div>
        </div>

        <div class="p-6 flex flex-col md:flex-row gap-8 items-center">
            <div class="md:w-1/4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-700 pb-6 md:pb-0 md:pr-6 w-full">
                <div class="text-6xl font-black ${scoreColor} tracking-tighter drop-shadow-sm leading-none mb-2">
                    ${readinessScore}%
                </div>
                <div class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Readiness</div>
                <div class="text-[10px] font-bold uppercase ${scoreColor} border ${badgeClass} px-3 py-1 rounded-full">
                    ${scoreLabel}
                </div>
            </div>

            <div class="md:w-3/4 w-full pl-0 md:pl-4">
                ${buildBar('swim', caps.swim, evt.goals.swim)}
                ${buildBar('bike', caps.bike, evt.goals.bike)}
                ${buildBar('climb', caps.climb, evt.goals.climb, true)}
                ${buildBar('run', caps.run, evt.goals.run)}
            </div>
        </div>
    </div>`;
};

// --- 4. MAIN EXPORT ---

const buildCollapsible = (title, content) => `
    <div class="mb-6">
        <div class="flex items-center gap-2 cursor-pointer border-b border-slate-800 pb-2 mb-4 group" 
             onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('i').classList.toggle('-rotate-90');">
            <i class="fa-solid fa-caret-down text-slate-500 transition-transform duration-200"></i>
            <h3 class="text-sm font-bold text-slate-300 uppercase group-hover:text-white">${title}</h3>
        </div>
        <div class="block animate-fade-in">
            ${content}
        </div>
    </div>
`;

export const renderReadiness = (allData, planMd) => {
    const events = getEvents(planMd);
    const caps = calculateCapabilities(allData);

    if (events.length === 0) {
        return `<div class="p-12 text-center border border-slate-800 rounded-xl bg-slate-900/50">
            <i class="fa-solid fa-calendar-xmark text-4xl text-slate-700 mb-4"></i>
            <h3 class="text-slate-400 font-bold">No Upcoming Events</h3>
            <p class="text-slate-600 text-xs mt-2">Check your plan markdown file for formatting.</p>
        </div>`;
    }

    let html = `<div class="max-w-5xl mx-auto pb-24 font-sans">`;
    html += buildCollapsible("Legend & Logic", renderLegend());
    
    let eventHtml = '';
    events.forEach(evt => {
        eventHtml += renderEventCard(evt, caps);
    });
    
    html += buildCollapsible("Event Status", eventHtml);
    html += `</div>`;

    return html;
};

// Placeholder
export const renderReadinessChart = (data) => {};
