import { getBiometricsData, parseZoneTables } from './logic.js';
import { renderGauge, renderCyclingStats, renderRunningStats, renderButton, initPacingChart } from './components.js';

export function renderZones(planMd) {
    const bio = getBiometricsData(planMd);
    
    // Components
    const cyclingStatsHtml = renderCyclingStats(bio);
    const gaugeHtml = renderGauge(bio.wkgNum, bio.percent, bio.cat);
    const runningStatsHtml = renderRunningStats(bio);
    
    // Split Zones
    const zones = parseZoneTables(planMd);
    const buttonHtml = renderButton();

    // Async Chart Init
    setTimeout(() => initPacingChart('runningPacingChart'), 0);

    return `
        <div class="zones-layout grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div class="flex flex-col gap-6">
                
                <div class="h-72">
                    ${gaugeHtml}
                </div>

                <div class="h-48">
                    ${cyclingStatsHtml}
                </div>
                
                <div class="flex flex-col gap-4">
                    ${zones.cycling}
                </div>
            </div>

            <div class="flex flex-col gap-6">
                
                <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-lg h-72 flex flex-col">
                    <div class="flex items-center gap-2 mb-2 shrink-0">
                        <i class="fa-solid fa-chart-line text-sky-500"></i>
                        <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Running Pacing</span>
                    </div>
                    <div class="flex-1 w-full relative min-h-0">
                        <canvas id="runningPacingChart"></canvas>
                    </div>
                </div>

                <div class="h-48">
                    ${runningStatsHtml}
                </div>

                <div class="flex flex-col gap-4 w-full">
                    ${zones.running}
                </div>
            </div>

        </div>

        ${buttonHtml}
    `;
}
