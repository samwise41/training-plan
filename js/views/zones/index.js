// js/views/zones/index.js
import { getBiometricsData, parseZoneTables } from './logic.js';
import { renderHeader, renderFtpButton } from './components.js';

export function renderZones(planMd) {
    // 1. Process Data
    const bio = getBiometricsData(planMd);
    
    // 2. Generate HTML Strings
    const headerHtml = renderHeader(bio);
    const zonesGridHtml = parseZoneTables(planMd); // This generates the HTML directly now
    const buttonHtml = renderFtpButton();

    // 3. Assemble View
    return `
        <div class="max-w-6xl mx-auto">
            ${headerHtml}
            <div id="zone-grid">
                ${zonesGridHtml}
            </div>
            ${buttonHtml}
        </div>
    `;
}
