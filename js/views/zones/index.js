// js/views/zones/index.js
import { getBiometricsData, parseZoneTables } from './logic.js';
import { renderGauge, renderStatsGrid, renderButton } from './components.js';

export function renderZones(planMd) {
    // 1. Process Data
    const bio = getBiometricsData(planMd);
    
    // 2. Generate HTML Components
    const gaugeHtml = renderGauge(bio.wkgNum, bio.percent, bio.cat);
    const statsHtml = renderStatsGrid(bio);
    const zonesGridHtml = parseZoneTables(planMd);
    const buttonHtml = renderButton();

    // 3. Assemble Final View (Exact order from original)
    return `
        ${gaugeHtml}
        ${statsHtml}
        <div id="zone-grid">
            ${zonesGridHtml}
        </div>
        ${buttonHtml}
    `;
}
