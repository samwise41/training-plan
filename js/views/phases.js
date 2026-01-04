import { Parser } from '../parser.js';

export function renderPhases(planMd) {
    // 1. Calculate the Data Points (Logic matches our discussion)
    const weeks = [];
    const block1_sat = 2.0;
    const block2_sat = 2.5;
    const block3_sat = 3.0;

    // Block 1 (Base) - Weeks 1-4
    let w1 = 6.0;
    let w2 = w1 * 1.05;
    let w3 = w2 * 1.05;
    let w4 = w3 * 0.60;
    weeks.push({ w: 1, vol: w1, sat: block1_sat, phase: "Base/Prep" });
    weeks.push({ w: 2, vol: w2, sat: block1_sat, phase: "Base/Prep" });
    weeks.push({ w: 3, vol: w3, sat: block1_sat, phase: "Base/Prep" });
    weeks.push({ w: 4, vol: w4, sat: 1.5, type: 'deload', phase: "Base/Prep" });

    // Block 2 (Build) - Weeks 5-8
    let w5 = w3 + 0.5; // Step Up
    let w6 = w5 * 1.05;
    let w7 = w6 * 1.05;
    let w8 = w7 * 0.60;
    weeks.push({ w: 5, vol: w5, sat: block2_sat, type: 'step', phase: "Tri-Build" });
    weeks.push({ w: 6, vol: w6, sat: block2_sat, phase: "Tri-Build" });
    weeks.push({ w: 7, vol: w7, sat: block2_sat, phase: "Tri-Build" });
    weeks.push({ w: 8, vol: w8, sat: 1.5, type: 'deload', phase: "Tri-Build" });

    // Block 3 (Peak) - Weeks 9-12
    let w9 = w7 + 0.5; // Step Up
    let w10 = w9 * 1.05;
    let w11 = w10 * 1.05;
    let w12 = w11 * 0.60;
    weeks.push({ w: 9, vol: w9, sat: block3_sat, type: 'step', phase: "Peak/Taper" });
    weeks.push({ w: 10, vol: w10, sat: block3_sat, phase: "Peak/Taper" });
    weeks.push({ w: 11, vol: w11, sat: block3_sat, phase: "Peak/Taper" });
    weeks.push({ w: 12, vol: w12, sat: 2.0, type: 'deload', phase: "Peak/Taper" });

    // 2. Build SVG
    const width = 800;
    const height = 350;
    const pad = { t: 40, b: 60, l: 50, r: 30 };
    const maxVol = 12; // Y-Axis Max
    
    const getX = (i) => pad.l + (i * ((width - pad.l - pad.r) / 11));
    const getY = (v) => height - pad.b - ((v / maxVol) * (height - pad.t - pad.b));

    // Generate Bars
    let barsHtml = weeks.map((d, i) => {
        const x = getX(i);
        const y = getY(d.vol);
        const h = (height - pad.b) - y;
        const barWidth = 30;
        let color = '#3b82f6'; // Blue
        let label = '';
        
        if (d.type === 'deload') { color = '#ef4444'; label = 'Deload'; } // Red
        if (d.type === 'step') { label = 'Step Up'; }

        // Label above bar
        let textHtml = '';
        if (label) {
            textHtml = `<text x="${x}" y="${y - 10}" text-anchor="middle" fill="${color}" font-size="10" font-weight="bold">${label}</text>`;
        }

        return `
            <rect x="${x - barWidth/2}" y="${y}" width="${barWidth}" height="${h}" fill="${color}" rx="4" opacity="0.8">
                <title>Week ${d.w}: ${d.vol.toFixed(1)} hrs</title>
            </rect>
            ${textHtml}
            <text x="${x}" y="${height - pad.b + 20}" text-anchor="middle" fill="#64748b" font-size="10">W${d.w}</text>
        `;
    }).join('');

    // Generate Line for Saturday Ride
    let linePath = "M " + weeks.map((d, i) => `${getX(i)} ${getY(d.sat)}`).join(" L ");
    let dotsHtml = weeks.map((d, i) => {
        return `<circle cx="${getX(i)}" cy="${getY(d.sat)}" r="4" fill="#1e293b" stroke="#f59e0b" stroke-width="2">
            <title>Sat Ride: ${d.sat} hrs</title>
        </circle>`;
    }).join('');

    // 3. Get Markdown Content
    const mdContent = Parser.getSection(planMd, "Periodization Phases") || Parser.getSection(planMd, "Periodization");

    // 4. Assemble HTML
    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-8">
            <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
                <h2 class="text-lg font-bold text-white flex items-center gap-2">
                    <i class="fa-solid fa-chart-area text-blue-500"></i> Projected Volume (Hours/Week)
                </h2>
                <div class="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-blue-500"></span> Total Vol</span>
                    <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full border-2 border-orange-500 bg-slate-800"></span> Sat Ride</span>
                </div>
            </div>
            
            <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">
                <line x1="${pad.l}" y1="${height-pad.b}" x2="${width-pad.r}" y2="${height-pad.b}" stroke="#334155" stroke-width="1" />
                <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height-pad.b}" stroke="#334155" stroke-width="1" />
                
                ${barsHtml}
                <path d="${linePath}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                ${dotsHtml}

                <text x="${getX(1.5)}" y="${height-15}" text-anchor="middle" fill="#94a3b8" font-size="12" font-weight="bold">BLOCK 1 (BASE)</text>
                <text x="${getX(5.5)}" y="${height-15}" text-anchor="middle" fill="#94a3b8" font-size="12" font-weight="bold">BLOCK 2 (BUILD)</text>
                <text x="${getX(9.5)}" y="${height-15}" text-anchor="middle" fill="#94a3b8" font-size="12" font-weight="bold">BLOCK 3 (PEAK)</text>
            </svg>
        </div>

        <div class="markdown-body">
            ${marked.parse(mdContent || "")}
        </div>
    `;
}
