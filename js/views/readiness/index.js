// js/views/readiness/index.js

// --- 1. HELPERS ---

// Parse duration strings (e.g. "1h 30m" -> 90) from the Markdown Plan
const parseGoalDuration = (str) => {
    if (!str || typeof str !== 'string') return 0;
    str = str.toLowerCase().trim();
    if (str === '-' || str === '') return 0;
    
    let total = 0;
    // Handle "1h 30m" or "90m" formats
    const hMatch = str.match(/(\d+)\s*h/);
    const mMatch = str.match(/(\d+)\s*m/);
    
    if (hMatch) total += parseInt(hMatch[1]) * 60;
    if (mMatch) total += parseInt(mMatch[1]);
    
    // Fallback: if just a number, assume minutes
    if (!hMatch && !mMatch && !isNaN(parseInt(str))) {
        total = parseInt(str);
    }
    return total;
};

// Calculate Confidence Score based on completed volume vs goal
const getScoreColor = (pct) => {
    if (pct >= 100) return 'text-emerald-400';
    if (pct >= 85) return 'text-blue-400';
    if (pct >= 70) return 'text-yellow-400';
    return 'text-red-400';
};

const getProgressBar = (pct, colorClass) => {
    const safePct = Math.min(100, Math.max(0, pct));
    // Extract Tailwind color class for bg (e.g. 'text-blue-400' -> 'bg-blue-500')
    const bgClass = colorClass.replace('text-', 'bg-').replace('-400', '-500');
    
    return `
        <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
            <div class="h-full ${bgClass} transition-all duration-1000" style="width: ${safePct}%"></div>
        </div>
    `;
};

// --- 2. DATA PROCESSING ---

// Find the NEXT race in the markdown plan
const getNextEvent = (planMd) => {
    if (!planMd) return null;
    const lines = planMd.split('\n');
    let inTable = false;
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let line of lines) {
        if (line.includes('| **Date** |')) { inTable = true; continue; }
        if (inTable && line.startsWith('| :---')) continue;
        if (inTable && line.startsWith('|')) {
            const cols = line.split('|').map(c => c.trim());
            // Col 1: Date, Col 2: Event Name, Col 7: Swim Goal, Col 9: Bike Goal, Col 11: Run Goal
            // (Adjust indices based on your specific MD table structure if needed)
            if (cols.length >= 2) {
                const eventDate = new Date(cols[1]);
                if (!isNaN(eventDate) && eventDate >= today) {
                    return {
                        name: cols[2],
                        date: eventDate,
                        swimGoal: parseGoalDuration(cols[8]),  // Adjust index if column moved
                        bikeGoal: parseGoalDuration(cols[10]), // Adjust index if column moved
                        runGoal: parseGoalDuration(cols[12])   // Adjust index if column moved
                    };
                }
            }
        }
    }
    return null;
};

// Analyze Training Data against Goals
const calculateReadiness = (allData, event) => {
    if (!event) return null;

    // Lookback window: Last 6 weeks for Longest Session
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 42); 

    // Find Longest Sessions in the Clean Data (d.sport, d.duration)
    let maxSwim = 0, maxBike = 0, maxRun = 0;

    allData.forEach(d => {
        if (d.date >= cutoff) {
            if (d.sport === 'Swim') maxSwim = Math.max(maxSwim, d.duration);
            if (d.sport === 'Bike') maxBike = Math.max(maxBike, d.duration);
            if (d.sport === 'Run') maxRun = Math.max(maxRun, d.duration);
        }
    });

    return {
        swim: { current: maxSwim, goal: event.swimGoal, pct: event.swimGoal ? (maxSwim / event.swimGoal) * 100 : 0 },
        bike: { current: maxBike, goal: event.bikeGoal, pct: event.bikeGoal ? (maxBike / event.bikeGoal) * 100 : 0 },
        run: { current: maxRun, goal: event.runGoal, pct: event.runGoal ? (maxRun / event.runGoal) * 100 : 0 }
    };
};

