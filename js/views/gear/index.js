// js/views/gear/index.js
import { Parser } from '../../parser.js';
import { buildHourlyForecast, buildTempOptions, renderLayout } from './components.js';
import { updateGearUI } from './logic.js';

export function renderGear(gearMd, currentTemp, hourlyWeather) {
    const gearData = Parser.parseGearMatrix(gearMd);

    // 1. Set Default Temperature Selection
    let defaultVal = 50;
    if (currentTemp !== null && currentTemp !== undefined) {
        if (currentTemp < 30) defaultVal = 25;
        else if (currentTemp > 70) defaultVal = 75;
        else defaultVal = currentTemp;
    }

    // 2. Build Sub-components
    const tempOptions = buildTempOptions(defaultVal);
    const hourlyHtml = buildHourlyForecast(hourlyWeather);

    // 3. Assemble Layout
    const html = renderLayout(hourlyHtml, tempOptions, gearMd);

    return { html, gearData };
}

export function updateGearResult(gearData) {
    updateGearUI(gearData);
}
