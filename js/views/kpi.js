import { Parser } from '../parser.js';

let logData = [];

// Helper functions internal to this module
const getIconForType = (type) => {
    if (type === 'Bike') return '<i class="fa-solid fa-bicycle text-blue-500 text-xl"></i>';
    if (type === 'Run') return '<i class="fa-solid fa-person-running text-emerald-500 text-xl"></i>';
    if (type === 'Swim') return '<i class="fa-solid fa-person-swimming text-cyan-500 text-xl"></i>';
    return '<i class="fa-solid fa-chart-line text-purple-500 text-xl"></i>';
};

const buildDonut = (percent, label, fraction) => {
    const radius = 15.9155;
    const circumference = 2 * Math.PI * radius; 
    const strokeDasharray = `${percent} ${100 - percent}`;
    const color = percent >= 80 ? '#22c55e' : (percent >= 50 ? '#eab308' : '#ef4444');

    return `
        <div class="chart-container">
            <svg width="120" height="120" viewBox="0 0 42 42" class="donut-svg">
                <circle class="donut-bg" cx="21" cy="21" r="${radius}"></circle>
                <circle class="donut-segment" cx="21" cy="21" r="${radius}" 
                        stroke="${color}" stroke-dasharray="${strokeDasharray}" stroke-dashoffset="25"></circle>
            </svg>
            <div class="donut-text">
                <span class="donut-percent">${percent}%</span>
                <span class="donut-fraction">${fraction}</span>
            </div>
            <div class="chart-label">${label}</div>
        </div>
    `;
};

// Exported function to be called by App.js
export function renderKPI(planMd) {
    logData = Parser.parseTrainingLog(planMd);

    // ... (Add your calculateCountStats and calculateDurationStats functions here) ...
    // Note: Use 'logData' instead of 'this.logData' inside these functions

    // ... (Add your buildMetricRow function here) ...

    const html = `
        <h2 class="text-lg font-bold text-white mb-6 border-b border-slate-700 pb-2">Workout Completion (Count)</h2>
        <div class="kpi-card bg-slate-800/20 border-t-4 border-t-purple-500">
            <select id="kpi-sport-select" onchange="window.App.updateDurationAnalysis()" class="gear-select">...</select>
            </div>
        `;
    
    // Return both the HTML and the data needed for interaction
    return { html, logData };
}

// Exported logic for the interactivity
export function updateDurationAnalysis(data) {
    // ... (Paste your updateDurationAnalysis logic here) ...
    // Note: Use 'data' passed in argument instead of 'this.logData'
}
