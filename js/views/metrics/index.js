// js/views/metrics/index.js
import { renderSummaryTable } from './table.js';
import { updateCharts } from './charts.js';

let currentRange = '90d'; // Set default to 90d

// Global Handler
window.updateMetricsTime = (range) => {
    currentRange = range;
    if(window.App && window.App.allData) {
        updateCharts(window.App.allData, currentRange);
    }
};

// Collapsible Helper
const buildSection = (id, title, content, isOpen = true) => {
    const heightClass = isOpen ? "max-h-[5000px] opacity-100 py-4" : "max-h-0 opacity-0 py-0 overflow-hidden";
    const rotateClass = isOpen ? "rotate-0" : "-rotate-90";
    
    return `
        <div class="border-b border-slate-800 pb-4">
            <div class="flex items-center gap-2 cursor-pointer group select-none py-2" onclick="const el=document.getElementById('${id}'); const ic=this.querySelector('i'); el.classList.toggle('max-h-0'); el.classList.toggle('opacity-0'); el.classList.toggle('py-0'); el.classList.toggle('overflow-hidden'); el.classList.toggle('max-h-[5000px]'); el.classList.toggle('opacity-100'); el.classList.toggle('py-4'); ic.classList.toggle('-rotate-90');">
                <i class="fa-solid fa-caret-down text-slate-500 transition-transform duration-300 ${rotateClass} group-hover:text-white"></i>
                <h3 class="text-sm font-bold text-slate-300 uppercase tracking-widest group-hover:text-white transition-colors">${title}</h3>
            </div>
            <div id="${id}" class="transition-all duration-500 ease-in-out ${heightClass}">
                ${content}
            </div>
        </div>
    `;
};

export const renderMetrics = (allData) => {
    if (!allData) return `<div class="p-10 text-center text-red-400 font-mono">Error: No data available</div>`;

    // 1. Time Toggle Buttons
    const buttons = ['30d', '90d', '6m', '1y'].map(r => 
        `<button id="btn-metric-${r}" onclick="window.updateMetricsTime('${r}')" 
          class="px-3 py-1 rounded text-[10px] font-bold transition-all ${r===currentRange ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}">
          ${r.toUpperCase()}
        </button>`
    ).join('');

    // 2. Build Chart Grids
    const gridClass = "grid grid-cols-1 md:grid-cols-2 gap-6";
    
    const generalCharts = `
        <div class="${gridClass}">
            <div class="md:col-span-2" id="metric-chart-tss"></div>
            <div id="metric-chart-vo2max"></div>
            <div id="metric-chart-anaerobic"></div>
        </div>`;

    const bikeCharts = `
        <div class="${gridClass}">
            <div id="metric-chart-subjective_bike"></div>
            <div id="metric-chart-endurance"></div>
            <div id="metric-chart-strength"></div>
        </div>`;

    const runCharts = `
        <div class="${gridClass}">
            <div id="metric-chart-subjective_run"></div>
            <div id="metric-chart-run"></div>
            <div id="metric-chart-mechanical"></div>
            <div id="metric-chart-gct"></div>
            <div id="metric-chart-vert"></div>
        </div>`;

    const swimCharts = `
        <div class="${gridClass}">
            <div id="metric-chart-subjective_swim"></div>
            <div id="metric-chart-swim"></div>
        </div>`;

    // 3. Assemble HTML
    const html = `
        <div class="max-w-7xl mx-auto space-y-8 animate-fade-in pb-24 font-sans">
            <div class="flex flex-col md:flex-row justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-md sticky top-0 z-20 shadow-xl">
                <div class="mb-3 md:mb-0">
                    <h2 class="text-xl font-black text-white italic tracking-tighter flex items-center gap-2">
                        <i class="fa-solid fa-chart-line text-blue-500"></i> PERFORMANCE METRICS
                    </h2>
                    <p class="text-[10px] text-slate-400 font-mono uppercase tracking-widest pl-7">Physiological & Mechanical Analysis</p>
                </div>
                <div class="flex gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    ${buttons}
                </div>
            </div>

            ${buildSection('sect-table', 'Statistical Overview', renderSummaryTable(allData), true)}

            ${buildSection('sect-general', 'General Fitness', generalCharts, true)}
            ${buildSection('sect-bike', 'Cycling Dynamics', bikeCharts, true)}
            ${buildSection('sect-run', 'Running Dynamics', runCharts, true)}
            ${buildSection('sect-swim', 'Swimming Dynamics', swimCharts, true)}
        </div>
        
        <div id="metric-tooltip-popup" class="fixed z-50 pointer-events-none opacity-0 transition-opacity bg-slate-900/95 border border-slate-600 p-3 rounded-lg shadow-2xl text-xs backdrop-blur-md transform -translate-x-1/2 -translate-y-full mt-[-10px]"></div>
    `;

    // 4. Initialize Charts
    setTimeout(() => {
        if(window.App && window.App.allData) {
            updateCharts(window.App.allData, currentRange);
        }
    }, 50);

    return html;
};

// Tooltip Helper
window.showMetricTooltip = (e, date, title, val, unit, label, color) => {
    const el = document.getElementById('metric-tooltip-popup');
    if(!el) return;
    
    el.innerHTML = `
        <div class="text-slate-400 mb-1 border-b border-slate-700 pb-1 font-mono text-[10px]">${date}</div>
        <div class="font-bold text-white mb-1 truncate max-w-[200px]">${title}</div>
        <div class="flex items-center gap-2">
            <span class="font-mono text-lg font-bold" style="color:${color}">${val}</span>
            <span class="text-slate-500 text-[10px]">${unit}</span>
        </div>
        <div class="text-slate-300 mt-2 bg-slate-800 px-2 py-1 rounded border border-slate-700 inline-block font-mono text-[10px]">${label}</div>
    `;
    
    const x = e.clientX;
    const y = e.clientY;
    
    el.style.left = `${x}px`;
    el.style.top = `${y - 15}px`;
    el.classList.remove('opacity-0');
    
    clearTimeout(window.metricTooltipTimer);
    window.metricTooltipTimer = setTimeout(() => el.classList.add('opacity-0'), 2500);
};
