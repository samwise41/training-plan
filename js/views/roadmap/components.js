// js/views/roadmap/components.js

export const renderVolumeGraph = (weeks) => {
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

export const renderPhaseList = (phases) => {
    if (!phases || phases.length === 0) return '';

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
