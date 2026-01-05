import { renderGear as buildGear } from './gear.js'; // Reuse existing logic
import { renderZones as buildZones } from './zones.js'; // Reuse existing logic

export function renderResources(planMd, gearMd, temp, hourly) {
    // 1. Zones Section
    const zonesHtml = buildZones(planMd);

    // 2. Gear Section
    const gearResult = buildGear(gearMd, temp, hourly);

    const html = `
        <div class="space-y-12">
            <section>
                <div class="flex items-center gap-2 mb-6 border-b border-slate-700 pb-2">
                    <i class="fa-solid fa-heart-pulse text-red-500 text-xl"></i>
                    <h2 class="text-xl font-bold text-white">Training Zones</h2>
                </div>
                ${zonesHtml}
            </section>

            <section>
                <div class="flex items-center gap-2 mb-6 border-b border-slate-700 pb-2">
                    <i class="fa-solid fa-bicycle text-blue-500 text-xl"></i>
                    <h2 class="text-xl font-bold text-white">Gear Selection</h2>
                </div>
                ${gearResult.html}
            </section>
        </div>
    `;

    return { html, gearData: gearResult.gearData };
}

// Re-export the gear update function so app.js can use it
export { updateGearResult } from './gear.js';
