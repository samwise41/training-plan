import { getMonday } from './utils.js';

// --- MODULE STATE ---
let _plannedWorkouts = [];
let _actualLogs = [];
let _currentOffset = 0;

// --- GLOBAL HANDLER ---
window.changeDashboardWeek = (delta) => {
    _currentOffset += delta;
    const content = generateWidgetContent(_currentOffset);
    const container = document.getElementById('progress-widget-inner');
    if (container) {
        container.innerHTML = content;
    }
};

export function renderProgressWidget(plannedWorkouts, actualLogs) {
    // Cache data for navigation
    _plannedWorkouts = plannedWorkouts || [];
    _actualLogs = actualLogs || [];
    _currentOffset = 0; // Reset to current week on load

    return `
        <div class="bg-slate-800/50 border border-slate-700 p-5 rounded-xl shadow-lg h-full flex flex-col justify-between">
            <div id="progress-widget-inner" class="h-full flex flex-col justify-between">
                ${generateWidgetContent(0)}
            </div>
        </div>
    `;
}

function generateWidgetContent(offset) {
    // 1. Determine Date Range
    const today = new Date();
    const startOfWeek = getMonday(new Date(today.setDate(today.getDate() + (offset * 7))));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Date Label
    const dateOpts = { month: 'short', day: 'numeric' };
    const dateLabel = `${startOfWeek.toLocaleDateString('en-US', dateOpts)} - ${endOfWeek.toLocaleDateString('en-US', dateOpts)}`;
    const weekLabel = offset === 0 ? "THIS WEEK" : (offset === -1 ? "LAST WEEK" : (offset === 1 ? "NEXT WEEK" : `${Math.abs(offset)} WEEKS ${offset > 0 ? 'AHEAD' : 'AGO'}`));

    // 2. Tally ACTUALS
    const weeklyTotals = {
        Run: { time: 0 },
        Bike: { time: 0 },
        Swim: { time: 0 },
        Total: { time: 0 }
    };

    _actualLogs.forEach(d => {
        const dDate = new Date(d.date);
        if (dDate >= startOfWeek && dDate <= endOfWeek) {
            let type = 'Other';
            const tLower = String(d.type || '').toLowerCase();

            if (tLower.includes('swim')) type = 'Swim';
            else if (tLower.includes('bike') || tLower.includes('cycl')) type = 'Bike';
            else if (tLower.includes('run')) type = 'Run';

            // Parse Duration
            let dur = 0;
            if (typeof d.actualDuration === 'number') dur = d.actualDuration;
            else if (typeof d.duration === 'number') dur = d.duration;
            else if (typeof d.actualDuration === 'string') dur = parseTime(d.actualDuration);
            else if (typeof d.duration === 'string') dur = parseTime(d.duration);

            if (weeklyTotals[type]) weeklyTotals[type].time += dur;
            weeklyTotals.Total.time += dur;
        }
    });

    // 3. Tally PLANNED
    const plannedTotals = { Run: 0, Bike: 0, Swim: 0, Total: 0 };

    _plannedWorkouts.forEach(w => {
        const wDate = w.date; // Parser returns Date object
        if (wDate >= startOfWeek && wDate <= endOfWeek) {
            const typeLower = (w.workout || '').toLowerCase();
            let dur = parseTime(w.duration || w.plannedDuration);

            if (typeLower.includes('run')) plannedTotals.Run += dur;
            else if (typeLower.includes('bike') || typeLower.includes('ride')) plannedTotals.Bike += dur;
            else if (typeLower.includes('swim')) plannedTotals.Swim += dur;
            
            plannedTotals.Total += dur;
        }
    });

    // 4. Build UI
    const buildBar = (label, sportKey, icon, colorClass) => {
        const actual = weeklyTotals[sportKey].time;
        const planned = plannedTotals[sportKey];
        const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
        
        // Dynamic Color based on compliance
        let barColor = 'bg-slate-700';
        if (planned > 0) {
            if (pct >= 100) barColor = 'bg-emerald-500';
            else if (pct >= 80) barColor = 'bg-blue-500';
            else if (pct >= 50) barColor = 'bg-yellow-500';
            else barColor = 'bg-red-500';
        }

        return `
            <div class="mb-3">
                <div class="flex justify-between items-end mb-1">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded flex items-center justify-center ${colorClass} bg-opacity-20 text-xs">
                            <i class="${icon}" style="color: inherit;"></i>
                        </div>
                        <span class="text-xs font-bold text-slate-300 uppercase">${label}</span>
                    </div>
                    <div class="text-xs font-mono">
                        <span class="text-white font-bold">${formatMins(actual)}</span>
                        <span class="text-slate-500">/ ${formatMins(planned)}</span>
                    </div>
                </div>
                <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full ${barColor} transition-all duration-500" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    };

    const totalPct = plannedTotals.Total > 0 ? Math.round((weeklyTotals.Total.time / plannedTotals.Total) * 100) : 0;

    return `
        <div class="flex justify-between items-start mb-4">
            <div>
                <div class="flex items-center gap-2">
                    <button onclick="window.changeDashboardWeek(-1)" class="text-slate-400 hover:text-white transition-colors">
                        <i class="fa-solid fa-chevron-left text-xs"></i>
                    </button>
                    <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest select-none w-24 text-center">${weekLabel}</h3>
                    <button onclick="window.changeDashboardWeek(1)" class="text-slate-400 hover:text-white transition-colors">
                        <i class="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                </div>
                <p class="text-xs text-slate-500 mt-1 text-center">${dateLabel}</p>
            </div>
            <div class="text-right">
                <span class="text-3xl font-black text-white">${totalPct}%</span>
                <p class="text-[10px] text-slate-400 uppercase font-bold">Compliance</p>
            </div>
        </div>

        <div class="space-y-1">
            ${buildBar('Swim', 'Swim', 'fa-solid fa-water', 'bg-icon-swim text-sky-400')}
            ${buildBar('Bike', 'Bike', 'fa-solid fa-person-biking', 'bg-icon-bike text-violet-400')}
            ${buildBar('Run', 'Run', 'fa-solid fa-person-running', 'bg-icon-run text-pink-400')}
        </div>
    `;
}

// Helpers
function parseTime(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    str = str.toString().trim();
    if (str.includes('h')) {
        const parts = str.split('h');
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        return (h * 60) + m;
    }
    if (str.includes(':')) {
        const parts = str.split(':');
        return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
    }
    return parseInt(str) || 0;
}

function formatMins(m) {
    if (m < 60) return `${Math.round(m)}m`;
    const h = Math.floor(m / 60);
    const rest = Math.round(m % 60);
    return `${h}h ${rest}m`;
}
