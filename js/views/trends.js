// js/views/trends.js

let logData = [];

// ... (Toggle functions, Tooltip logic, Chart helpers remain the same as previous versions) ...
// Ensure showVolumeTooltip and showTrendTooltip are present here as defined previously.
// ...

// --- CHART BUILDERS (Standard Volume & Adherence) ---
// (Copy renderVolumeChart, buildTrendChart, buildConcentricChart, buildFTPChart from previous response)
// ...

// --- MAIN RENDER FUNCTION ---
export function renderTrends(mergedLogData) {
    logData = Array.isArray(mergedLogData) ? mergedLogData : [];

    // Removed: renderRaceReadinessChart() logic

    const calculateStats = (targetType, days, isDuration) => {
        // ... (Stats calculation logic) ...
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
        const now = new Date(); now.setHours(23, 59, 59, 999);
        const subset = logData.filter(item => { if (!item || !item.date) return false; return item.date >= cutoff && item.date <= now && (targetType === 'All' || item.type === targetType); });
        let val = 0, target = 0;
        subset.forEach(item => { if (isDuration) { target += (item.plannedDuration || 0); if (item.type === item.actualType) val += (item.actualDuration || 0); } else { target++; if (item.completed) val++; } });
        const pct = target > 0 ? Math.round((val / target) * 100) : 0;
        const label = isDuration ? `${val > 120 ? (val/60).toFixed(1)+'h' : val+'m'}/${target > 120 ? (target/60).toFixed(1)+'h' : target+'m'}` : `${val}/${target}`;
        return { pct, label };
    };

    const volumeChartsHtml = `${renderVolumeChart(logData, 'All', 'Total Weekly Volume')}<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-0">${renderVolumeChart(logData, 'Bike', 'Cycling Volume')}${renderVolumeChart(logData, 'Run', 'Running Volume')}${renderVolumeChart(logData, 'Swim', 'Swimming Volume')}</div>`;
    const volumeSection = buildCollapsibleSection('volume-section', 'Weekly Volume Analysis', volumeChartsHtml, true);

    const trendContainerHtml = `<div id="trend-charts-container"></div>`;
    const trendsSection = buildCollapsibleSection('trends-section', 'Adherence Trends', trendContainerHtml, true);

    const ftpHtml = buildFTPChart();
    const ftpSection = buildCollapsibleSection('ftp-section', 'Fitness Progression', ftpHtml, true);

    const buildCombinedCard = (title, type) => {
        const count30 = calculateStats(type, 30, false); const count60 = calculateStats(type, 60, false);
        const dur30 = calculateStats(type, 30, true); const dur60 = calculateStats(type, 60, true);
        return `<div class="kpi-card"><div class="kpi-header mb-2">${getIconForType(type)}<span class="kpi-title">${title}</span></div><div class="flex justify-around items-start"><div class="w-1/2 border-r border-slate-700 pr-2">${buildConcentricChart(count30, count60, "Count")}</div><div class="w-1/2 pl-2">${buildConcentricChart(dur30, dur60, "Time")}</div></div></div>`;
    };
    const adherenceHtml = `<div class="kpi-grid mb-0">${buildCombinedCard("All Activities", "All")}${buildCombinedCard("Cycling", "Bike")}${buildCombinedCard("Running", "Run")}${buildCombinedCard("Swimming", "Swim")}</div>`;
    const adherenceSection = buildCollapsibleSection('adherence-section', 'Compliance Overview', adherenceHtml, true);

    const durationHtml = `... (Duration Tool HTML) ...`; // Keep existing duration tool HTML
    const durationSection = buildCollapsibleSection('duration-section', 'Deep Dive Analysis', durationHtml, true);

    setTimeout(() => renderDynamicCharts(), 0);

    return { html: volumeSection + trendsSection + ftpSection + adherenceSection + durationSection, logData };
}

const renderDynamicCharts = () => {
    const container = document.getElementById('trend-charts-container');
    if (!container) return;

    // ... (Toggle buttons logic) ...

    const controlsHtml = `... (Controls HTML) ...`;
    const legendHtml = `... (Legend HTML) ...`;

    // REMOVED: renderRaceReadinessChart() from here
    container.innerHTML = `${controlsHtml}${legendHtml}${buildTrendChart("Rolling Adherence (Duration Based)", false)}${buildTrendChart("Rolling Adherence (Count Based)", true)}`;
};

// ... (Rest of file: helper functions, etc.) ...
