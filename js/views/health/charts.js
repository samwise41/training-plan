// js/views/health/charts.js

// Config for lines: { key: 'rhr', color: 'blue', label: 'Resting HR' }
export const renderMultiLineChart = (data, containerId, title, linesConfig) => {
    const width = 1000, height = 300;
    const pad = { t: 40, b: 40, l: 50, r: 20 };
    
    if (!data || data.length < 2) return `<div class="p-8 text-center text-slate-500">Not enough data for ${title}</div>`;

    // 1. Calculate Scales
    const allValues = [];
    linesConfig.forEach(cfg => {
        data.forEach(d => { if (d[cfg.key] !== null) allValues.push(d[cfg.key]); });
    });
    
    let minVal = Math.min(...allValues);
    let maxVal = Math.max(...allValues);
    // Add buffer
    const range = maxVal - minVal;
    minVal = Math.max(0, minVal - (range * 0.1));
    maxVal = maxVal + (range * 0.1);

    const getX = (i) => pad.l + (i / (data.length - 1)) * (width - pad.l - pad.r);
    const getY = (val) => height - pad.b - ((val - minVal) / (maxVal - minVal)) * (height - pad.t - pad.b);

    // 2. Build Paths
    let pathsHtml = '';
    let pointsHtml = '';
    
    linesConfig.forEach(cfg => {
        let dPath = '';
        let hasStarted = false;
        
        data.forEach((d, i) => {
            const val = d[cfg.key];
            if (val !== null) {
                const x = getX(i);
                const y = getY(val);
                if (!hasStarted) { dPath += `M ${x} ${y}`; hasStarted = true; }
                else { dPath += ` L ${x} ${y}`; }
                
                // Tooltip point
                pointsHtml += `<circle cx="${x}" cy="${y}" r="3" fill="${cfg.color}" stroke="#1e293b" stroke-width="1" class="hover:r-5 transition-all cursor-pointer" onclick="alert('${d.date}: ${cfg.label} ${val}')">
                    <title>${d.date}: ${cfg.label} ${val}</title>
                </circle>`;
            }
        });
        
        pathsHtml += `<path d="${dPath}" fill="none" stroke="${cfg.color}" stroke-width="2" opacity="0.8" />`;
    });

    // 3. Axes
    const yAxisHtml = `
        <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" stroke="#475569" stroke-width="1" />
        <text x="${pad.l - 10}" y="${pad.t}" text-anchor="end" fill="#94a3b8" font-size="10">${Math.round(maxVal)}</text>
        <text x="${pad.l - 10}" y="${height - pad.b}" text-anchor="end" fill="#94a3b8" font-size="10">${Math.round(minVal)}</text>
    `;

    // Date Labels (simplify to 5-6 labels)
    let xAxisHtml = '';
    const step = Math.ceil(data.length / 6);
    data.forEach((d, i) => {
        if (i % step === 0 || i === data.length - 1) {
            const x = getX(i);
            const dateLabel = d.dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            xAxisHtml += `<text x="${x}" y="${height - 15}" text-anchor="middle" fill="#94a3b8" font-size="10">${dateLabel}</text>`;
        }
    });

    // Legend
    let legendHtml = linesConfig.map(cfg => `
        <div class="flex items-center gap-2">
            <div class="w-3 h-1 rounded-full" style="background-color: ${cfg.color}"></div>
            <span class="text-xs text-slate-300">${cfg.label}</span>
        </div>
    `).join('');

    return `
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-bold text-white uppercase tracking-wide">${title}</h3>
                <div class="flex gap-4">${legendHtml}</div>
            </div>
            <div class="w-full overflow-hidden">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">
                    ${yAxisHtml}
                    ${xAxisHtml}
                    ${pathsHtml}
                    ${pointsHtml}
                </svg>
            </div>
        </div>
    `;
};
