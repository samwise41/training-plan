// js/views/metrics/index.js
import { renderSummaryTable } from './table.js';
import { updateCharts } from './charts.js';

let currentRange = '90d'; // Default view

// Global Handler for Buttons
window.updateMetricsTime = (range) => {
    currentRange = range;
    if(window.App && window.App.allData) {
        updateCharts(window.App.allData, currentRange);
    }
};

export const renderMetrics = (allData) => {
    if (!allData) return `<div class="p-10 text-center text-red-400">Error: No data available</div>`;

    // 1. Render Static Structure
    const buttons = ['30d', '90d', '6m', '1y'].map(r => 
        `<button id="btn-metric-${r}" onclick="window.updateMetricsTime('${r}')" 
          class="px-3 py-1 rounded text-[10px] font-bold transition-all bg-slate-800 text-slate-400 hover:text-white">
          ${r.toUpperCase()}
        </button>`
    ).join('');

    const html = `
        <div class="space-y-8 animate-fade-in pb-20">
            <div class="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-md sticky top-0 z-20">
                <div>
                    <h2 class="text-xl font-black text-white italic tracking-tighter">PERFORMANCE METRICS</h2>
                    <p class="text-[10px] text-slate-400 font-mono uppercase">Physiological & Mechanical Analysis</p>
                </div>
                <div class="flex gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    ${buttons}
                </div>
            </div>

            ${renderSummaryTable(allData)}

            <div id="metrics-charts-section" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="md:col-span-2"><h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-4">General Fitness</h3></div>
                <div id="metric-chart-vo2max"></div>
                <div id="metric-chart-tss"></div>
                <div id="metric-chart-anaerobic"></div>

                <div class="md:col-span-2 mt-4"><h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-4">Cycling Dynamics</h3></div>
                <div id="metric-chart-endurance"></div>
                <div id="metric-chart-strength"></div>
                <div id="metric-chart-subjective_bike"></div>

                <div class="md:col-span-2 mt-4"><h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-4">Running Dynamics</h3></div>
                <div id="metric-chart-run"></div>
                <div id="metric-chart-mechanical"></div>
                <div id="metric-chart-gct"></div>
                <div id="metric-chart-vert"></div>
                <div id="metric-chart-subjective_run"></div>

                <div class="md:col-span-2 mt-4"><h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-4">Swimming Dynamics</h3></div>
                <div id="metric-chart-swim"></div>
                <div id="metric-chart-subjective_swim"></div>
            </div>
        </div>
        
        <div id="metric-tooltip-popup" class="fixed z-50 pointer-events-none opacity-0 transition-opacity bg-slate-900/90 border border-slate-700 p-2 rounded shadow-xl text-xs backdrop-blur-sm"></div>
    `;

    // 2. Schedule Chart Update
    // We use setTimeout to ensure the DOM elements exist before we try to draw into them
    setTimeout(() => {
        updateCharts(allData, currentRange);
    }, 50);

    return html;
};

// Global Tooltip Helper (Required for charts.js)
window.showMetricTooltip = (e, date, title, val, unit, label, color) => {
    const el = document.getElementById('metric-tooltip-popup');
    if(!el) return;
    
    el.innerHTML = `
        <div class="text-slate-400 mb-1 border-b border-slate-700 pb-1">${date}</div>
        <div class="font-bold text-white mb-1">${title}</div>
        <div class="font-mono text-lg font-bold" style="color:${color}">${val}</div>
        <div class="text-slate-300 mt-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 inline-block">${label}</div>
    `;
    
    el.classList.remove('opacity-0');
    el.style.left = `${e.pageX + 15}px`;
    el.style.top = `${e.pageY - 15}px`;
    
    // Auto-hide after 3s or on mouseout logic if needed
    clearTimeout(window.metricTooltipTimer);
    window.metricTooltipTimer = setTimeout(() => el.classList.add('opacity-0'), 3000);
};
