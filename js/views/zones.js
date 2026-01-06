import { Parser } from '../parser.js';

export function renderZones(planMd) {
    const paramsSection = Parser.getSection(planMd, "Training Parameters");
    if (!paramsSection) return '<div class="text-slate-500 italic">No Training Parameters found.</div>';

    // Parse FTP and LTHR from the text
    const ftpMatch = paramsSection.match(/Cycling FTP:\*\* (\d+) Watts/);
    const lthrMatch = paramsSection.match(/Lactate Threshold HR \(LTHR\):\*\* (\d+) bpm/);
    
    const ftp = ftpMatch ? parseInt(ftpMatch[1]) : 0;
    const lthr = lthrMatch ? parseInt(lthrMatch[1]) : 0;

    // Helper to extract zones from the text based on header
    const extractZones = (headerText) => {
        const lines = paramsSection.split('\n');
        const zones = [];
        let capturing = false;

        lines.forEach(line => {
            if (line.includes(headerText)) {
                capturing = true;
            } else if (capturing && line.startsWith('###')) {
                capturing = false;
            } else if (capturing && line.trim().startsWith('*')) {
                // Parse line: * **Zone 1 (Recovery):** < 133W
                const parts = line.split(':');
                if (parts.length > 1) {
                    const namePart = parts[0].replace(/\*+/g, '').trim(); // "Zone 1 (Recovery)"
                    const rangePart = parts[1].trim(); // "< 133W"
                    zones.push({ name: namePart, range: rangePart });
                }
            }
        });
        return zones;
    };

    const bikeZones = extractZones("Cycling Power Zones");
    const runZones = extractZones("Running Heart Rate Zones");

    // Helper to determine zone intensity color (Standardized Intensity Colors)
    const getZoneColor = (name) => {
        const n = name.toLowerCase();
        if (n.includes('zone 1') || n.includes('recovery')) return 'bg-slate-500';
        if (n.includes('zone 2') || n.includes('endurance')) return 'bg-blue-500'; // Z2 is standard Blue
        if (n.includes('zone 3') || n.includes('tempo')) return 'bg-emerald-500'; // Z3 is Green (Tempo)
        if (n.includes('sweet spot')) return 'bg-yellow-500';
        if (n.includes('zone 4') || n.includes('threshold')) return 'bg-orange-500';
        if (n.includes('zone 5') || n.includes('vo2')) return 'bg-red-500';
        return 'bg-purple-500'; // Anaerobic/Neuromuscular
    };

    const buildZoneCard = (title, iconClass, colorClass, zones, metricLabel) => {
        let rows = '';
        zones.forEach(z => {
            const zColor = getZoneColor(z.name);
            rows += `
                <div class="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-3 h-3 rounded-full ${zColor}"></div>
                        <span class="text-sm font-bold text-slate-200">${z.name}</span>
                    </div>
                    <span class="text-sm font-mono text-white font-bold bg-slate-700 px-2 py-1 rounded">${z.range}</span>
                </div>
            `;
        });

        // Dynamic Border color based on the Sport Identity Color passed in
        const borderColor = colorClass.replace('text-', 'border-');

        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 relative overflow-hidden border-t-4 ${borderColor}">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h3 class="text-lg font-bold text-white flex items-center gap-2">
                            <i class="${iconClass}"></i> ${title}
                        </h3>
                        <p class="text-xs text-slate-400 mt-1 font-mono">${metricLabel}</p>
                    </div>
                </div>
                <div class="space-y-2">
                    ${rows}
                </div>
            </div>
        `;
    };

    // --- UPDATED COLORS ---
    // Bike: Purple (#a855f7 / text-purple-500)
    // Run: Fuchsia (#d946ef / text-fuchsia-500)
    
    const bikeHtml = buildZoneCard(
        "Cycling Power Zones", 
        "fa-solid fa-bicycle text-purple-500", // New Icon Color
        "text-purple-500",                     // New Border Color Base
        bikeZones, 
        `Based on FTP: ${ftp} W`
    );

    const runHtml = buildZoneCard(
        "Running Heart Rate Zones", 
        "fa-solid fa-person-running text-fuchsia-500", // New Icon Color
        "text-fuchsia-500",                            // New Border Color Base
        runZones, 
        `Based on LTHR: ${lthr} bpm`
    );

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            ${bikeHtml}
            ${runHtml}
        </div>
        
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 class="text-lg font-bold text-white mb-4"><i class="fa-solid fa-layer-group text-slate-400"></i> Methodology</h3>
            <div class="text-sm text-slate-300 space-y-4 leading-relaxed font-sans">
                <p>This plan follows an <strong>80/20 Periodization</strong> structure:</p>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li><strong class="text-blue-400">80% Low Intensity (Zone 2):</strong> Builds mitochondrial density, fatigue resistance, and aerobic base.</li>
                    <li><strong class="text-red-400">20% High Intensity (Zone 4/5):</strong> Raises the performance ceiling (VO2 Max) and lactate threshold.</li>
                </ul>
                <p>Zones are recalculated every 4 weeks following scheduled field tests (Alpe du Zwift or 30-min Time Trial).</p>
            </div>
        </div>
    `;
}
