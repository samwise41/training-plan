// js/views/zones/logic.js
import { Parser } from '../../parser.js';
import { CONFIG } from './config.js';

export const getBiometricsData = (planMd) => {
    // Safe destructuring in case parser is old or data is missing
    const bio = Parser.getBiometrics(planMd) || {};
    const watts = bio.watts || 0;
    const weight = bio.weight || 0;
    const lthr = bio.lthr || '--';
    const runFtp = bio.runFtp || '--';
    const fiveK = bio.fiveK || '--';

    const weightKg = weight * 0.453592;
    const wkgNum = weightKg > 0 ? (watts / weightKg) : 0;
    
    // Determine W/kg Category
    let category = CONFIG.CATEGORIES[CONFIG.CATEGORIES.length - 1]; // Default to lowest
    for (const cat of CONFIG.CATEGORIES) {
        if (wkgNum >= cat.threshold) {
            category = cat;
            break;
        }
    }

    return {
        watts,
        weight,
        lthr,
        runFtp,
        fiveK,
        wkgNum,
        category
    };
};

export const parseZones = (planMd) => {
    const zoneSection = Parser.getSection(planMd, "Training Zones");
    if (!zoneSection) return [];

    const lines = zoneSection.split('\n');
    const zones = [];
    
    lines.forEach(line => {
        // Look for table rows like: | Zone 1 | Recovery | ...
        if (line.trim().startsWith('|') && !line.includes('---') && !line.toLowerCase().includes('zone')) {
            const cols = line.split('|').map(c => c.trim()).filter(c => c);
            if (cols.length >= 4) {
                zones.push({
                    name: cols[0],
                    desc: cols[1],
                    hr: cols[2],
                    power: cols[3]
                });
            }
        }
    });

    return zones;
};
