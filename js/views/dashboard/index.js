// js/views/dashboard/index.js
import { Parser } from '../../parser.js';
import { renderPlannedWorkouts } from './plannedWorkouts.js';
import { renderProgressWidget } from './progressWidget.js';
import { renderHeatmaps } from './heatmaps.js';

window.triggerGitHubSync = async () => { /* ... Keep existing Sync Logic ... */ };

// Tooltip handler is now in utils.js, but keeping here if needed or ensure app.js loads utils globally.
// Better to rely on window.showDashboardTooltip defined in utils.js

export function renderDashboard(planMd, cleanLogData) {
    // cleanLogData comes from App.allData (The standard schema)
    
    const progressHtml = renderProgressWidget(null, cleanLogData); // We parse planned inside widget now or pass planMd
    // Actually, progressWidget needs Plan + Actuals.
    // Let's parse Plan here:
    const scheduleSection = Parser.getSection(planMd, "Weekly Schedule");
    const plannedWorkouts = scheduleSection ? Parser._parseTableBlock(scheduleSection) : [];

    const widgetHtml = renderProgressWidget(plannedWorkouts, cleanLogData);
    const workoutsHtml = renderPlannedWorkouts(planMd, cleanLogData);
    const heatmapsHtml = renderHeatmaps(cleanLogData, planMd);

    return `
        <div class="flex justify-end mb-4">
            <button onclick="window.triggerGitHubSync()" class="text-[10px] uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 font-bold py-1.5 px-3 rounded hover:text-white">
                <i class="fa-solid fa-rotate mr-1"></i> Sync
            </button>
        </div>
        ${widgetHtml}
        ${workoutsHtml}
        ${heatmapsHtml}
        <div id="dashboard-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed"></div>
    `;
}
