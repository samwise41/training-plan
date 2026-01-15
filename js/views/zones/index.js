// js/views/zones/index.js
import { getZonesLogic } from './logic.js';
import { renderZoneComponents } from './components.js';

export const renderZones = (planMd, recordsJson) => {
    // 1. Process Data
    const data = getZonesLogic(planMd, recordsJson);

    // 2. Schedule Chart Render (async to allow DOM paint)
    setTimeout(() => {
        if (typeof window.renderRunningPaceChart === 'function') {
            window.renderRunningPaceChart();
        }
    }, 100);

    // 3. Return HTML
    return renderZoneComponents(data);
};
