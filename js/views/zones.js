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
    // 1. Calculate Biometrics (Watts/Kg)
    const { watts, weight } = Parser.getBiometrics(planMd);
    const weightKg = weight * 0.453592;
    const wkgNum = weightKg > 0 ? (watts / weightKg) : 0;
    
    // 2. Determine Category and Gauge Position
    const cat = CONFIG.CATEGORIES.find(c => wkgNum >= c.threshold) || CONFIG.CATEGORIES[CONFIG.CATEGORIES.length - 1];
    const percent = Math.min(Math.max((wkgNum - CONFIG.WKG_SCALE.min) / (CONFIG.WKG_SCALE.max - CONFIG.WKG_SCALE.min), 0), 1);

    // 3. Helper to Parse Zone Tables from Markdown
    const parseZoneTables = () => {
        const section = Parser.getSection(planMd, "Training Parameters") || Parser.getSection(planMd, "Zones");
        let current = '', html = '', categories = {};
        
        if (!section) return `<p class="text-slate-500 text-center col-span-2">No zone data found.</p>`;
        
        section.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('###')) {
                // New Category (e.g. "Cycling Power Zones")
                current = trimmed.replace(/###/g, '').split('(')[0].trim();
                categories[current] = [];
            } else if (current && trimmed.includes(':')) {
                // Zone Row (e.g. "Zone 1: < 133W")
                const [label, range] = trimmed.replace(/[\*\-\+]/g, '').split(':');
                const zMatch = label.toLowerCase().match(/zone (\d)/);
                const zNum = zMatch ? zMatch[1] : '1';
                categories[current].push(`
                    <div class="zone-row z-${zNum}">
                        <span class="font-bold">${label.trim()}</span>
                        <span class="font-mono text-slate-400">${range ? range.trim() : '--'}</span>
                    </div>
                `);
            }
        });
        
        const keys = Object.keys(categories);
        keys.forEach(k => {
            html += `
                <div class="zone-card">
                    <div class="zone-card-title">${k}</div>
                    ${categories[k].join('')}
                </div>
            `;
        });
        return html;
    };

    // 4. Assemble Final HTML
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
        
        <div class="text-center mb-8">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Cycling FTP</span>
            <span class="text-2xl font-bold text-white">${watts > 0 ? watts + ' W' : '--'}</span>
        </div>
        
        <div id="zone-grid">
            ${parseZoneTables()}
        </div>
    `;
}
