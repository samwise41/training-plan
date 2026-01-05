/**
 * roadmap.js
 * Generates the Roadmap tab content, including the Projected Volume Graph.
 */

export function renderRoadmap() {
    // --- 1. CONFIGURATION & DATA GENERATION ---

    // Start Date: Set to Dec 27, 2025 (matching your reference image)
    // You can change this string to adjust when Week 1 begins.
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

    // --- 2. CALCULATE VOLUME PROGRESSION ---
    // Logic based on projected growth (linear progression + deloads)

    // BLOCK 1: BASE (Start at 6h)
    let w1 = 6.0;
    let w2 = w1 * 1.05;      // +5%
    let w3 = w2 * 1.05;      // +5%
    let w4 = w3 * 0.60;      // Deload (60% of previous week)
    
    addWeek(1, w1, block1_sat, 'normal', "Base/Prep");
    addWeek(2, w2, block1_sat, 'normal', "Base/Prep");
    addWeek(3, w3, block1_sat, 'normal', "Base/Prep");
    addWeek(4, w4, 1.5, 'deload', "Base/Prep");

    // BLOCK 2: BUILD (Step Up + Progression)
    let w5 = w3 + 0.5;       // Step Up: 0.5h more than W3
    let w6 = w5 * 1.05;
    let w7 = w6 * 1.05;
    let w8 = w7 * 0.60;      // Deload

    addWeek(5, w5, block2_sat, 'step', "Tri-Build");
    addWeek(6, w6, block2_sat, 'normal', "Tri-Build");
    addWeek(7, w7, block2_sat, 'normal', "Tri-Build");
    addWeek(8, w8, 1.5, 'deload', "Tri-Build");

    // BLOCK 3: PEAK (Step Up + Progression)
    let w9 = w7 + 0.5;       // Step Up: 0.5h more than W7
    let w10 = w9 * 1.05;
    let w11 = w10 * 1.05;
    let w12 = w11 * 0.60;    // Taper/Deload

    addWeek(9, w9, block3_sat, 'step', "Peak/Taper");
    addWeek(10, w10, block3_sat, 'normal', "Peak/Taper");
    addWeek(11, w11, block3_sat, 'normal', "Peak/Taper");
    addWeek(12, w12, 2.0, 'deload', "Peak/Taper");


    // --- 3. SVG GENERATION ---

    const width = 800;
    const height = 400; 
    const pad = { t: 40, b: 80, l: 60, r: 20 };
    const maxVol = 12; // Y-Axis Ceiling

    // Scaling Functions
    const getX = (i) => pad.l + (i * ((width - pad.l - pad.r) / 11));
    const getY = (v) => height - pad.b - ((v / maxVol) * (height - pad.t - pad.b));

    // A. Draw Y-Axis (Grid lines & Labels)
    let yAxisHtml = '';
    for (let i = 0; i <= maxVol; i += 2) {
        const y = getY(i);
        yAxisHtml += `
            <line x1="${pad.l - 5}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="#334155" stroke-width="1" opacity="0.5" />
            <text x="${pad.l - 10}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="11" font-family="monospace">${i}h</text>
        `;
    }

    // B. Draw Bars (Volume)
    let barsHtml = weeks.map((d, i) => {
        const x = getX(i);
        const y = getY(d.vol);
        const h = (height - pad.b) - y;
        const barWidth = 35;
        
        let color = '#3b82f6'; // Default Blue
        let topLabel = '';

        // Conditional Styling
        if (d.type === 'deload') {
            color = '#ef4444'; // Red
            topLabel = `<text x="${x}" y="${y - 10}" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold">Deload</text>`;
        } else if (d.type === 'step') {
            topLabel = `<text x="${x}" y="${y - 10}" text-anchor="middle" fill="#22c55e" font-size="10" font-weight="bold">Step Up</text>`;
        }

        const valText = `<text x="${x}" y="${y + 15}" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${d.vol.toFixed(1)}</text>`;
        
        return `
            <g class="bar-group">
                <rect x="${x - barWidth/2}" y="${y}" width="${barWidth}" height="${h}" fill="${color}" rx="4" opacity="0.9"></rect>
                ${valText}
                ${topLabel}
                <text x="${x}" y="${height - pad.b + 20}" text-anchor="middle" fill="#cbd5e1" font-size="11" font-weight="bold">${d.dateStr}</text>
                <text x="${x}" y="${height - pad.b + 35}" text-anchor="middle" fill="#64748b" font-size="9">W${d.w}</text>
            </g>
        `;
    }).join('');

    // C. Draw Line (Saturday Ride)
    const linePathData = weeks.map((d, i) => `${getX(i)} ${getY(d.sat)}`).join(" L ");
    const linePath = `M ${linePathData}`;
    
    let dotsHtml = weeks.map((d, i) => {
        return `<circle cx="${getX(i)}" cy="${getY(d.sat)}" r="4" fill="#1e293b" stroke="#f59e0b" stroke-width="2">
            <title>Sat Ride: ${d.sat} hrs</title>
        </circle>`;
    }).join('');

    // --- 4. RETURN FINAL HTML ---
    return `
        <div class="space-y-6">
            <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6 shadow-lg">
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
                    
                    <path d="${linePath}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    ${dotsHtml}
                    
                    <text x="${getX(1.5)}" y="${height-15}" text-anchor="middle" fill="#64748b" font-size="12" font-weight="bold" letter-spacing="0.05em">BLOCK 1 (BASE)</text>
                    <text x="${getX(5.5)}" y="${height-15}" text-anchor="middle" fill="#64748b" font-size="12" font-weight="bold" letter-spacing="0.05em">BLOCK 2 (BUILD)</text>
                    <text x="${getX(9.5)}" y="${height-15}" text-anchor="middle" fill="#64748b" font-size="12" font-weight="bold" letter-spacing="0.05em">BLOCK 3 (PEAK)</text>
                </svg>
            </div>
            
            <div class="text-slate-400 text-sm italic text-center mt-4">
                * Volume projections based on progressive overload model (+5% weekly growth) with strategic deload weeks.
            </div>
        </div>
    `;
}
