import { Parser } from '../parser.js';

export function renderPhases(planMd) {
    // 1. Setup Dates
    // Week 1 ending (Saturday) based on plan: Dec 27, 2025 (Adjusted to current calendar flow)
    // We'll map Week 1 to the first week of Jan for this projection context
    const startDate = new Date("2026-01-03T12:00:00"); 

    // 2. Define Sport-Specific Growth Logic
    // Strategy: Run grows slowly (safety), Bike grows aggressively (volume lever)
    const weeks = [];
    
    // Baselines (Hours)
    let bSwim = 0.75; // ~45 mins
    let bRun = 1.5;   // ~1.5 hours (2x45m)
    let bBike = 4.0;  // ~4.0 hours (Sat 2h + Thu 1.5h + Mon 0.5h)

    // Helper to generate a block
    const generateBlock = (startWk, numWeeks, phaseName, satRideDuration, isDeloadBlock) => {
        for (let i = 0; i < numWeeks; i++) {
            const wNum = startWk + i;
            let type = 'normal';
            let currentSwim = bSwim;
            let currentRun = bRun;
            let currentBike = bBike;
            let sat = satRideDuration;

            // Apply Growth Rules
            if (i === 0 && startWk > 1) type = 'step'; // First week of new block
            
            // Deload Week (Last week of block)
            if (i === numWeeks - 1) {
                type = 'deload';
                currentSwim *= 0.7;
                currentRun *= 0.7;
                currentBike *= 0.6;
                sat *= 0.7;
            } else {
                // Normal Growth (Compound weekly)
                // Run: Conservative 2% growth (Safety)
                // Bike: Aggressive 5% growth + Base Step Ups
                const growthFactorRun = 1 + (0.02 * i);
                const growthFactorBike = 1 + (0.05 * i);
                
                currentRun *= growthFactorRun;
                currentBike *= growthFactorBike;
            }

            // Calculate Date
            const current = new Date(startDate);
            current.setDate(startDate.getDate() + (wNum - 1) * 7);
            const dateStr = `${current.getMonth() + 1}/${current.getDate()}`;

            const total = currentSwim + currentRun + currentBike;

            weeks.push({ 
                w: wNum, 
                swim: currentSwim, 
                run: currentRun, 
                bike: currentBike, 
                total: total,
                sat: sat, 
                type, 
                phase: phaseName, 
                dateStr 
            });
        }
    };

    // --- GENERATE BLOCKS ---
    // Block 1: Base (Sat Ride 2.0h capped)
    generateBlock(1, 4, "Base/Prep", 2.0);

    // Block 2: Build (Sat Ride 2.5h - Step Up)
    // Increase Baselines for next block
    bRun *= 1.05; // 5% bump in base
    bBike += 0.5; // Add 30 mins to bike base (Step Up)
    generateBlock(5, 4, "Tri-Build", 2.5);

    // Block 3: Peak (Sat Ride 3.0h - Step Up)
    bRun *= 1.05;
    bBike += 0.5;
    generateBlock(9, 4, "Peak/Taper", 3.0);


    // 3. SVG Configuration
    const width = 800;
    const height = 450; // Taller for legend
    const pad = { t: 60, b: 80, l: 50, r: 20 };
    const maxVol = 14; // Y-Axis Max (Increased for higher volume)
    
    const getX = (i) => pad.l + (i * ((width - pad.l - pad.r) / 11));
    const getY = (v) => height - pad.b - ((v / maxVol) * (height - pad.t - pad.b));

    // 4. Generate Y-Axis
    let yAxisHtml = '';
    for (let i = 0; i <= maxVol; i += 2) {
        const y = getY(i);
        yAxisHtml += `
            <line x1="${pad.l - 5}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="#334155" stroke-width="1" opacity="0.3" />
            <text x="${pad.l - 10}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="11" font-family="monospace">${i}h</text>
        `;
    }

    // 5. Generate Stacked Bars
    let barsHtml = weeks.map((d, i) => {
        const x = getX(i);
        const barWidth = 35;
        
        // Stack Calculations
        const yTotal = getY(d.total);
        const hTotal = (height - pad.b) - yTotal;

        const hSwim = (d.swim / d.total) * hTotal;
        const hRun = (d.run / d.total) * hTotal;
        const hBike = (d.bike / d.total) * hTotal;

        const ySwim = (height - pad.b) - hSwim;
        const yRun = ySwim - hRun;
        const yBike = yRun - hBike; // Topmost

        // Colors
        const cSwim = '#06b6d4'; // Cyan-500
        const cRun = '#10b981';  // Emerald-500
        const cBike = '#3b82f6'; // Blue-500
        const opacity = d.type === 'deload' ? '0.5' : '0.9';

        // Labels
        let topLabel = '';
        if (d.type === 'step') topLabel = `<text x="${x}" y="${yBike - 10}" text-anchor="middle" fill="#22c55e" font-size="10" font-weight="bold">Step Up</text>`;
        if (d.type === 'deload') topLabel = `<text x="${x}" y="${yBike - 10}" text-anchor="middle" fill="#ef4444" font-size="10" font-weight="bold">Deload</text>`;
        
        // Total Text
        const totalText = `<text x="${x}" y="${yBike - 25}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${d.total.toFixed(1)}h</text>`;

        return `
            <rect x="${x - barWidth/2}" y="${ySwim}" width="${barWidth}" height="${hSwim}" fill="${cSwim}" opacity="${opacity}" />
            <rect x="${x - barWidth/2}" y="${yRun}" width="${barWidth}" height="${hRun}" fill="${cRun}" opacity="${opacity}" />
            <rect x="${x - barWidth/2}" y="${yBike}" width="${barWidth}" height="${hBike}" fill="${cBike}" opacity="${opacity}" />
            
            ${topLabel}
            ${d.type !== 'deload' && d.type !== 'step' ? totalText : ''}
            
            <text x="${x}" y="${height - pad.b + 20}" text-anchor="middle" fill="#cbd5e1" font-size="11" font-weight="bold">${d.dateStr}</text>
            <text x="${x}" y="${height - pad.b + 35}" text-anchor="middle" fill="#64748b" font-size="9">W${d.w}</text>
        `;
    }).join('');

    // 6. Saturday Ride Line (Overlay)
    let linePath = "M " + weeks.map((d, i) => `${getX(i)} ${getY(d.sat)}`).join(" L ");
    let dotsHtml = weeks.map((d, i) => {
        return `<circle cx="${getX(i)}" cy="${getY(d.sat)}" r="4" fill="#1e293b" stroke="#f59e0b" stroke-width="2">
            <title>Sat Ride: ${d.sat} hrs</title>
        </circle>`;
    }).join('');

    // 7. Render
    const safeMarked = window.marked ? window.marked.parse : (t) => t;
    const mdContent = Parser.getSection(planMd, "Periodization Phases") || Parser.getSection(planMd, "Periodization");

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-8">
             <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
                <div>
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-layer-group text-blue-500"></i> Projected Volume (Sport Specific)
                    </h2>
                    <p class="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">
                        Visualizing the 15% Cap Strategy: Safe Run Growth vs. Aggressive Bike Build
                    </p>
                </div>
                
                <div class="flex flex-col items-end gap-1 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-blue-500"></span> Bike</span>
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-emerald-500"></span> Run</span>
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-cyan-500"></span> Swim</span>
                    <span class="flex items-center gap-1 mt-1"><span class="w-2 h-2 rounded-full border-2 border-orange-500 bg-slate-800"></span> Sat Long Ride</span>
                </div>
            </div>

            <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">
                ${yAxisHtml}

                ${barsHtml}

                <path d="${linePath}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                ${dotsHtml}
                
                <text x="${getX(1.5)}" y="${height-15}" text-anchor="middle" fill="#94a3b8" font-size="12" font-weight="bold" letter-spacing="0.05em">BLOCK 1 (BASE)</text>
                <text x="${getX(5.5)}" y="${height-15}" text-anchor="middle" fill="#94a3b8" font-size="12" font-weight="bold" letter-spacing="0.05em">BLOCK 2 (BUILD)</text>
                <text x="${getX(9.5)}" y="${height-15}" text-anchor="middle" fill="#94a3b8" font-size="12" font-weight="bold" letter-spacing="0.05em">BLOCK 3 (PEAK)</text>
            </svg>
        </div>

        <div class="markdown-body">
            ${safeMarked(mdContent || "")}
        </div>
    `;
}
