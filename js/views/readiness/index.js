// js/views/readiness/index.js

// --- 1. PARSING & FORMATTING HELPERS ---

const parseGoalValue = (str) => {
    if (!str || typeof str !== 'string') return 0;
    const clean = str.toLowerCase().replace(/\*/g, '').trim();
    if (clean === '-' || clean === '') return 0;
    
    // 1. Handle Elevation (e.g. "4,905 ft" or "1200")
    if (clean.includes('ft') || (clean.match(/^\d{1,3}(,\d{3})*$/) && !clean.includes(':'))) {
        // Remove commas and 'ft'
        const numStr = clean.replace(/,/g, '').replace('ft', '').trim();
        return parseInt(numStr) || 0;
    }

    // 2. Handle Duration (e.g. "1h 30m" or "2:30")
    let totalMinutes = 0;
    
    // Format A: "1h 30m"
    const hMatch = clean.match(/(\d+)\s*h/);
    const mMatch = clean.match(/(\d+)\s*m/);
    if (hMatch) totalMinutes += parseInt(hMatch[1]) * 60;
    if (mMatch) totalMinutes += parseInt(mMatch[1]);
    
    // Format B: "2:30" (H:MM)
    if (clean.includes(':')) {
        const parts = clean.split(':');
        totalMinutes += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        return totalMinutes;
    }

    // Format C: Just a number (assume minutes if small, else elevation?) 
    // Context usually handles this, but here we assume minutes if not elevation
    if (!hMatch && !mMatch && !isNaN(parseInt(clean))) {
        totalMinutes = parseInt(clean);
    }
    
    return totalMinutes;
};

const formatDuration = (mins) => {
    if (!mins) return "0:00";
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
};

const formatElevation = (ft) => {
    return new Intl.NumberFormat('en-US').format(Math.round(ft)) + " ft";
};

// --- 2. DATA PROCESSING ---

// Parse ALL events from the markdown table
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
            // Columns: 1=Date, 2=Name, 8=Swim, 10=Bike, 11=Elev, 12=Run
            if (cols.length >= 12) {
                const d = new Date(cols[1]);
                if (!isNaN(d) && d >= today) {
                    events.push({
                        name: cols[2].replace(/\*\*/g, ''), // Clean name
                        type: cols[2].includes('**A-Race**') ? 'A-Race' : (cols[2].includes('**B-Race**') ? 'B-Race' : 'Event'),
                        date: d,
                        goals: {
                            swim: parseGoalValue(cols[8]),
                            bike: parseGoalValue(cols[10]),
                            climb: parseGoalValue(cols[11]), // Elevation column
                            run: parseGoalValue(cols[12])
                        }
                    });
                }
            }
        }
    }
    // SORT: Earliest to Latest
    return events.sort((a,b) => a.date - b.date);
};

// Calculate Max Capabilities in Lookback Window (Last 6 Weeks)
const calculateCapabilities = (allData) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 42); 

    const caps = { swim: 0, bike: 0, run: 0, climb: 0 };

    allData.forEach(d => {
        if (d.date >= cutoff) {
            // Using Clean Schema from app.js (d.sport, d.duration, d.elevationGain)
            if (d.sport === 'Swim') caps.swim = Math.max(caps.swim, d.duration);
            if (d.sport === 'Bike') {
                caps.bike = Math.max(caps.bike, d.duration);
                // Handle raw Elevation data
                const elev = d.source?.elevationGain || d.elevationGain || 0;
                caps.climb = Math.max(caps.climb, elev * 3.28084); // Convert Meters to Feet
            }
            if (d.sport === 'Run') caps.run = Math.max(caps.run, d.duration);
        }
    });
    return caps;
};

// --- 3. UI RENDERERS ---

const buildProgressBar = (label, icon, current, goal, type = 'time') => {
    if (!goal || goal === 0) return '';
    
    const pct = Math.min(100, (current / goal) * 100);
    let barColor = 'bg-red-500';
    if (pct >= 85) barColor = 'bg-emerald-500';
    else if (pct >= 60) barColor = 'bg-yellow-500';

    const currentStr = type === 'elev' ? formatElevation(current) : formatDuration(current);
    const goalStr = type === 'elev' ? formatElevation(goal) : formatDuration(goal);

    return `
        <div class="mb-4 last:mb-0 group">
            <div class="flex justify-between items-end mb-1">
                <div class="flex items-center gap-2 text-slate-300 text-xs font-bold">
                    <i class="fa-solid ${icon} w-4 text-center text-slate-500 group-hover:text-white transition-colors"></i> ${label}
                </div>
                <div class="text-[10px] font-mono text-white">
                    <span class="text-slate-400">${currentStr}</span> / ${goalStr}
                </div>
            </div>
            <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                <div class="h-full ${barColor} shadow-[0_0_10px_rgba(0,0,0,0.3)] transition-all duration-1000" style="width: ${pct}%"></div>
            </div>
        </div>
    `;
};

