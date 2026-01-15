import { getBiometricsData, parseZoneTables } from './logic.js';
import { renderGauge, renderCyclingStats, renderRunningStats, renderButton, initPacingChart } from './components.js';

export function renderZones(planMd) {
    const bio = getBiometricsData(planMd);
    
    // Components
    const cyclingStatsHtml = renderCyclingStats(bio);
    const gaugeHtml = renderGauge(bio.wkgNum, bio.percent, bio.cat);
    const runningStatsHtml = renderRunningStats(bio);
    
    // Now returns an object { cycling, running }
    const zones = parseZoneTables(planMd);
    
    const buttonHtml = renderButton();

    // Async Chart Init
    setTimeout(() => initPacingChart('runningPacingChart'), 0);

    return `
        <div class="zones-layout grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div class="flex flex-col gap-6">
                ${gaugeHtml}

                ${cyclingStatsHtml}
                
                <div class="flex flex-col gap-4">
                    ${zones.cycling}
                </div>
            </div>

            <div class="flex flex-col gap-6">
                
                <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-lg">
                    <div class="flex items-center gap-2 mb-4">
                        <i class="fa-solid fa-chart-line text-sky-500"></i>
                        <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Running Pacing</span>
                    </div>
                    <div class="h-64 w-full relative">
                        <canvas id="runningPacingChart"></canvas>
                    </div>
                </div>

                ${runningStatsHtml}

                <div id="zone-grid" class="flex flex-col gap-4">
                    ${zones.running}
                </div>
            </div>

        </div>

        ${buttonHtml}
    `;
}
