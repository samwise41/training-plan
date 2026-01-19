// js/views/dashboard/progressWidget.js
import { getSportColorVar } from './utils.js';

// Helper: Find next event from MD
function findNextEvent(planMd) {
    if (!planMd) return null;
    const lines = planMd.split('\n');
    let inTable = false;
    const today = new Date(); today.setHours(0,0,0,0);
    
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

// --- NEW EXPORT: Render Just the Event Card ---
export function renderNextEvent(planMd) {
    const nextEvent = findNextEvent(planMd);
    if (!nextEvent) return '';

    return `
        <div class="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex justify-between items-center relative overflow-hidden shadow-sm">
            <div class="relative z-10 flex items-center gap-4">
                <div class="bg-blue-600/20 text-blue-400 border border-blue-500/30 w-12 h-12 rounded-lg flex flex-col items-center justify-center shadow-lg">
                    <span class="text-lg font-bold leading-none">${nextEvent.daysToGo}</span>
                    <span class="text-[8px] uppercase font-bold">Days</span>
                </div>
                <div>
                    <div class="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-0.5">Up Next</div>
                    <div class="text-white font-bold text-base leading-tight">${nextEvent.name}</div>
                    <div class="text-xs text-slate-400 mt-0.5 font-mono">${nextEvent.date.toLocaleDateString()}</div>
                </div>
            </div>
            <i class="fa-solid fa-flag-checkered text-6xl text-blue-500/5 absolute -right-2 -bottom-4 transform -rotate-12 pointer-events-none"></i>
        </div>
    `;
}

// --- UPDATED: Render Just the Progress Bars ---
export function renderProgressWidget(plannedWorkouts, fullLogData) { 
    // 1. Determine Week Window
    let minDate = new Date(8640000000000000);
    let maxDate = new Date(-8640000000000000);

    if (plannedWorkouts && plannedWorkouts.length > 0) {
        plannedWorkouts.forEach(w => {
            const d = new Date(w.date);
            if (d < minDate) minDate = d;
            if (d > maxDate) maxDate = d;
        });
        
        const startDay = minDate.getDay(); 
        minDate.setDate(minDate.getDate() - startDay); // Back to Sunday
        minDate.setHours(0,0,0,0);
        
        maxDate = new Date(minDate);
        maxDate.setDate(minDate.getDate() + 6); // Forward to Saturday
        maxDate.setHours(23,59,59,999);
    } else {
        const today = new Date(); today.setHours(0,0,0,0);
        const day = today.getDay();
        minDate = new Date(today); minDate.setDate(today.getDate() - day);
        maxDate = new Date(minDate); maxDate.setDate(minDate.getDate() + 6); maxDate.setHours(23,59,59,999);
    }

    // 2. Init Buckets
    const buckets = {
        Bike: { planned: 0, actual: 0 },
        Run: { planned: 0, actual: 0 },
        Swim: { planned: 0, actual: 0 }
    };
    let totalPlanned = 0;
    let totalActual = 0;

    // 3. Aggregate PLANNED
    if (plannedWorkouts) {
        plannedWorkouts.forEach(w => {
            const d = new Date(w.date);
            if (d >= minDate && d <= maxDate) {
                const dur = w.plannedDuration || 0;
                totalPlanned += dur;
                
                let sport = null;
                const type = (w.activityType || '').toUpperCase();
                if (type === 'BIKE') sport = 'Bike';
                if (type === 'RUN') sport = 'Run';
                if (type === 'SWIM') sport = 'Swim';
                
                if (sport) buckets[sport].planned += dur;
            }
        });
    }

    // 4. Aggregate ACTUALS
    if (fullLogData) {
        fullLogData.forEach(d => {
            const date = new Date(d.date);
            if (date >= minDate && date <= maxDate) {
                const dur = d.duration || 0;
                totalActual += dur;
                const sport = d.sport; 
                if (buckets[sport]) {
                    buckets[sport].actual += dur;
                }
            }
        });
    }

    // 5. Render HTML
    const generateBar = (label, icon, bucketData, isTotal=false) => {
        const planned = bucketData ? bucketData.planned : totalPlanned;
        const actual = bucketData ? bucketData.actual : totalActual;
        
        if (!isTotal && planned === 0 && actual === 0) return '';

        const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
        const width = Math.min(pct, 100);
        
        let barColorVar = 'var(--color-all)';
        if (label === 'Bike') barColorVar = 'var(--color-bike)';
        if (label === 'Run') barColorVar = 'var(--color-run)';
        if (label === 'Swim') barColorVar = 'var(--color-swim)';

        const iconColorStyle = `style="color: ${barColorVar}"`;
        const barStyle = `style="width: ${width}%; background-color: ${barColorVar}"`;
        
        const actHrs = (actual/60).toFixed(1);
        const plnHrs = (planned/60).toFixed(1);
        const mbClass = isTotal ? 'mb-6' : 'mb-4';
        const heightClass = isTotal ? 'h-3' : 'h-2.5';
        const labelText = isTotal ? 'WEEKLY GOAL' : label;

        return `
        <div class="w-full ${mbClass}">
            <div class="flex justify-between items-end mb-1">
                <div class="flex items-center gap-2">
                    <i class="fa-solid ${icon} w-5 text-center" ${iconColorStyle}></i>
                    <div>
                        ${isTotal ? `<div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-0.5">${labelText}</div>` : ''}
                        <div class="text-sm font-bold text-white flex items-baseline gap-1">
                            ${Math.round(actual)} <span class="text-xs text-slate-500 font-normal">/ ${Math.round(planned)} m</span>
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xs font-bold text-slate-400">${pct}%</div>
                    ${isTotal ? `<div class="text-[10px] text-slate-600 font-mono">${actHrs} / ${plnHrs} hrs</div>` : ''}
                </div>
            </div>
            <div class="w-full bg-slate-700/50 rounded-full ${heightClass} overflow-hidden">
                <div class="h-full rounded-full transition-all duration-1000" ${barStyle}></div>
            </div>
        </div>`;
    };

    return `
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-8 shadow-sm">
        ${generateBar('Total', 'fa-layer-group', null, true)}
        
        <div class="grid grid-cols-1 gap-1">
            ${generateBar('Swim', 'fa-person-swimming', buckets.Swim)}
            ${generateBar('Bike', 'fa-bicycle', buckets.Bike)}
            ${generateBar('Run', 'fa-person-running', buckets.Run)}
        </div>
    </div>`;
}