const renderEventCard = (evt, caps) => {
    // Logic: Score is based on the WEAKEST link
    const scores = [];
    if (evt.goals.swim > 0) scores.push(caps.swim / evt.goals.swim);
    if (evt.goals.bike > 0) scores.push(caps.bike / evt.goals.bike);
    if (evt.goals.run > 0) scores.push(caps.run / evt.goals.run);
    if (evt.goals.climb > 0) scores.push(caps.climb / evt.goals.climb);

    // If no goals, 0%. If goals, find min. Cap at 100% for display logic.
    const rawScore = scores.length ? Math.min(...scores) : 0;
    const scorePct = Math.min(100, Math.round(rawScore * 100));

    // Status Label
    let status = { label: 'Warning', color: 'text-red-500', border: 'border-red-500/20', bg: 'bg-red-500/10' };
    if (scorePct >= 85) status = { label: 'Race Ready', color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10' };
    else if (scorePct >= 60) status = { label: 'Developing', color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/10' };

    // Countdown
    const diff = Math.ceil((evt.date - new Date()) / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diff / 7);
    const days = diff % 7;

    return `
        <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mb-6 hover:border-slate-700 transition-colors">
            <div class="bg-slate-800/40 p-4 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 shadow-inner">
                        <i class="fa-solid fa-flag-checkered text-slate-400"></i>
                    </div>
                    <div>
                        <h3 class="text-white font-bold text-lg leading-tight">${evt.name}</h3>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[10px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 uppercase tracking-wider">
                                ${evt.type} Event
                            </span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800">
                    <div class="text-xs text-slate-400 border-r border-slate-700 pr-3 mr-1">
                        <i class="fa-regular fa-calendar mr-1"></i> ${evt.date.toLocaleDateString()}
                    </div>
                    <div class="text-xs font-mono font-bold text-white">
                        <i class="fa-solid fa-hourglass-half mr-1 text-slate-500"></i> ${weeks}W ${days}D
                    </div>
                </div>
            </div>

            <div class="p-6 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-8 items-center">
                
                <div class="text-center">
                    <div class="text-7xl font-black ${status.color} leading-none tracking-tighter" style="text-shadow: 0 0 20px rgba(0,0,0,0.5)">
                        ${scorePct}%
                    </div>
                    <div class="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 mb-3">Readiness</div>
                    <span class="px-3 py-1 rounded text-[10px] font-bold uppercase ${status.color} ${status.bg} border ${status.border}">
                        ${status.label}
                    </span>
                </div>

                <div class="border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-8 space-y-1">
                    ${buildProgressBar('Swim', 'fa-person-swimming', caps.swim, evt.goals.swim, 'time')}
                    ${buildProgressBar('Bike', 'fa-person-biking', caps.bike, evt.goals.bike, 'time')}
                    ${buildProgressBar('Bike (Climb)', 'fa-mountain', caps.climb, evt.goals.climb, 'elev')}
                    ${buildProgressBar('Run', 'fa-person-running', caps.run, evt.goals.run, 'time')}
                </div>
            </div>
        </div>
    `;
};

const buildLegend = () => `
    <div class="mb-8">
        <div class="flex items-center gap-2 mb-2">
            <i class="fa-solid fa-circle-info text-blue-500"></i>
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Readiness Guide</h3>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-3 gap-px bg-slate-800/50 overflow-hidden">
            <div class="bg-slate-900 p-3 text-center">
                <div class="text-red-500 font-bold text-xs uppercase mb-1">Warning</div>
                <div class="text-[10px] text-slate-500">&lt; 60%</div>
            </div>
            <div class="bg-slate-900 p-3 text-center">
                <div class="text-yellow-500 font-bold text-xs uppercase mb-1">Developing</div>
                <div class="text-[10px] text-slate-500">60% - 84%</div>
            </div>
            <div class="bg-slate-900 p-3 text-center">
                <div class="text-emerald-500 font-bold text-xs uppercase mb-1">Race Ready</div>
                <div class="text-[10px] text-slate-500">85% - 100%</div>
            </div>
        </div>
        <p class="text-[9px] text-slate-500 text-center mt-2 italic">
            Score = (Longest Session in Last 6 Weeks / Goal) for your <strong class="text-slate-400">weakest</strong> discipline.
        </p>
    </div>
`;

// --- 4. EXPORT ---

export const renderReadiness = (allData, planMd) => {
    const events = getEvents(planMd);
    const caps = calculateCapabilities(allData);

    if (events.length === 0) {
        return `<div class="p-12 text-center border border-slate-800 rounded-xl bg-slate-900/50">
            <i class="fa-solid fa-calendar-xmark text-4xl text-slate-700 mb-4"></i>
            <h3 class="text-slate-400 font-bold">No Events Found</h3>
            <p class="text-slate-600 text-xs mt-2">Add events to your plan markdown file to see readiness stats.</p>
        </div>`;
    }

    let html = `<div class="max-w-5xl mx-auto pb-24 animate-fade-in font-sans">`;
    
    // Legend Section (Fixed Open)
    html += buildLegend();

    // Events Section
    html += `<div class="flex items-center gap-2 mb-4 mt-8 border-b border-slate-800 pb-2">
                <i class="fa-solid fa-caret-down text-slate-500"></i>
                <h3 class="text-sm font-bold text-white uppercase tracking-widest">Event Status</h3>
             </div>`;
             
    html += `<div class="space-y-6">`;
    events.forEach(evt => {
        html += renderEventCard(evt, caps);
    });
    html += `</div></div>`;

    return html;
};

// Placeholder
export const renderReadinessChart = (data) => {};
