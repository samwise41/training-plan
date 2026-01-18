// js/views/readiness/index.js

// --- 1. HELPERS ---

const parseGoalValue = (str) => {
    if (!str || typeof str !== 'string') return 0;
    str = str.toLowerCase().trim();
    if (str === '-' || str === '') return 0;
    
    // Handle Elevation (e.g. "1,200 ft")
    if (str.includes('ft')) {
        return parseInt(str.replace(/,/g, '').replace('ft', '').trim());
    }

    // Handle Duration (e.g. "1h 30m" or "0:30")
    let total = 0;
    
    // Format "1h 30m"
    const hMatch = str.match(/(\d+)\s*h/);
    const mMatch = str.match(/(\d+)\s*m/);
    if (hMatch) total += parseInt(hMatch[1]) * 60;
    if (mMatch) total += parseInt(mMatch[1]);
    
    // Format "1:30" (H:MM)
    if (str.includes(':')) {
        const parts = str.split(':');
        total += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        return total;
    }

    // Fallback: simple number
    if (!hMatch && !mMatch && !isNaN(parseInt(str))) {
        total = parseInt(str);
    }
    return total;
};

const formatDuration = (mins) => {
    if (!mins) return "0:00";
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
};

const getScoreColor = (pct) => {
    if (pct >= 85) return 'text-emerald-400 border-emerald-500/30';
    if (pct >= 60) return 'text-yellow-400 border-yellow-500/30';
    return 'text-red-500 border-red-500/30'; // Warning
};

const getScoreLabel = (pct) => {
    if (pct >= 85) return "Race Ready";
    if (pct >= 60) return "Developing";
    return "Warning";
};

// --- 2. DATA PROCESSING ---

// Parse ALL events from the markdown
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
            // Expected Cols: | Date | Event | ... | Swim | ... | Bike | Elev | Run |
            // Based on standard template (approx indices):
            // 1: Date, 2: Name, 8: Swim, 10: Bike, 11: Elev, 12: Run
            if (cols.length >= 2) {
                const d = new Date(cols[1]);
                if (!isNaN(d) && d >= today) {
                    events.push({
                        name: cols[2],
                        type: cols[2].includes('**') ? cols[2].split('**')[1] : 'Event', // Extract "A-Race" if present
                        date: d,
                        swim: parseGoalValue(cols[8]),
                        bike: parseGoalValue(cols[10]),
                        climb: parseGoalValue(cols[11]), // Elevation column
                        run: parseGoalValue(cols[12])
                    });
                }
            }
        }
    }
    return events;
};

// Calculate Max Capabilities in Lookback Window
const calculateCapabilities = (allData) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 42); // 6 Week Lookback

    const caps = { swim: 0, bike: 0, run: 0, climb: 0 };

    allData.forEach(d => {
        if (d.date >= cutoff) {
            if (d.sport === 'Swim') caps.swim = Math.max(caps.swim, d.duration);
            if (d.sport === 'Bike') {
                caps.bike = Math.max(caps.bike, d.duration);
                caps.climb = Math.max(caps.climb, d.elevationGain || 0);
            }
            if (d.sport === 'Run') caps.run = Math.max(caps.run, d.duration);
        }
    });
    return caps;
};

// --- 3. RENDERERS ---

const buildProgressBar = (label, icon, current, goal, unit = 'dur') => {
    if (!goal || goal === 0) return '';
    
    const pct = Math.min(100, (current / goal) * 100);
    
    // Color Logic
    let barColor = 'bg-red-500';
    if (pct >= 85) barColor = 'bg-emerald-500';
    else if (pct >= 60) barColor = 'bg-yellow-500';

    const currentStr = unit === 'dur' ? formatDuration(current) : `${Math.round(current)} ft`;
    const goalStr = unit === 'dur' ? formatDuration(goal) : `${Math.round(goal)} ft`;

    return `
        <div class="mb-4 last:mb-0">
            <div class="flex justify-between items-end mb-1">
                <div class="flex items-center gap-2 text-slate-300 text-xs font-bold">
                    <i class="fa-solid ${icon} w-4 text-center"></i> ${label}
                </div>
                <div class="text-[10px] font-mono text-white">
                    <span class="text-slate-400">${currentStr}</span> / ${goalStr}
                </div>
            </div>
            <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div class="h-full ${barColor} shadow-[0_0_10px_rgba(0,0,0,0.5)]" style="width: ${pct}%"></div>
            </div>
        </div>
    `;
};

