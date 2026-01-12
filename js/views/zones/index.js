// js/views/zones/index.js
import { getBiometricsData, parseZones } from './logic.js';
import { renderHeader, renderZoneGrid, renderFtpButton } from './components.js';

export function renderZones(planMd) {
    // 1. Process Data
    const bio = getBiometricsData(planMd);
    const zones = parseZones(planMd);

    // 2. Build Components
    const headerHtml = renderHeader(bio);
    const gridHtml = renderZoneGrid(zones);
    const buttonHtml = renderFtpButton();

    // 3. Assemble View
    return `
        <div class="max-w-6xl mx-auto">
            ${headerHtml}
            ${gridHtml}
            ${buttonHtml}
        </div>
    `;
}
