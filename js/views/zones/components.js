// js/views/zones/components.js
import { ZONES_CONFIG } from './config.js';

export const renderZoneComponents = (data) => {
    
    const buildRow = (z, range, desc, color) => `
        <tr class="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
            <td class="px-4 py-3 font-bold" style="color:${color}">${z}</td>
            <td class="px-4 py-3 text-white font-mono">${range}</td>
            <td class="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">${desc}</td>
        </tr>
    `;

    const bikeRows = ZONES_CONFIG.bike.map((z, i) => {
        const min = Math.round(data.ftp * z.minPct);
        const max = Math.round(data.ftp * z.maxPct);
        const range = i === ZONES_CONFIG.bike.length - 1 ? `> ${min} W` : `${min} - ${max} W`;
        return buildRow(z.name, range, z.desc, z.color);
    }).join('');

    const runRows = ZONES_CONFIG.run.map((z, i) => {
        const min = Math.round(data.lthr * z.minPct);
        const max = Math.round(data.lthr * z.maxPct);
        const range = i === ZONES_CONFIG.run.length - 1 ? `> ${min} bpm` : `${min} - ${max} bpm`;
        return buildRow(z.name, range, z.desc, z.color);
    }).join('');

    // --- CHART FUNCTION ---
    window.renderRunningPaceChart = () => {
        const ctx = document.getElementById('runPaceChart');
        // Safety: If no data, render nothing but don't crash
        if (!ctx || !data.runPacing || data.runPacing.length < 2) return;
        if (typeof Chart === 'undefined') return; // Safety check

        if (window.myRunChart) window.myRunChart.destroy();

        window.myRunChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.runPacing.map(d => d.label),
                datasets: [{
                    label: 'Race Pace (min/km)',
                    data: data.runPacing.map(d => d.pace),
                    borderColor: '#10b981', 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#10b981',
                    pointRadius: 5,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        reverse: true, // Lower is faster
                        title: { display: true, text: 'Pace (min/km)', color: '#94a3b8' },
                        grid: { color: '#334155' },
                        ticks: { 
                            color: '#94a3b8',
                            callback: (val) => {
                                const m = Math.floor(val);
                                const s = Math.round((val - m) * 60);
                                return `${m}:${s.toString().padStart(2,'0')}`;
                            }
                        }
                    },
                    x: {
                        grid: { color: 'transparent' },
                        ticks: { color: '#e2e8f0' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw;
                                const m = Math.floor(val);
                                const s = Math.round((val - m) * 60);
                                return `Pace: ${m}:${s.toString().padStart(2,'0')} /km`;
                            }
                        }
                    }
                }
            }
        });
    };

    return `
        <div class="max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
            
            <div class="flex items-center gap-4 mb-6">
                <div class="p-3 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                    <i class="fa-solid fa-layer-group text-2xl"></i>
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-white">Training Zones</h2>
                    <p class="text-sm text-slate-400">Power & Heart Rate Distributions</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-slate-800/50 p-5 rounded-xl border border-slate-700 text-center">
                            <div class="text-slate-400 text-xs uppercase tracking-wider mb-1">FTP</div>
                            <div class="text-3xl font-bold text-blue-400">${data.ftp}<span class="text-sm text-slate-500 ml-1">w</span></div>
                        </div>
                        <div class="bg-slate-800/50 p-5 rounded-xl border border-slate-700 text-center">
                            <div class="text-slate-400 text-xs uppercase tracking-wider mb-1">W/KG</div>
                            <div class="text-3xl font-bold text-emerald-400">${data.wkg}<span class="text-sm text-slate-500 ml-1">w/kg</span></div>
                        </div>
                    </div>

                    <div class="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                        <div class="bg-slate-900/50 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                            <h3 class="font-bold text-white flex items-center gap-2">
                                <i class="fa-solid fa-bicycle text-blue-400"></i> Cycling Power Zones
                            </h3>
                        </div>
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="text-xs text-slate-400 uppercase bg-slate-900/30">
                                    <th class="px-4 py-2 font-medium">Zone</th>
                                    <th class="px-4 py-2 font-medium">Range</th>
                                    <th class="px-4 py-2 font-medium hidden sm:table-cell">Effect</th>
                                </tr>
                            </thead>
                            <tbody class="text-sm divide-y divide-slate-700/30">
                                ${bikeRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="space-y-6">
                    
                    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-lg relative">
                        <h3 class="font-bold text-white flex items-center gap-2 mb-4">
                            <i class="fa-solid fa-stopwatch text-emerald-400"></i> Running Pacing Profile
                        </h3>
                        <div class="w-full h-[200px] flex items-center justify-center">
                            <canvas id="runPaceChart"></canvas>
                        </div>
                    </div>

                    <div class="bg-slate-800/50 p-5 rounded-xl border border-slate-700 flex justify-between items-center">
                        <div>
                            <div class="text-slate-400 text-xs uppercase tracking-wider mb-1">Threshold HR</div>
                            <div class="text-3xl font-bold text-rose-400">${data.lthr}<span class="text-sm text-slate-500 ml-1">bpm</span></div>
                        </div>
                         <div>
                            <div class="text-slate-400 text-xs uppercase tracking-wider mb-1">Max HR</div>
                            <div class="text-3xl font-bold text-slate-200">${data.maxHr}<span class="text-sm text-slate-500 ml-1">bpm</span></div>
                        </div>
                    </div>

                    <div class="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                        <div class="bg-slate-900/50 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                            <h3 class="font-bold text-white flex items-center gap-2">
                                <i class="fa-solid fa-person-running text-rose-400"></i> Running HR Zones
                            </h3>
                        </div>
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="text-xs text-slate-400 uppercase bg-slate-900/30">
                                    <th class="px-4 py-2 font-medium">Zone</th>
                                    <th class="px-4 py-2 font-medium">Range</th>
                                    <th class="px-4 py-2 font-medium hidden sm:table-cell">Effect</th>
                                </tr>
                            </thead>
                            <tbody class="text-sm divide-y divide-slate-700/30">
                                ${runRows}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    `;
};
