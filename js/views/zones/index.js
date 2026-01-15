// js/views/zones/index.js
import { getBiometricsData, parseZoneTables } from './logic.js';
import { renderGauge, renderCyclingStats, renderRunningStats, renderButton, initPacingChart } from './components.js';

export function renderZones(planMd) {
    const bio = getBiometricsData(planMd);
    
    // Components
    const cyclingStatsHtml = renderCyclingStats(bio);
    const gaugeHtml = renderGauge(bio.wkgNum, bio.percent, bio.cat);
    const runningStatsHtml = renderRunningStats(bio);
    const zonesGridHtml = parseZoneTables(planMd);
    const buttonHtml = renderButton();

    // Trigger Chart Load (Async)
    setTimeout(() => initPacingChart('runningPacingChart'), 0);

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 items-center">
            ${cyclingStatsHtml}
            ${gaugeHtml}
        </div>

        <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-lg mb-8">
            <div class="flex items-center gap-2 mb-4">
                <i class="fa-solid fa-chart-line text-sky-500"></i>
                <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Running Pacing (Over Distance)</span>
            </div>
            <div class="h-64 w-full">
                <canvas id="runningPacingChart"></canvas>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-4">
                ${runningStatsHtml}
            </div>
            <div id="zone-grid" class="flex flex-col gap-4">
                ${zonesGridHtml}
            </div>
        </div>

        ${buttonHtml}
    `;
}
