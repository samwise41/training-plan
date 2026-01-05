import { Parser } from '../parser.js';

// Restored Gantt-Style Phase Chart
const buildPhaseChart = (planMd) => {
    const phasesSection = Parser.getSection(planMd, "Periodization Phases");
    if (!phasesSection) return '<p class="text-slate-500">Phases not defined.</p>';

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

    // Render Grid
    let html = `<div class="grid grid-cols-1 gap-4 mb-8">`;
    
    phases.forEach((p, index) => {
        // Determine if active based on simple string matching (can be improved with real dates)
        const isCurrent = p.dates.includes("Jan") || (p.dates.includes("Feb") && index < 2); 
        
        // Color Coding based on Phase Name
        let barColor = "bg-slate-700";
        let icon = "fa-layer-group";
        
        if (p.name.includes("Base")) { barColor = "bg-blue-600"; icon = "fa-cubes"; }
        if (p.name.includes("Build")) { barColor = "bg-emerald-600"; icon = "fa-chart-line"; }
        if (p.name.includes("Peak") || p.name.includes("Race")) { barColor = "bg-purple-600"; icon = "fa-flag-checkered"; }
        if (p.name.includes("Recovery")) { barColor = "bg-slate-500"; icon = "fa-bed"; }

        const activeClass = isCurrent ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900" : "opacity-75";

        html += `
            <div class="relative flex items-center bg-slate-800 rounded-lg p-4 border border-slate-700 ${activeClass}">
                <div class="w-12 h-12 rounded-lg ${barColor} flex items-center justify-center text-white text-xl shadow-lg shrink-0 mr-4">
                    <i class="fa-solid ${icon}"></i>
                </div>
                
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-1">
                        <h3 class="text-white font-bold truncate pr-4">${p.name}</h3>
                        <span class="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-700 whitespace-nowrap">${p.weeks}</span>
                    </div>
                    
                    <div class="flex justify-between items-end">
                        <p class="text-sm text-slate-300 truncate mr-4">${p.focus}</p>
                        <span class="text-xs text-slate-500 font-mono">${p.dates}</span>
                    </div>
                </div>

                ${isCurrent ? '<div class="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-slate-900 animate-pulse"></div>' : ''}
            </div>
        `;
    });

    html += `</div>`;
    return html;
};

export function renderRoadmap(planMd) {
    if (!planMd) return '<div class="p-8 text-center text-slate-500">No plan loaded.</div>';

    const phasesHtml = buildPhaseChart(planMd);
    
    // Markdown Render of the full plan
    const safeMarked = window.marked ? window.marked.parse : (t) => t;
    const fullPlanHtml = safeMarked(planMd);

    return `
        <div class="max-w-4xl mx-auto">
            <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <i class="fa-solid fa-timeline text-blue-500"></i> Season Roadmap
            </h2>
            
            ${phasesHtml}

            <div class="border-t border-slate-700 my-10"></div>
            
            <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <i class="fa-solid fa-file-contract text-emerald-500"></i> Master Training Plan
            </h2>
            <div class="prose prose-invert prose-sm max-w-none bg-slate-800/30 p-8 rounded-xl border border-slate-700 shadow-xl">
                ${fullPlanHtml}
            </div>
        </div>
    `;
}
