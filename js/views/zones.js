import { Parser } from '../parser.js';

const CONFIG = {
    WKG_SCALE: { min: 1.0, max: 6.0 },
    CATEGORIES: [
        { threshold: 5.05, label: "Exceptional", color: "#a855f7" },
        { threshold: 3.93, label: "Very Good",   color: "#3b82f6" },
        { threshold: 2.79, label: "Good",        color: "#22c55e" },
        { threshold: 2.23, label: "Fair",        color: "#f97316" },
        { threshold: 0.00, label: "Untrained",   color: "#ef4444" }
    ]
};

/**
 * Generates the HTML for the Zones tab.
 * @param {string} planMd - Raw Markdown content from the plan file
 * @returns {string} HTML string
 */
export function renderZones(planMd) {
    // 1. Calculate Biometrics (Safe destructuring in case parser is old)
    const bio = Parser.getBiometrics(planMd) || {};
    const watts = bio.watts || 0;
    const weight = bio.weight || 0;
    const lthr = bio.lthr || '--';
    const runFtp = bio.runFtp || '--';
    const fiveK = bio.fiveK || '--';

    const weightKg = weight * 0.453592;
    const wkgNum = weightKg > 0 ? (watts / weightKg) : 0;
    
    // 2. Determine Category
    const cat = CONFIG.CATEGORIES.find(c => wkgNum >= c.threshold) || CONFIG.CATEGORIES[CONFIG.CATEGORIES.length - 1];
    const percent = Math.min(Math.max((wkgNum - CONFIG.WKG_SCALE.min) / (CONFIG.WKG_SCALE.max - CONFIG.WKG_SCALE.min), 0), 1);

    // 3. Parse Zones
    const parseZoneTables = () => {
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
                
                // --- ROBUST LOGIC START ---
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

    // 4. Final HTML
    return `
        <div class="gauge-wrapper">
            <svg viewBox="0 0 300 185" class="gauge-svg">
                <path d="M 30 150 A 120 120 0 0 1 64.1 66.2" fill="none" stroke="#ef4444" stroke-width="24" />
                <path d="M 64.1 66.2 A 120 120 0 0 1 98.3 41.8" fill="none" stroke="#f97316" stroke-width="24" />
                <path d="M 98.3 41.8 A 120 120 0 0 1 182.0 34.4" fill="none" stroke="#22c55e" stroke-width="24" />
                <path d="M 182.0 34.4 A 120 120 0 0 1 249.2 82.6" fill="none" stroke="#3b82f6" stroke-width="24" />
                <path d="M 249.2 82.6 A 120 120 0 0 1 270 150" fill="none" stroke="#a855f7" stroke-width="24" />
                <text x="150" y="135" text-anchor="middle" class="text-4xl font-black fill-white">${wkgNum.toFixed(2)}</text>
                <text x="150" y="160" text-anchor="middle" font-weight="800" fill="${cat.color}">${cat.label.toUpperCase()}</text>
                <g class="gauge-needle" style="transform: rotate(${-90 + (percent * 180)}deg)">
                    <path d="M 147 150 L 150 45 L 153 150 Z" fill="white" />
                    <circle cx="150" cy="150" r="6" fill="white" />
                </g>
            </svg>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto">
            <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl text-center shadow-lg">
                <div class="flex items-center justify-center gap-2 mb-2">
                    <i class="fa-solid fa-bicycle text-blue-500"></i>
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cycling FTP</span>
                </div>
                <div class="flex flex-col">
                    <span class="text-3xl font-black text-white">${watts > 0 ? watts + ' W' : '--'}</span>
                    <span class="text-xs text-slate-400 font-mono mt-1">${wkgNum.toFixed(2)} W/kg</span>
                </div>
            </div>

            <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl text-center shadow-lg">
                <div class="flex items-center justify-center gap-2 mb-3">
                    <i class="fa-solid fa-person-running text-emerald-500"></i>
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Running Profile</span>
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <div class="flex flex-col">
                        <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Pace (FTP)</span>
                        <span class="text-lg font-bold text-white leading-none">${runFtp}</span>
                    </div>
                    <div class="flex flex-col border-l border-slate-700">
                        <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">LTHR</span>
                        <span class="text-lg font-bold text-white leading-none">${lthr}</span>
                    </div>
                    <div class="flex flex-col border-l border-slate-700">
                        <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">5K Est</span>
                        <span class="text-lg font-bold text-white leading-none">${fiveK}</span>
                    </div>
                </div>
            </div>
        </div>

        <div id="zone-grid">
            ${parseZoneTables()}
        </div>

        <div class="text-center mt-12 mb-4 h-20 flex items-center justify-center">
            <button onclick="this.parentElement.innerHTML='<span class=&quot;text-6xl font-black text-emerald-500 animate-bounce block&quot;>67</span>'" 
                    class="px-8 py-3 bg-slate-800 border border-slate-700 rounded-full text-slate-500 hover:text-white hover:border-emerald-500 hover:bg-slate-700 transition-all text-xs uppercase tracking-[0.2em] font-bold shadow-lg">
                PUSH ME
            </button>
        </div>
    `;
}
