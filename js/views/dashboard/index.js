// js/views/dashboard/index.js (snippet)
// ... imports ...

export function renderDashboard(planMd, cleanLogData) {
    const scheduleSection = Parser.getSection(planMd, "Weekly Schedule");
    const plannedWorkouts = scheduleSection ? Parser._parseTableBlock(scheduleSection) : [];

    // PASS planMd HERE vvv
    const widgetHtml = renderProgressWidget(plannedWorkouts, cleanLogData, planMd);
    
    const workoutsHtml = renderPlannedWorkouts(planMd, cleanLogData);
    const heatmapsHtml = renderHeatmaps(cleanLogData, planMd);
    
    // ... return HTML ...
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
