// js/views/zones/logic.js
import { Parser } from '../../parser.js';
import { CONFIG } from './config.js';

export const getBiometricsData = (planMd) => {
    const bio = Parser.getBiometrics(planMd) || {};
    const watts = bio.watts || 0;
    const weight = bio.weight || 0;
    const lthr = bio.lthr || '--';
    const runFtp = bio.runFtp || '--';
    const fiveK = bio.fiveK || '--';

    const weightKg = weight * 0.453592;
    const wkgNum = weightKg > 0 ? (watts / weightKg) : 0;
    
    // Determine Category
    const cat = CONFIG.CATEGORIES.find(c => wkgNum >= c.threshold) || CONFIG.CATEGORIES[CONFIG.CATEGORIES.length - 1];
    const percent = Math.min(Math.max((wkgNum - CONFIG.WKG_SCALE.min) / (CONFIG.WKG_SCALE.max - CONFIG.WKG_SCALE.min), 0), 1);

    return {
        watts,
        weight,
        lthr,
        runFtp,
        fiveK,
        wkgNum,
        cat,
        percent
    };
};

export const parseZoneTables = (planMd) => {
    // Exact logic from your original file
    const section = Parser.getSection(planMd, "Training Parameters") || Parser.getSection(planMd, "Zones");
    let current = '', html = '', categories = {};
    
    if (!section) return `<p class="text-slate-500 text-center col-span-2">No zone data found.</p>`;
    
    section.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) {
            current = trimmed.replace(/###/g, '').split('(')[0].trim();
            categories[current] = [];
        } else if (current && trimmed.includes(':')) {
            const [labelRaw, range] = trimmed.replace(/[\*\-\+]/g, '').split(':');
            const label = labelRaw.trim();
            
            // --- ROBUST LOGIC START (Preserved) ---
            let zClass = 'z-1'; // Default
            const cleanLabel = label.toLowerCase();

            if (cleanLabel.includes('sweet spot') || cleanLabel.includes('sweetspot')) {
                zClass = 'z-ss';
            } else {
                const zMatch = cleanLabel.match(/zone (\d)/);
                if (zMatch) {
                    zClass = `z-${zMatch[1]}`;
                }
            }
            // --- ROBUST LOGIC END ---

            categories[current].push(`
                <div class="zone-row ${zClass}">
                    <span class="font-bold">${label}</span>
                    <span class="font-mono text-slate-400">${range ? range.trim() : '--'}</span>
                </div>
            `);
        }
    });
    
    Object.keys(categories).forEach(k => {
        html += `
            <div class="zone-card">
                <div class="zone-card-title">${k}</div>
                ${categories[k].join('')}
            </div>
        `;
    });
    return html;
};
