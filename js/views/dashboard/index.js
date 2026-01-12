// js/views/dashboard/index.js
import { Parser } from '../../parser.js';
import { renderPlannedWorkouts } from './plannedWorkouts.js';
import { renderProgressWidget } from './progressWidget.js';
import { renderHeatmaps } from './heatmaps.js';

export function renderDashboard(planMd, mergedLogData) {
    // 1. Common Data Prep
    const scheduleSection = Parser.getSection(planMd, "Weekly Schedule");
    if (!scheduleSection) return '<p class="text-slate-500 italic">No Weekly Schedule found.</p>';

    // Parse workouts for the Progress Widget
    // (Note: PlannedWorkouts component parses its own data from planMd internally)
    const workouts = Parser._parseTableBlock(scheduleSection);
    workouts.sort((a, b) => a.date - b.date);

    const fullLogData = mergedLogData || [];

    // 2. Render Sub-Components
    const progressHtml = renderProgressWidget(workouts, fullLogData);
    const plannedWorkoutsHtml = renderPlannedWorkouts(planMd);
    const heatmapsHtml = renderHeatmaps(fullLogData, planMd);

    // 3. Assemble Final View
    return `
        ${progressHtml}
        ${plannedWorkoutsHtml}
        ${heatmapsHtml}
        <div id="dashboard-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed"></div>
    `;
}
