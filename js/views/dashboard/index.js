import { renderPlannedWorkouts } from './plannedWorkouts.js';
import { renderProgressWidget, renderNextEvent } from './progressWidget.js';
import { renderHeatmaps } from './heatmaps.js';

// --- Sync Logic ---
window.triggerGitHubSync = async () => {
    const btn = document.querySelector('button[onclick="window.triggerGitHubSync()"]');
    if(btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Syncing...';
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    window.dispatchEvent(new CustomEvent('trigger-sync'));
};

// --- Helper: Parse Phase/Block ---
function getPhaseInfo(planMd) {
    if (!planMd) return { phase: "Unknown Phase", block: "Unknown Block" };
    
    const lines = planMd.split('\n');
    let phase = "";
    let block = "";

    for (let line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^#+\s*Phase/i)) phase = trimmed.replace(/^#+\s*/, '');
        if (trimmed.match(/Block\s*\d+/i)) {
            const match = trimmed.match(/(Block\s*\d+.*)/i);
            if(match) block = match[1];
        }
        if (phase && block) break;
    }
    
    return {
        phase: phase || "No Phase Found",
        block: block || "Check Plan Headers"
    };
}

// --- Main Render Function ---
export function renderDashboard(planMd, cleanLogData) {
    // 1. Prepare Static Data
    const { phase, block } = getPhaseInfo(planMd);
    const eventCardHtml = renderNextEvent(planMd); 

    // 2. Build Layout (SINGLE DEFINITION)
    const html = `
        <div class="space-y-6">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg flex flex-col justify-center min-h-[140px]">
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Current Phase</div>
                    <h1 class="text-xl sm:text-2xl font-black text-blue-500 mb-1 leading-tight">${phase}</h1>
                    <p class="text-sm text-slate-300 font-mono">${block}</p>
                </div>

                ${eventCardHtml}
            </div>

            <div class="flex justify-end">
                <button onclick="window.triggerGitHubSync()" class="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 font-bold py-2 px-4 rounded hover:text-white hover:border-slate-600 transition-all">
                    <i class="fa-solid fa-rotate mr-1"></i> Sync Data
                </button>
            </div>

            <div id="dash-widget">
                <div class="animate-pulse bg-slate-800/50 h-32 rounded-xl"></div>
            </div>

            <div id="dash-workouts"></div>

            <div id="dash-heatmaps"></div>
        </div>

        <div id="dashboard-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed"></div>
    `;

    // 3. Async Data Loading
    fetch('data/planned.json')
        .then(res => res.json())
        .then(plannedJson => {
            const widgetEl = document.getElementById('dash-widget');
            if (widgetEl) widgetEl.innerHTML = renderProgressWidget(plannedJson, cleanLogData);

            const workoutsEl = document.getElementById('dash-workouts');
            if (workoutsEl) workoutsEl.innerHTML = renderPlannedWorkouts(plannedJson, cleanLogData);

            const heatmapsEl = document.getElementById('dash-heatmaps');
            if (heatmapsEl) heatmapsEl.innerHTML = renderHeatmaps(cleanLogData, plannedJson);
        })
        .catch(err => {
            console.error("Error loading planned.json:", err);
            const wEl = document.getElementById('dash-widget');
            if(wEl) wEl.innerHTML = '<div class="p-4 text-red-500 text-xs text-center border border-red-900/50 rounded bg-red-900/10">Failed to load plan data. Run the python script.</div>';
        });

    return html;
}
