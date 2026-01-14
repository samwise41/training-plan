// js/views/metrics/index.js
import { buildCollapsibleSection } from './utils.js';
import { renderSummaryTable } from './table.js';
import { updateCharts } from './charts.js';

let metricsState = { timeRange: '6m' };
let cachedData = [];

window.toggleMetricsTime = (range) => {
    metricsState.timeRange = range;
    updateCharts(cachedData, metricsState.timeRange);
};

// Global Tooltip Helper
window.showMetricTooltip = (e, date, name, val, unit, breakdown, color) => {
    const popup = document.getElementById('metric-tooltip-popup');
    if (!popup) return;
    popup.innerHTML = `
        <div class="font-bold text-white mb-1 border-b border-slate-700 pb-1">${date}</div>
        <div class="text-xs text-slate-300 mb-1">${name}</div>
        <div class="text-lg font-bold" style="color: ${color}">${val} <span class="text-xs text-slate-500">${unit}</span></div>
        <div class="text-[10px] text-slate-400 mt-1">${breakdown}</div>
    `;
    popup.style.left = `${e.pageX + 15}px`;
    popup.style.top = `${e.pageY - 10}px`;
    popup.classList.remove('opacity-0');
    
    // Hide on click/scroll
    const hide = () => { popup.classList.add('opacity-0'); document.removeEventListener('click', hide); };
    setTimeout(() => document.addEventListener('click', hide), 100);
};

export function renderMetrics(allData) {
    cachedData = allData || [];
    
    setTimeout(() => {
        updateCharts(cachedData, metricsState.timeRange);
    }, 50);

    const buildToggle = (range, label) => `<button id="btn-metric-${range}" onclick="window.toggleMetricsTime('${range}')" class="bg-slate-800 text-slate-400 px-3 py-1 rounded text-[10px] transition-all">${label}</button>`;
    
    const headerHtml = `
        <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800 backdrop-blur-sm sticky top-0 z-10 mb-6">
            <h2 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <i class="fa-solid fa-bullseye text-emerald-500"></i> Performance Metrics
            </h2>
            <div class="flex gap-1.5">${buildToggle('30d', '30d')}${buildToggle('90d', '90d')}${buildToggle('6m', '6m')}${buildToggle('1y', '1y')}</div>
        </div>`;

    const tableHtml = renderSummaryTable(cachedData);
    const tableSection = buildCollapsibleSection('metrics-table-section', 'Physiological Trends', tableHtml, true);

    const chartsGrid = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div id="metric-chart-vo2max"></div>
            <div id="metric-chart-anaerobic"></div>

            <div id="metric-chart-subjective_bike"></div>
            <div id="metric-chart-subjective_run"></div>
            <div id="metric-chart-subjective_swim"></div>

            <div id="metric-chart-endurance"></div>
            <div id="metric-chart-strength"></div>

            <div id="metric-chart-run"></div>
            <div id="metric-chart-mechanical"></div>
            <div id="metric-chart-gct"></div>
            <div id="metric-chart-vert"></div>

            <div id="metric-chart-swim"></div> 
        </div>`;
    
    const chartsSection = buildCollapsibleSection('metrics-charts-section', 'Detailed Charts', chartsGrid, true);

    return `
        <div class="max-w-7xl mx-auto space-y-6 pb-12 relative">
            ${headerHtml}
            ${tableSection}
            ${chartsSection}
        </div>
        <div id="metric-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs opacity-0 transition-opacity absolute pointer-events-auto cursor-pointer"></div>
    `;
}
