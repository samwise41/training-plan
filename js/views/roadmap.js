import { Parser } from '../parser.js';

// NEW: Projected Volume Chart Builder
const buildProjectedVolumeChart = (planMd) => {
    // 1. Parse ONLY the "PLANNED" rows to find future volume
    const lines = planMd.split('\n');
    const weeks = {}; // Key: "Week X" or Date, Value: Total Mins

    lines.forEach(line => {
        if (line.includes('| PLANNED |')) {
            const parts = line.split('|').map(p => p.trim());
            // Format: | PLANNED | Day | Type | Duration | ... | Date |
            // Duration is usually parts[4] ("60 mins")
            // Date is usually parts[8] ("2026-01-05")
            if (parts.length > 8) {
                const durStr = parts[4];
                const dateStr = parts[8];
                const mins = parseInt(durStr.replace(/\D/g, '')) || 0;
                
                if (dateStr && mins > 0) {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        // Find the "Week Of" (Monday)
                        const day = date.getDay(); 
                        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                        const monday = new Date(date.setDate(diff));
                        const label = `${monday.getMonth()+1}/${monday.getDate()}`;
                        
                        if (!weeks[label]) weeks[label] = 0;
                        weeks[label] += mins;
                    }
                }
            }
        }
    });

    const sortedLabels = Object.keys(weeks).sort((a,b) => {
        const da = new Date(a + "/2026"); // Hacky sort, assumes year
        const db = new Date(b + "/2026");
        return da - db;
    });

    if (sortedLabels.length === 0) return '<div class="p-4 italic text-slate-500">No projected data found.</div>';

    // SVG Config
    const width = 800;
    const height = 200;
    const pad = { t: 20, b: 30, l: 40, r: 10 };
    const maxVal = Math.max(...Object.values(weeks));
    const maxHours = Math.ceil(maxVal / 60);

    const getX = (i) => pad.l + (i * ((width - pad.l - pad.r) / sortedLabels.length));
    const getY = (mins) => height - pad.b - ((mins / (maxHours * 60)) * (height - pad.t - pad.b));

    const bars = sortedLabels.map((label, i) => {
        const val = weeks[label];
        const x = getX(i);
        const y = getY(val);
        const h = (height - pad.b) - y;
        const barW = (width / sortedLabels.length) * 0.6;
        
        const hours = (val / 60).toFixed(1);
        
        return `
            <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#3b82f6" opacity="0.6" rx="2">
                <title>Week of ${label}: ${hours}h</title>
            </rect>
        `;
    }).join('');

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-8">
            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Projected Annual Volume (Hours/Week)</h3>
            <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">
                <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" stroke="#334155" stroke-width="1" />
                <line x1="${pad.l}" y1="${height - pad.b}" x2="${width}" y2="${height - pad.b}" stroke="#334155" stroke-width="1" />
                ${bars}
            </svg>
        </div>
    `;
};

// Existing Phases Logic
const buildPhaseChart = (planMd) => {
    const phasesSection = Parser.getSection(planMd, "Periodization Phases");
    if (!phasesSection) return '<p class="text-slate-500">Phases not defined.</p>';

    const lines = phasesSection.split('\n').filter(l => l.trim().startsWith('|') && !l.includes('---') && !l.toLowerCase().includes('phase'));
    const phaseData = lines.map(line => {
        const cols = line.split('|').map(c => c.trim()).filter(c => c);
        // Col 0: Phase Name, Col 1: Focus, Col 2: Dates, Col 3: Weeks
        if (cols.length < 4) return null;
        return { name: cols[0], focus: cols[1], dates: cols[2], weeks: cols[3] };
    }).filter(p => p);

    let html = `<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">`;
    phaseData.forEach(p => {
        const isCurrent = p.dates.includes("Jan") || p.dates.includes("Feb"); // Simple dumb check, logic can be improved
        const borderClass = isCurrent ? "border-blue-500 bg-slate-800" : "border-slate-700 bg-slate-800/50";
        const textClass = isCurrent ? "text-blue-400" : "text-slate-300";
        
        html += `
            <div class="border ${borderClass} p-4 rounded-lg relative overflow-hidden group">
                ${isCurrent ? '<div class="absolute top-0 right-0 bg-blue-600 text-[10px] px-2 py-0.5 text-white font-bold rounded-bl">ACTIVE</div>' : ''}
                <h3 class="font-bold text-lg ${textClass}">${p.name}</h3>
                <p class="text-xs text-slate-500 font-mono mb-2">${p.dates}</p>
                <div class="text-sm text-slate-400 mb-2">${p.focus}</div>
                <div class="text-xs font-bold text-slate-500 uppercase tracking-widest">${p.weeks}</div>
            </div>
        `;
    });
    html += `</div>`;
    return html;
};

export function renderRoadmap(planMd) {
    if (!planMd) return '<div class="p-8 text-center text-slate-500">No plan loaded.</div>';

    const phasesHtml = buildPhaseChart(planMd);
    const volumeHtml = buildProjectedVolumeChart(planMd);
    
    // Markdown Render of the full plan
    const safeMarked = window.marked ? window.marked.parse : (t) => t;
    const fullPlanHtml = safeMarked(planMd);

    return `
        <h2 class="text-xl font-bold text-white mb-6">Macro Cycle Overview</h2>
        ${phasesHtml}
        
        ${volumeHtml}

        <div class="border-t border-slate-700 my-8"></div>
        
        <h2 class="text-xl font-bold text-white mb-6">Master Training Plan Document</h2>
        <div class="prose prose-invert prose-sm max-w-none bg-slate-800/20 p-6 rounded-xl border border-slate-700">
            ${fullPlanHtml}
        </div>
    `;
}
