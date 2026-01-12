// js/views/zones/logic.js
import { Parser } from '../../parser.js';
import { CONFIG } from './config.js';

export const getBiometricsData = (planMd) => {
    // Exact logic from original file
    const bio = Parser.getBiometrics(planMd) || {};
    const watts = bio.watts || 0;
    const weight = bio.weight || 0;
    const lthr = bio.lthr || '--';
    const runFtp = bio.runFtp || '--';
    const fiveK = bio.fiveK || '--';

    const weightKg = weight * 0.453592;
    const wkgNum = weightKg > 0 ? (watts / weightKg) : 0;
    
    // Determine W/kg Category
    let category = CONFIG.CATEGORIES[CONFIG.CATEGORIES.length - 1]; 
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

export const parseZoneTables = (planMd) => {
    // This calls the Parser exactly as the original file did
    const zoneSection = Parser.getSection(planMd, "Training Zones");
    if (!zoneSection) return '<div class="text-slate-500 italic p-4">No zone data found in plan.</div>';
    
    const lines = zoneSection.split('\n');
    let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
    
    lines.forEach(line => {
        if (line.trim().startsWith('|') && !line.includes('---') && !line.toLowerCase().includes('zone')) {
            const cols = line.split('|').map(c => c.trim()).filter(c => c);
            if (cols.length >= 4) {
                const name = cols[0];
                const desc = cols[1];
                const hr = cols[2];
                const power = cols[3];

                let colorClass = "bg-slate-700";
                if (name.includes("1")) colorClass = "bg-slate-500";
                if (name.includes("2")) colorClass = "bg-blue-500";
                if (name.includes("3")) colorClass = "bg-green-500";
                if (name.includes("4")) colorClass = "bg-yellow-500";
                if (name.includes("5")) colorClass = "bg-red-500";
                if (name.includes("6") || name.includes("7")) colorClass = "bg-purple-500";

                html += `
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-500 transition-colors">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-bold text-white px-2 py-1 rounded ${colorClass}">${name}</span>
                            <span class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">${desc}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mt-3">
                            <div>
                                <span class="text-[9px] text-slate-500 uppercase block mb-0.5">Heart Rate</span>
                                <span class="text-sm font-mono font-bold text-white">${hr}</span>
                            </div>
                            <div>
                                <span class="text-[9px] text-slate-500 uppercase block mb-0.5">Power (W)</span>
                                <span class="text-sm font-mono font-bold text-white">${power}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    });
    
    html += `</div>`;
    return html;
};
