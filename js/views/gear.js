import { Parser } from '../parser.js';

export function renderGear(planMd) {
    // 1. Parse Gear Data
    // We look for a section starting with "## Gear" or "## Equipment"
    const gearSection = Parser.getSection(planMd, "Gear") || Parser.getSection(planMd, "Equipment");
    
    // Default empty state
    let bikeGear = [];
    let runGear = [];

    if (gearSection) {
        // Simple line parser: looks for bullet points like "* [Bike] Name (0 miles)"
        const lines = gearSection.split('\n');
        lines.forEach(line => {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('*')) {
                // Check tags
                const isBike = cleanLine.toLowerCase().includes('[bike]') || cleanLine.toLowerCase().includes('cycling');
                const isRun = cleanLine.toLowerCase().includes('[run]') || cleanLine.toLowerCase().includes('shoe');
                
                // Extract Name and Mileage
                // Format assumption: * [Tag] Name of Gear (100 miles) - Notes
                // We'll just display the raw text cleaned up for now if specific format isn't strictly enforced
                const content = cleanLine.substring(1).trim();
                
                if (isBike) bikeGear.push(content);
                else if (isRun) runGear.push(content);
            }
        });
    }

    // 2. Build Components with NEW COLORS
    
    // Bike Card (Purple)
    const bikeCardHtml = `
        <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-purple-500 transition-all group cursor-pointer relative overflow-hidden">
            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i class="fa-solid fa-bicycle text-9xl text-purple-500 -mr-4 -mt-4 transform rotate-12"></i>
            </div>
            <div class="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600 group-hover:border-purple-500 transition-colors">
                            <i class="fa-solid fa-bicycle text-purple-500 text-lg"></i>
                        </div>
                        <h3 class="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">CYCLING</h3>
                    </div>
                    <div class="space-y-3">
                        ${bikeGear.length > 0 ? bikeGear.map(item => `
                            <div class="flex items-start gap-2 text-sm text-slate-300">
                                <i class="fa-solid fa-angle-right text-purple-500 mt-1"></i>
                                <span>${item.replace(/\[.*?\]/g, '')}</span>
                            </div>
                        `).join('') : '<p class="text-slate-500 italic text-sm">No cycling gear tracked.</p>'}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Run Card (Fuchsia)
    const runCardHtml = `
        <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-fuchsia-500 transition-all group cursor-pointer relative overflow-hidden">
            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i class="fa-solid fa-person-running text-9xl text-fuchsia-500 -mr-4 -mt-4 transform rotate-12"></i>
            </div>
            <div class="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600 group-hover:border-fuchsia-500 transition-colors">
                            <i class="fa-solid fa-person-running text-fuchsia-500 text-lg"></i>
                        </div>
                        <h3 class="text-xl font-bold text-white group-hover:text-fuchsia-400 transition-colors">RUNNING</h3>
                    </div>
                    <div class="space-y-3">
                        ${runGear.length > 0 ? runGear.map(item => `
                            <div class="flex items-start gap-2 text-sm text-slate-300">
                                <i class="fa-solid fa-angle-right text-fuchsia-500 mt-1"></i>
                                <span>${item.replace(/\[.*?\]/g, '')}</span>
                            </div>
                        `).join('') : '<p class="text-slate-500 italic text-sm">No running shoes tracked.</p>'}
                    </div>
                </div>
            </div>
        </div>
    `;

    // 3. Render
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            ${bikeCardHtml}
            ${runCardHtml}
        </div>
        
        <div class="bg-slate-800/30 rounded-lg p-4 border-l-4 border-slate-600">
            <h4 class="text-sm font-bold text-white mb-1"><i class="fa-solid fa-circle-info text-slate-400 mr-2"></i>Tracking Gear</h4>
            <p class="text-xs text-slate-400">
                Add a "## Gear" section to your Markdown file to track mileage. Format items as: 
                <code class="bg-slate-900 px-1 py-0.5 rounded text-purple-400 font-mono">* [Bike] Tarmac SL7 (1,200 miles)</code> or 
                <code class="bg-slate-900 px-1 py-0.5 rounded text-fuchsia-400 font-mono">* [Run] Saucony Endorphin (45 miles)</code>.
            </p>
        </div>
    `;
}
