import { renderGauge, renderPowerCurve, renderPaceGraph, renderZonesTable } from './components.js';
import { calculateZones } from './logic.js';

export const renderZonesView = async (container) => {
    container.innerHTML = `
        <div class="zones-dashboard space-y-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div id="cycling-ftp-gauge" class="dashboard-card"></div>
                <div id="running-ftp-gauge" class="dashboard-card"></div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div id="cycling-power-curve" class="dashboard-card"></div>
                <div id="running-pace-graph" class="dashboard-card"></div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div id="cycling-zones-table" class="dashboard-card"></div>
                <div id="running-hr-zones-table" class="dashboard-card"></div>
            </div>
        </div>
    `;

    // Fetch and Render Data
    const cyclingData = await fetch('strava_data/cycling/power_curve_graph.json').then(res => res.json());
    const runningData = await fetch('strava_data/running/my_running_prs.md').then(res => res.text());

    // Row 1: Top Gauges
    renderGauge('cycling-ftp-gauge', 'Cycling FTP', 'Watts');
    renderGauge('running-ftp-gauge', 'Running FTP', 'Pace');

    // Row 2: Performance Visuals
    renderPowerCurve('cycling-power-curve', cyclingData); // Uses the new JSON
    renderPaceGraph('running-pace-graph', runningData);

    // Row 3: Training Reference
    renderZonesTable('cycling-zones-table', 'Power Zones');
    renderZonesTable('running-hr-zones-table', 'Heart Rate Zones');
};
