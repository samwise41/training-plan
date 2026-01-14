// js/views/health/index.js
import { parseHealthTable, filterDataByRange } from './utils.js';
import { renderMultiLineChart } from './charts.js';

let fullHealthData = [];
let currentRange = '30d';

// Global handler for toggles
window.setHealthRange = (range) => {
    currentRange = range;
    renderHealthCharts();
    
    // Update active button state
    document.querySelectorAll('.health-range-btn').forEach(btn => {
        if(btn.id === `btn-health-${range}`) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-slate-700', 'text-slate-300');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-slate-700', 'text-slate-300');
        }
    });
};

const renderHealthCharts = () => {
    const container = document.getElementById('health-charts-container');
    if (!container) return;

    const displayData = filterDataByRange(fullHealthData, currentRange);

    // 1. Heart Rate Chart
    const hrHtml = renderMultiLineChart(displayData, 'chart-hr', 'Heart Rate Analysis', [
        { key: 'rhr', label: 'Resting HR', color: '#10b981' }, // Emerald
        { key: 'maxHr', label: 'Daily Max HR', color: '#ef4444' } // Red
    ]);

    // 2. Stress & Body Battery Chart
    const stressHtml = renderMultiLineChart(displayData, 'chart-stress', 'Stress & Body Battery', [
        { key: 'stressAvg', label: 'Avg Stress', color: '#f59e0b' }, // Amber
        { key: 'stressMax', label: 'Max Stress', color: '#fb923c' }, // Orange
        { key: 'bbMax', label: 'Body Batt Max', color: '#3b82f6' }, // Blue
        { key: 'bbMin', label: 'Body Batt Min', color: '#6366f1' }  // Indigo
    ]);

    container.innerHTML = hrHtml + stressHtml;
};

export const renderHealth = (mdText) => {
    fullHealthData = parseHealthTable(mdText);

    if (fullHealthData.length === 0) {
        return `<div class="p-12 text-center text-slate-500">No health data found. Ensure 'garmin_health.md' exists.</div>`;
    }

    const toggles = ['30d', '90d', '6m', '1y'].map(r => 
        `<button id="btn-health-${r}" onclick="window.setHealthRange('${r}')" class="health-range-btn px-3 py-1 rounded text-xs font-bold transition-colors ${r === currentRange ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}">${r.toUpperCase()}</button>`
    ).join('');

    // Defer chart rendering slightly to allow DOM injection
    setTimeout(() => renderHealthCharts(), 50);

    return `
        <div class="max-w-6xl mx-auto space-y-6">
            <div class="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-pink-500/20 rounded-lg text-pink-400">
                        <i class="fa-solid fa-heart-pulse text-xl"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-white">Health & Recovery</h2>
                        <p class="text-xs text-slate-400">Biometric trends from Garmin</p>
                    </div>
                </div>
                <div class="flex gap-2">${toggles}</div>
            </div>

            <div id="health-charts-container">
                <div class="animate-pulse h-64 bg-slate-800/50 rounded-xl"></div>
            </div>
        </div>
    `;
};
