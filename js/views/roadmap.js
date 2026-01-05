import { Parser } from '../parser.js';

// ==========================================
// 1. PROJECTED VOLUME GRAPH LOGIC
// ==========================================
const buildVolumeGraph = () => {
    // 1. Setup Dates (Matches your reference image)
    const startDate = new Date("2025-12-27T12:00:00"); 

    const weeks = [];
    const block1_sat = 2.0;
    const block2_sat = 2.5;
    const block3_sat = 3.0;

    // Helper: Add a week to the data array
    const addWeek = (wNum, vol, sat, type, phase) => {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + (wNum - 1) * 7);
        const dateStr = `${current.getMonth() + 1}/${current.getDate()}`;
        weeks.push({ w: wNum, vol, sat, type, phase, dateStr });
    };

    // --- Calculate Volume Progression ---
    
    // BLOCK 1: BASE
    let w1 = 6.0;
    let w2 = w1 * 1.05;
    let w3 = w2 * 1.05;
    let w4 = w3 * 0.60;
    addWeek(1, w1, block1_sat, 'normal', "Base");
    addWeek(2, w2, block1_sat, 'normal', "Base");
    addWeek(3, w3, block1_sat, 'normal', "Base");
    addWeek(4, w4, 1.5, 'deload', "Base");

    // BLOCK 2: BUILD
    let w5 = w3 + 0.5;
    let w6 = w5 * 1.05;
    let w7 = w6 * 1.05;
    let w8 = w7 * 0.60;
    addWeek(5, w5, block2_sat, 'step', "Build");
    addWeek(6, w6, block2_sat, 'normal', "Build");
    addWeek(7, w7, block2_sat, 'normal', "Build");
    addWeek(8, w8, 1.5, 'deload', "Build");

    // BLOCK 3: PEAK
    let w9 = w7 + 0.5;
    let w10 = w9 * 1.05;
    let w11 = w10 * 1.05;
    let w12 = w11 * 0.60;
    addWeek(9, w9, block3_sat, 'step', "Peak");
    addWeek(10, w10, block3_sat, 'normal', "Peak");
    addWeek(11, w11, block3_sat, 'normal', "Peak");
    addWeek(12, w12, 2.0, 'deload', "Peak");

    // --- SVG Construction ---
    const width = 800;
    const height = 400; 
    const pad = { t: 40, b: 80, l: 60, r: 20 };
    const maxVol = 12; 

    const getX = (i) => pad.l + (i * ((width - pad.l - pad.r) / 11));
    const getY = (v) => height - pad.b - ((v / maxVol) * (height - pad.t - pad.b));

    // Y-Axis
    let yAxisHtml = '';
    for (let i = 0; i <= maxVol; i += 2) {
        const y = getY(i);
        yAxisHtml += `
            <line x1="${pad.l - 5}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="#334155" stroke-width="1" opacity="0.5" />
            <text x="${pad.l - 10}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="11" font-family="monospace">${i}h</text>
        `;
    }

    // Bars
    let barsHtml = weeks.map((d, i) => {
        const x = getX(i);
        const y = getY(d.vol);
        const h = (height - pad.b) - y;
        const barWidth = 35;
        
        let color = '#3b82f6';
        let topLabel = '';

        if (d.type === 'deload') {
            color = '#ef4444';
            topLabel = `<text x="${x}" y="${y - 10}" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold">Deload</text>`;
        } else if (d.type === 'step') {
            topLabel = `<text x="${x}" y="${y - 10}" text-anchor="middle" fill="#22c55e" font-size="10" font-weight="bold">Step Up</text>`;
        }

        return `
            <g class="bar-group">
                <rect x="${x - 17}" y="${y}" width="35" height="${h}" fill="${color}" rx="4" opacity="0.9"></rect>
                <text x="${x}" y="${y + 15}" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${d.vol.toFixed(1)}</text>
                ${topLabel}
                <text x="${x}" y="${height - pad.b + 20}" text-anchor="middle" fill="#cbd5e1" font-size="11" font-weight="bold">${d.dateStr}</text>
                <text x="${x}" y="${height - pad.b + 35}" text-anchor="middle" fill="#64748b" font-size="9">W${d.w}</text>
            </g>
        `;
    }).join('');

    // Line Path
    const linePathData = weeks.map((d, i) => `${getX(i)} ${getY(d.sat)}`).join(" L ");
    let dotsHtml = weeks.map((d, i) => {
        return `<circle cx="${getX(i)}" cy="${getY(d.sat)}" r="4" fill="#1e293b" stroke="#f59e0b" stroke-width="2">
            <title>Sat Ride: ${d.sat} hrs</title>
        </circle>`;
    }).join('');

    return `
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 shadow-lg mb-10 select-none">
             <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                    Projected Volume (Hours/Week)
                </h2>
                <div class="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-blue-500"></span> Total Vol</span>
                    <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full border-2 border-orange-500 bg-slate-800"></span> Sat Ride</span>
                </div>
            </div>

            <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible font-sans">
                ${yAxisHtml}
                ${barsHtml}
                <path d="M ${linePathData}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                ${dotsHtml}
                
                <text x="${getX(1.5)}" y="${height-15}" text-anchor="middle" fill="#64748b" font-size="12" font-weight="bold" letter-spacing="0.05em">BLOCK 1 (BASE)</text>
                <text x="${getX(5.5)}" y="${height-15}" text-anchor="middle" fill="#64748b" font-size="12" font-weight="bold" letter-spacing="0.05em">BLOCK 2 (BUILD)</text>
                <text x="${getX(9.5)}" y="${height-15}" text-anchor="middle" fill="#64748b" font-size="12" font-weight="bold" letter-spacing="0.05em">BLOCK 3 (PEAK)</text>
            </svg>
        </div>
    `;
};