// --- 3. RENDERERS ---

const renderSportCard = (sport, data, icon) => {
    if (!data.goal) return ''; // Skip if no goal set for this sport

    const color = getScoreColor(data.pct);
    const label = data.pct >= 100 ? "READY" : (data.pct >= 75 ? "BUILDING" : "BEHIND");
    
    return `
        <div class="bg-slate-800/50 border border-slate-700 p-5 rounded-xl flex flex-col justify-between">
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                        <i class="fa-solid ${icon} text-slate-400"></i>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-white uppercase tracking-wider">${sport}</h4>
                        <span class="text-[10px] text-slate-500">Longest Session (Last 6w)</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xl font-mono font-bold ${color}">${Math.round(data.pct)}%</div>
                    <div class="text-[9px] font-bold bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-700 inline-block">${label}</div>
                </div>
            </div>
            
            <div class="space-y-1">
                <div class="flex justify-between text-xs font-mono text-slate-400">
                    <span>Current: <strong class="text-white">${Math.round(data.current)}m</strong></span>
                    <span>Goal: <strong class="text-white">${Math.round(data.goal)}m</strong></span>
                </div>
                ${getProgressBar(data.pct, color)}
            </div>
        </div>
    `;
};

// Exported Render Function
export const renderReadiness = (allData, planMd) => {
    const event = getNextEvent(planMd);
    
    if (!event) {
        return `
            <div class="max-w-4xl mx-auto mt-10 p-8 bg-slate-800 rounded-xl border border-slate-700 text-center">
                <i class="fa-solid fa-calendar-xmark text-4xl text-slate-600 mb-4"></i>
                <h2 class="text-xl font-bold text-white">No Upcoming Race Found</h2>
                <p class="text-slate-400 text-sm mt-2">Add a race with specific time goals to your training plan to see readiness stats.</p>
            </div>
        `;
    }

    const stats = calculateReadiness(allData, event);
    const daysOut = Math.ceil((event.date - new Date()) / (1000 * 60 * 60 * 24));

    return `
        <div class="max-w-5xl mx-auto space-y-8 pb-20 animate-fade-in">
            
            <div class="bg-gradient-to-r from-blue-900/40 to-slate-900/40 border border-blue-500/30 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 backdrop-blur-sm">
                <div>
                    <div class="flex items-center gap-3 mb-1">
                        <span class="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Target Event</span>
                        <span class="text-blue-400 text-xs font-mono"><i class="fa-regular fa-clock"></i> ${daysOut} Days Out</span>
                    </div>
                    <h1 class="text-3xl font-black text-white italic tracking-tighter uppercase">${event.name}</h1>
                    <p class="text-slate-400 text-sm mt-1">
                        <i class="fa-regular fa-calendar text-slate-500 mr-1"></i> ${event.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                
                <div class="text-center bg-slate-950/50 p-4 rounded-xl border border-blue-500/20 min-w-[150px]">
                    <div class="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Overall Confidence</div>
                    <div class="text-4xl font-black text-white">
                        ${Math.round((stats.swim.pct + stats.bike.pct + stats.run.pct) / 3)}%
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                ${renderSportCard("Swim Readiness", stats.swim, "fa-person-swimming")}
                ${renderSportCard("Bike Readiness", stats.bike, "fa-person-biking")}
                ${renderSportCard("Run Readiness", stats.run, "fa-person-running")}
            </div>

            <div class="bg-slate-900/50 border border-slate-800 p-4 rounded-lg text-center">
                <p class="text-[10px] text-slate-500 font-mono">
                    * Readiness is calculated by comparing your longest single session in the last 6 weeks against your race day duration goals.
                </p>
            </div>
        </div>
    `;
};

// Optional: Placeholder if you want a chart later
export const renderReadinessChart = (data) => {};
