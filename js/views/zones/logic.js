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
    
    const cat = CONFIG.CATEGORIES.find(c => wkgNum >= c.threshold) || CONFIG.CATEGORIES[CONFIG.CATEGORIES.length - 1];
    const percent = Math.min(Math.max((wkgNum - CONFIG.WKG_SCALE.min) / (CONFIG.WKG_SCALE.max - CONFIG.WKG_SCALE.min), 0), 1);

    return { watts, weight, lthr, runFtp, fiveK, wkgNum, cat, percent };
};

export const parseZoneTables = (planMd) => {
    const section = Parser.getSection(planMd, "Training Parameters") || Parser.getSection(planMd, "Zones");
    let current = '', categories = {};
    
    if (!section) return { cycling: `<p class="text-slate-500">No data</p>`, running: '' };
    
    section.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('###')) {
            current = trimmed.replace(/###/g, '').split('(')[0].trim();
            categories[current] = [];
        } else if (current && trimmed.includes(':')) {
            const [labelRaw, range] = trimmed.replace(/[\*\-\+]/g, '').split(':');
            const label = labelRaw.trim();
            
            let zClass = 'z-1';
            const cleanLabel = label.toLowerCase();
            if (cleanLabel.includes('sweet spot') || cleanLabel.includes('sweetspot')) zClass = 'z-ss';
            else {
                const zMatch = cleanLabel.match(/zone (\d)/);
                if (zMatch) zClass = `z-${zMatch[1]}`;
            }

            categories[current].push(`
                <div class="zone-row ${zClass}">
                    <span class="font-bold">${label}</span>
                    <span class="font-mono text-slate-400">${range ? range.trim() : '--'}</span>
                </div>
            `);
        }
    });
    
    let cyclingHtml = '';
    let runningHtml = '';

    Object.keys(categories).forEach(k => {
        const cardHtml = `
            <div class="zone-card">
                <div class="zone-card-title">${k}</div>
                ${categories[k].join('')}
            </div>
        `;
        
        const lowerKey = k.toLowerCase();
        if (lowerKey.includes('cycling') || (lowerKey.includes('power') && !lowerKey.includes('running'))) {
            cyclingHtml += cardHtml;
        } else {
            runningHtml += cardHtml;
        }
    });

    return { cycling: cyclingHtml, running: runningHtml };
};

export const fetchPacingData = async () => {
    try {
        const response = await fetch('garmind_data/garmin_records.md');
        if (!response.ok) return [];
        const text = await response.text();
        const records = [];
        
        text.split('\n').forEach(line => {
            if (line.trim().startsWith('|') && !line.includes('---')) {
                const cols = line.split('|').map(c => c.trim());
                if (cols.length > 3 && cols[1] === 'Running') {
                    records.push({ label: cols[2], value: cols[3] });
                }
            }
        });
        return records;
    } catch (e) {
        console.error("Error parsing records:", e);
        return [];
    }
};
