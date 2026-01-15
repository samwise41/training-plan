// js/views/zones/index.js
import { getZonesLogic } from './logic.js';
import { renderZoneComponents } from './components.js';

export const renderZones = (planMd, recordsJson) => {
    // 1. Process Data
    const data = getZonesLogic(planMd, recordsJson);

    // 2. Schedule Chart Render (must happen after HTML injection)
    setTimeout(() => {
        if (window.renderRunningPaceChart) {
            window.renderRunningPaceChart();
        }
    }, 100);

    // 3. Return HTML
    return renderZoneComponents(data);
};
