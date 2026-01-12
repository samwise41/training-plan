// js/views/dashboard/index.js
import { Parser } from '../../parser.js';
import { renderPlannedWorkouts } from './plannedWorkouts.js';
import { renderProgressWidget } from './progressWidget.js';
import { renderHeatmaps } from './heatmaps.js';

// --- Global Tooltip Handler ---
// Required because the HTML strings in heatmaps.js use onclick="window.showDashboardTooltip(...)"
window.showDashboardTooltip = (evt, date, plan, act, label, color, sportType) => {
    let tooltip = document.getElementById('dashboard-tooltip-popup');
    
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'dashboard-tooltip-popup';
        tooltip.className = 'z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs pointer-events-none opacity-0 transition-opacity fixed min-w-[140px]';
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
        <div class="text-center">
            <div class="text-white font-bold text-sm mb-0.5 whitespace-nowrap">
                Plan: ${Math.round(plan)}m | Act: ${Math.round(act)}m
            </div>
            
            <div class="text-[10px] text-slate-400 font-normal mb-1">
                ${date}
            </div>

            <div class="text-[10px] text-slate-200 font-mono font-bold border-b border-slate-700 pb-1 mb-1">
                ${sportType}
            </div>

            <div class="text-[11px] font-bold mt-1 uppercase tracking-wide" style="color: ${color}">
                ${label}
            </div>
        </div>
    `;

    // Position Logic
    const x = evt.clientX;
    const y = evt.clientY;
    const viewportWidth = window.innerWidth;
    
    tooltip.style.top = `${y - 75}px`; 
    tooltip.style.left = '';
    tooltip.style.right = '';

    if (x > viewportWidth * 0.60) {
        tooltip.style.right = `${viewportWidth - x + 10}px`;
        tooltip.style.left = 'auto';
    } else {
        tooltip.style.left = `${x - 70}px`; 
        tooltip.style.right = 'auto';
    }
    
    if (parseInt(tooltip.style.left) < 10) tooltip.style.left = '10px';

    tooltip.classList.remove('opacity-0');
    
    if (window.dashTooltipTimer) clearTimeout(window.dashTooltipTimer);
    window.dashTooltipTimer = setTimeout(() => {
        tooltip.classList.add('opacity-0');
    }, 3000);
};

export function renderDashboard(planMd, mergedLogData) {
    // 1. Common Data Prep
    const scheduleSection = Parser.getSection(planMd, "Weekly Schedule");
    if (!scheduleSection) return '<p class="text-slate-500 italic">No Weekly Schedule found.</p>';

    // Parse workouts for the Progress Widget
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
