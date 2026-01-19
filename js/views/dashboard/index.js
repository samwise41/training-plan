// js/views/dashboard/index.js
import { renderPlannedWorkouts } from './plannedWorkouts.js';
import { renderProgressWidget } from './progressWidget.js';
import { renderHeatmaps } from './heatmaps.js';

// Re-export sync logic if needed (or move to app.js)
window.triggerGitHubSync = async () => { /* ... existing sync logic ... */ };

export function renderDashboard(planMd, cleanLogData) {
    // Return the skeleton structure immediately
    const html = `
        <div class="flex justify-end mb-4">
            <button onclick="window.triggerGitHubSync()" class="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 font-bold py-1.5 px-3 rounded hover:text-white">
                <i class="fa-solid fa-rotate mr-1"></i> Sync
            </button>
        </div>
        <div id="dash-widget"></div>
        <div id="dash-workouts"></div>
        <div id="dash-heatmaps"></div>
        <div id="dashboard-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed"></div>
    `;

    // Fetch the JSON asynchronously and populate the divs
    fetch('data/planned.json')
        .then(res => res.json())
        .then(plannedJson => {
            // 1. Render Progress Widget (Needs JSON + Log + MD for Event)
            const widgetEl = document.getElementById('dash-widget');
            if (widgetEl) widgetEl.innerHTML = renderProgressWidget(plannedJson, cleanLogData, planMd);

            // 2. Render Daily Cards (Needs JSON + Log)
            const workoutsEl = document.getElementById('dash-workouts');
            if (workoutsEl) workoutsEl.innerHTML = renderPlannedWorkouts(plannedJson, cleanLogData);

            // 3. Render Heatmaps (Needs Log + JSON)
            const heatmapsEl = document.getElementById('dash-heatmaps');
            if (heatmapsEl) heatmapsEl.innerHTML = renderHeatmaps(cleanLogData, plannedJson);
        })
        .catch(err => {
            console.error("Failed to load planned.json:", err);
            const errHtml = `<div class="p-4 text-red-400 border border-red-500/50 rounded bg-red-900/10">Error loading planned workouts. Please run the build script.</div>`;
            if(document.getElementById('dash-workouts')) document.getElementById('dash-workouts').innerHTML = errHtml;
        });

    return html;
}