// ==========================================
// 2. PHASE CHART (Mobile Optimized)
// ==========================================
const buildPhaseChart = (planMd) => {
    const phasesSection = Parser.getSection(planMd, "Periodization Phases");
    if (!phasesSection) return '';

    const lines = phasesSection.split('\n').filter(l => l.trim().startsWith('|') && !l.includes('---') && !l.toLowerCase().includes('phase'));
    
    // Parse data
    const phases = lines.map(line => {
        const cols = line.split('|').map(c => c.trim()).filter(c => c);
        if (cols.length < 4) return null;
        return { 
            name: cols[0], 
            focus: cols[1], 
            dates: cols[2], 
            weeks: cols[3] 
        };
    }).filter(p => p);

    let html = `<div class="grid grid-cols-1 gap-4 mb-8">`;
    
    phases.forEach((p, index) => {
        const isCurrent = p.dates.includes("Jan") || (p.dates.includes("Feb") && index < 2); 
        
        let barColor = "bg-slate-700";
        let icon = "fa-layer-group";
        
        if (p.name.includes("Base")) { barColor = "bg-blue-600"; icon = "fa-cubes"; }
        if (p.name.includes("Build")) { barColor = "bg-emerald-600"; icon = "fa-chart-line"; }
        if (p.name.includes("Peak") || p.name.includes("Race")) { barColor = "bg-purple-600"; icon = "fa-flag-checkered"; }
        if (p.name.includes("Recovery")) { barColor = "bg-slate-500"; icon = "fa-bed"; }

        const activeClass = isCurrent ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900" : "opacity-75";

        // Stacked Layout for Mobile, Row for Desktop
        html += `
            <div class="relative flex flex-col sm:flex-row items-start sm:items-center bg-slate-800 rounded-lg p-4 border border-slate-700 ${activeClass} gap-4">
                
                <div class="w-12 h-12 rounded-lg ${barColor} flex items-center justify-center text-white text-xl shadow-lg shrink-0">
                    <i class="fa-solid ${icon}"></i>
                </div>
                
                <div class="flex-1 w-full min-w-0">
                    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                        <h3 class="text-white font-bold text-lg leading-tight">${p.name}</h3>
                        <span class="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-700 w-fit whitespace-nowrap">
                            ${p.weeks}
                        </span>
                    </div>
                    
                    <div class="space-y-2">
                        <div class="inline-block bg-slate-700/50 px-2 py-1 rounded border border-slate-600 text-xs sm:text-sm text-slate-300">
                             ${p.focus}
                        </div>
                        <div class="text-xs text-slate-500 font-mono block">
                            ${p.dates}
                        </div>
                    </div>
                </div>

                ${isCurrent ? '<div class="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-900 animate-pulse"></div>' : ''}
            </div>
        `;
    });

    html += `</div>`;
    return html;
};

// ==========================================
// 3. MAIN EXPORT
// ==========================================
export function renderRoadmap(planMd) {
    if (!planMd) return '<div class="p-8 text-center text-slate-500">No plan loaded.</div>';

    // 1. Generate Graph
    const volumeGraphHtml = buildVolumeGraph();

    // 2. Generate Phases (Mobile Fixed)
    const phasesHtml = buildPhaseChart(planMd);
    
    // 3. Parse Full Plan using MARKED (Native Tool)
    // We check for window.marked just like app.js does
    const safeMarked = window.marked ? window.marked.parse : (t) => t;
    const fullPlanHtml = safeMarked(planMd);

    return `
        <div class="max-w-4xl mx-auto space-y-10">
            
            <div>
                ${volumeGraphHtml}
            </div>

            <div>
                <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <i class="fa-solid fa-timeline text-blue-500"></i> Season Roadmap
                </h2>
                ${phasesHtml}
            </div>

            <div class="border-t border-slate-700"></div>
            
            <div>
                <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <i class="fa-solid fa-file-contract text-emerald-500"></i> Master Training Plan
                </h2>
                <div class="bg-slate-800/30 p-8 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                    <div class="markdown-body">
                        ${fullPlanHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
}
