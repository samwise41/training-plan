// js/views/trends/index.js
import { buildCollapsibleSection, getIconForType } from './utils.js';
import { calculateStats, updateDurationAnalysis } from './analysis.js';
import { renderVolumeChart, renderDynamicCharts, buildFTPChart, buildConcentricChart } from './charts.js';

// --- MODULE STATE ---
let logData = [];
let planMdContent = "";

const chartState = {
    All: true,
    Bike: false,
    Run: false,
    Swim: false,
    timeRange: '60d',
    showWeekly: true, 
    show30d: true,    
    show60d: false    
};

// --- GLOBAL TOGGLE FUNCTIONS ---

window.toggleTrendSeries = (type) => {
    if (chartState.hasOwnProperty(type)) {
        chartState[type] = !chartState[type];
        renderDynamicCharts('trend-charts-container', logData, chartState); 
    }
};

window.toggleTrendTime = (range) => {
    chartState.timeRange = range;
    renderDynamicCharts('trend-charts-container', logData, chartState);
};

window.toggleTrendLine = (lineType) => {
    if (chartState.hasOwnProperty(lineType)) {
        chartState[lineType] = !chartState[lineType];
        renderDynamicCharts('trend-charts-container', logData, chartState);
    }
};

window.resetTrendDefaults = () => {
    chartState.All = true;
    chartState.Bike = false;
    chartState.Run = false;
    chartState.Swim = false;
    chartState.timeRange = '60d';
    chartState.showWeekly = true;
    chartState.show30d = true;
    chartState.show60d = false; 
    renderDynamicCharts('trend-charts-container', logData, chartState);
};

// Expose the analysis tool helper
window.App = window.App || {};
window.App.updateDurationAnalysis = () => updateDurationAnalysis(logData);


// --- MAIN RENDERER ---

export function renderTrends(mergedLogData) {
    // 1. Initialize Data
    logData = Array.isArray(mergedLogData) ? mergedLogData : [];
    // Access planMd safely from global App object or empty string
    planMdContent = window.App?.planMd || "";

    // 2. Build Sections
    
    // --- VOLUME SECTION ---
    const volumeChartsHtml = `
        ${renderVolumeChart(logData, planMdContent, 'All', 'Total Weekly Volume')}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-0">
            ${renderVolumeChart(logData, planMdContent, 'Bike', 'Cycling Volume')}
            ${renderVolumeChart(logData, planMdContent, 'Run', 'Running Volume')}
            ${renderVolumeChart(logData, planMdContent, 'Swim', 'Swimming Volume')}
        </div>`;
    const volumeSection = buildCollapsibleSection('volume-section', 'Weekly Volume Analysis', volumeChartsHtml, true);

    // --- TRENDS SECTION (Container Only) ---
    const trendContainerHtml = `<div id="trend-charts-container"></div>`;
    const trendsSection = buildCollapsibleSection('trends-section', 'Adherence Trends', trendContainerHtml, true);

    // --- FTP SECTION ---
    const ftpHtml = buildFTPChart(planMdContent);
    const ftpSection = buildCollapsibleSection('ftp-section', 'Fitness Progression', ftpHtml, true);

    // --- ADHERENCE OVERVIEW ---
    const buildCombinedCard = (title, type) => {
        const count30 = calculateStats(logData, type, 30, false); 
        const count60 = calculateStats(logData, type, 60, false);
        const dur30 = calculateStats(logData, type, 30, true); 
        const dur60 = calculateStats(logData, type, 60, true);
        return `<div class="kpi-card"><div class="kpi-header mb-2">${getIconForType(type)}<span class="kpi-title">${title}</span></div><div class="flex justify-around items-start"><div class="w-1/2 border-r border-slate-700 pr-2">${buildConcentricChart(count30, count60, "Count")}</div><div class="w-1/2 pl-2">${buildConcentricChart(dur30, dur60, "Time")}</div></div></div>`;
    };
    const adherenceHtml = `<div class="kpi-grid mb-0">${buildCombinedCard("All Activities", "All")}${buildCombinedCard("Cycling", "Bike")}${buildCombinedCard("Running", "Run")}${buildCombinedCard("Swimming", "Swim")}</div>`;
    const adherenceSection = buildCollapsibleSection('adherence-section', 'Compliance Overview', adherenceHtml, true);

    // --- DURATION TOOL ---
    const durationHtml = `<div class="kpi-card bg-slate-800/20 border-t-4 border-t-purple-500"><div class="kpi-header border-b border-slate-700 pb-2 mb-4"><i class="fa-solid fa-filter text-purple-500 text-xl"></i><span class="kpi-title ml-2 text-purple-400">Duration Analysis Tool</span></div><div class="flex flex-col sm:flex-row gap-4 mb-8"><div class="flex-1"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Sport Filter</label><select id="kpi-sport-select" onchange="window.App.updateDurationAnalysis()" class="gear-select"><option value="All">All Sports</option><option value="Bike">Bike</option><option value="Run">Run</option><option value="Swim">Swim</option></select></div><div class="flex-1"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Day Filter</label><select id="kpi-day-select" onchange="window.App.updateDurationAnalysis()" class="gear-select"><option value="All">All Days</option><option value="Weekday">Weekday (Mon-Fri)</option><option value="Monday">Monday</option><option value="Tuesday">Tuesday</option><option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option><option value="Friday">Friday</option><option value="Saturday">Saturday</option><option value="Sunday">Sunday</option></select></div><div class="flex-1"><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Time Period</label><select id="kpi-time-select" onchange="window.App.updateDurationAnalysis()" class="gear-select"><option value="All">All Time</option><option value="30">Last 30 Days</option><option value="60">Last 60 Days</option><option value="90">Last 90 Days</option></select></div></div><div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"><div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm"><div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Planned</div><div id="kpi-analysis-planned" class="text-xl font-bold text-white">--</div></div><div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm"><div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Actual</div><div id="kpi-analysis-actual" class="text-xl font-bold text-white">--</div></div><div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm"><div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Difference</div><div id="kpi-analysis-diff" class="text-xl font-bold text-white">--</div></div><div class="bg-slate-800/50 p-4 rounded-lg text-center border border-slate-700 shadow-sm"><div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Adherence</div><div id="kpi-analysis-pct" class="text-xl font-bold text-white">--</div></div></div><div class="border-t border-slate-700 pt-4"><h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Detailed Log (Matches Filters)</h4><div class="overflow-x-auto max-h-60 overflow-y-auto border border-slate-700 rounded-lg"><table id="kpi-debug-table" class="w-full text-left text-sm text-slate-300"><thead class="bg-slate-900 sticky top-0"><tr><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500">Date</th><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500">Day</th><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500">Type</th><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500 text-center">Plan</th><th class="py-2 px-2 text-xs font-bold uppercase text-slate-500 text-center">Act</th></tr></thead><tbody class="divide-y divide-slate-700"></tbody></table></div></div></div><div class="mt-8 text-center text-xs text-slate-500 italic">* 'h' in duration column denotes hours, otherwise minutes assumed.</div>`;
    const durationSection = buildCollapsibleSection('duration-section', 'Deep Dive Analysis', durationHtml, true);

    // 3. Post-Render: Initialize Dynamic Charts
    setTimeout(() => {
        renderDynamicCharts('trend-charts-container', logData, chartState);
    }, 0);

    return { html: volumeSection + trendsSection + ftpSection + adherenceSection + durationSection };
}