const renderEventCard = (evt, caps) => {
    // Calculate Overall Readiness (Weighted Average of available goals)
    let totalPct = 0;
    let count = 0;

    if (evt.swim > 0) { totalPct += Math.min((caps.swim / evt.swim), 1.1); count++; }
    if (evt.bike > 0) { totalPct += Math.min((caps.bike / evt.bike), 1.1); count++; }
    if (evt.run > 0) { totalPct += Math.min((caps.run / evt.run), 1.1); count++; }
    if (evt.climb > 0) { totalPct += Math.min((caps.climb / evt.climb), 1.1); count++; }

    const overallPct = count > 0 ? (totalPct / count) * 100 : 0;
    const scoreColorClass = getScoreColor(overallPct);
    const label = getScoreLabel(overallPct);

    // Date Math
    const diffTime = Math.abs(evt.date - new Date());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    return `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-0 overflow-hidden shadow-lg mb-6">
            <div class="bg-slate-800/50 p-4 border-b border-slate-700 flex justify-between items-center">
                <div>
                    <h3 class="text-white font-bold text-lg leading-none">${evt.name.replace(/\*\*/g, '')}</h3>
                    <span class="text-[10px] text-slate-500 uppercase tracking-widest">${evt.type || 'Event'}</span>
                </div>
                <div class="text-right">
                    <div class="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-300">
                        <i class="fa-regular fa-calendar mr-1"></i> ${evt.date.toLocaleDateString()} 
                        <span class="border-l border-slate-700 mx-2 pl-2 font-bold text-white">${weeks}W ${days}D TO GO</span>
                    </div>
                </div>
            </div>

            <div class="p-6 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-8 items-center">
                
                <div class="text-center">
                    <div class="text-6xl font-black ${scoreColorClass.split(' ')[0]} leading-none">${Math.round(overallPct)}%</div>
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">Readiness</div>
                    <div class="mt-2 inline-block px-3 py-1 rounded bg-slate-950 border ${scoreColorClass} text-[10px] font-bold uppercase">
                        ${label}
                    </div>
                </div>

                <div class="border-l border-slate-800 pl-8 md:pl-8 border-t md:border-t-0 pt-6 md:pt-0">
                    ${buildProgressBar('Swim', 'fa-person-swimming', caps.swim, evt.swim)}
                    ${buildProgressBar('Bike', 'fa-person-biking', caps.bike, evt.bike)}
                    ${buildProgressBar('Bike (Climb)', 'fa-mountain', caps.climb, evt.climb, 'ft')}
                    ${buildProgressBar('Run', 'fa-person-running', caps.run, evt.run)}
                </div>
            </div>
        </div>
    `;
};

// Collapsible Logic
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

// --- 4. MAIN EXPORT ---

export const renderReadiness = (allData, planMd) => {
    const events = getEvents(planMd);
    const caps = calculateCapabilities(allData);

    if (events.length === 0) {
        return `<div class="p-10 text-center text-slate-500">No upcoming events found in plan.</div>`;
    }

    const legendHtml = `
        <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-6 grid grid-cols-3 gap-4 text-center mb-2">
            <div>
                <div class="w-3 h-3 rounded-full bg-red-500 mx-auto mb-2 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                <div class="text-red-400 font-bold text-xs uppercase">Warning</div>
                <div class="text-[10px] text-slate-500">< 60%</div>
            </div>
            <div>
                <div class="w-3 h-3 rounded-full bg-yellow-500 mx-auto mb-2 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                <div class="text-yellow-400 font-bold text-xs uppercase">Developing</div>
                <div class="text-[10px] text-slate-500">60% - 84%</div>
            </div>
            <div>
                <div class="w-3 h-3 rounded-full bg-emerald-500 mx-auto mb-2 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                <div class="text-emerald-400 font-bold text-xs uppercase">Race Ready</div>
                <div class="text-[10px] text-slate-500">85% - 100%</div>
            </div>
            <div class="col-span-3 text-center border-t border-slate-800 mt-3 pt-2">
                <p class="text-[10px] text-slate-500 italic">
                    Score = (Longest Session in Last 6 Weeks / Race Goal) for each discipline.
                </p>
            </div>
        </div>
    `;

    let html = `<div class="max-w-5xl mx-auto pb-24">`;
    html += buildCollapsible("Legend & Logic", legendHtml);
    html += `<div class="space-y-8">`;
    events.forEach(evt => {
        html += renderEventCard(evt, caps);
    });
    html += `</div></div>`;

    return html;
};

export const renderReadinessChart = (data) => {};
