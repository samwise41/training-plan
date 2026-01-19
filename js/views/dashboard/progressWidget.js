// js/views/dashboard/progressWidget.js
import { getSportColorVar } from './utils.js';

// Helper: Find next event
function findNextEvent(planMd) {
    if (!planMd) return null;
    const lines = planMd.split('\n');
    let inTable = false;
    const today = new Date(); today.setHours(0,0,0,0);
    
    // Simple parser for the "Event Schedule" table
    for (let line of lines) {
        if (line.includes('| **Date** |')) { inTable = true; continue; }
        if (inTable && line.startsWith('| :---')) continue;
        if (inTable && line.startsWith('|')) {
            const cols = line.split('|').map(c => c.trim());
            // Col 1: Date, Col 2: Name
            if (cols.length >= 3) {
                const dateStr = cols[1];
                const d = new Date(dateStr);
                if (!isNaN(d) && d >= today) {
                    return {
                        name: cols[2].replace(/\*\*/g, ''),
                        date: d,
                        daysToGo: Math.ceil((d - today) / (1000 * 60 * 60 * 24))
                    };
                }
            }
        }
    }
    return null;
}

export function renderProgressWidget(workouts, fullLogData, planMd) { // Added planMd argument
    // 1. Define Current Week
    const today = new Date(); today.setHours(0,0,0,0);
    const currentDay = today.getDay(); 
    const distToMon = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today); monday.setDate(today.getDate() - distToMon); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);

    // 2. Init Stats
    const sportStats = { 
        Bike: { planned: 0, actual: 0 }, 
        Run: { planned: 0, actual: 0 }, 
        Swim: { planned: 0, actual: 0 },
        Other: { planned: 0, actual: 0 } 
    };
    
    let totalPlanned = 0; 
    let totalActual = 0; 

    // 3. Process PLANNED
    if (workouts) {
        workouts.forEach(w => {
            const d = new Date(w.date);
            if (d >= monday && d <= sunday) {
                const planDur = w.plannedDuration || 0;
                totalPlanned += planDur;

                let sport = 'Other';
                const type = (w.type || '').toUpperCase();
                if (type.includes('RUN')) sport = 'Run';
                else if (type.includes('BIKE')) sport = 'Bike';
                else if (type.includes('SWIM')) sport = 'Swim';

                if (sportStats[sport]) sportStats[sport].planned += planDur;
            }
        });
    }

    // 4. Process ACTUAL
    if (fullLogData) {
        fullLogData.forEach(item => {
            const d = new Date(item.date);
            if (d >= monday && d <= sunday) {
                const actDur = item.duration || 0;
                if (actDur > 0) {
                    totalActual += actDur;
                    const sport = sportStats[item.sport] ? item.sport : 'Other';
                    sportStats[sport].actual += actDur;
                }
            }
        });
    }

    // 5. Build Bars HTML
    const generateBarHtml = (label, iconClass, actual, planned, isMain = false, sportType = 'All') => {
        if (!isMain && planned === 0 && actual === 0) return '';

        const rawPct = planned > 0 ? Math.round((actual / planned) * 100) : 0; 
        const barWidth = Math.min(rawPct, 100); 
        const actualHrs = (actual / 60).toFixed(1); 
        const plannedHrs = (planned / 60).toFixed(1);
        
        const labelHtml = isMain ? `<span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">${label}</span>` : ''; 
        const colorStyle = `style="color: ${getSportColorVar(sportType)}"`;
        const iconHtml = iconClass ? `<i class="fa-solid ${iconClass} mr-2 w-4 text-center" ${colorStyle}></i>` : ''; 
        const heightClass = isMain ? 'h-3' : 'h-2.5'; 
        const mbClass = isMain ? 'mb-4' : 'mb-3'; 
        const pctColor = rawPct >= 100 ? 'text-emerald-400' : 'text-blue-400';
        const barBgStyle = `style="width: ${barWidth}%; background-color: ${getSportColorVar(sportType)}"`;

        return `
        <div class="flex-1 w-full ${mbClass}">
            <div class="flex justify-between items-end mb-1">
                <div class="flex flex-col">
                    ${labelHtml}
                    <div class="flex items-center">
                        ${iconHtml}
                        <span class="text-sm font-bold text-white flex items-baseline gap-1">
                            ${Math.round(actual)} / ${Math.round(planned)} mins
                            <span class="text-xs text-slate-400 font-normal ml-1">(${actualHrs} / ${plannedHrs} hrs)</span>
                        </span>
                    </div>
                </div>
                <span class="text-xs font-bold ${pctColor}">${rawPct}%</span>
            </div>
            <div class="relative w-full ${heightClass} bg-slate-700 rounded-full overflow-hidden">
                <div class="absolute top-0 left-0 h-full transition-all duration-1000 ease-out" ${barBgStyle}></div>
            </div>
        </div>`;
    };

    // 6. Next Event Logic
    const nextEvent = findNextEvent(planMd);
    let eventHtml = '';
    if (nextEvent) {
        eventHtml = `
            <div class="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4 mb-6 flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <div class="bg-blue-600 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg">
                        ${nextEvent.daysToGo}
                    </div>
                    <div>
                        <div class="text-[10px] uppercase tracking-widest text-blue-300 font-bold">Days To Go</div>
                        <div class="text-white font-bold text-lg leading-none">${nextEvent.name}</div>
                        <div class="text-xs text-blue-200 mt-0.5">${nextEvent.date.toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="hidden sm:block text-right">
                    <i class="fa-solid fa-flag-checkered text-4xl text-blue-500/20"></i>
                </div>
            </div>
        `;
    }

    return `
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-8 shadow-sm">
        ${eventHtml}
        <div class="flex flex-col md:flex-row items-start gap-6">
            <div class="flex-1 w-full">
                ${generateBarHtml('Weekly Goal', null, totalActual, totalPlanned, true, 'All')}
                ${generateBarHtml('Bike', 'fa-bicycle', sportStats.Bike.actual, sportStats.Bike.planned, false, 'Bike')}
                ${generateBarHtml('Run', 'fa-person-running', sportStats.Run.actual, sportStats.Run.planned, false, 'Run')}
                ${generateBarHtml('Swim', 'fa-person-swimming', sportStats.Swim.actual, sportStats.Swim.planned, false, 'Swim')}
            </div>
        </div>
    </div>`;
}
