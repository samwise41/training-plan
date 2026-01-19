import { getSportColorVar } from './utils.js';




// --- EXPORT 2: Render Progress Bars ONLY (No Events, No Phases) ---
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
        minDate.setDate(minDate.getDate() - startDay); 
        minDate.setHours(0,0,0,0);
        maxDate = new Date(minDate);
        maxDate.setDate(minDate.getDate() + 6); 
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

    // 3. Aggregate
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

    if (fullLogData) {
        fullLogData.forEach(d => {
            const date = new Date(d.date);
            if (date >= minDate && date <= maxDate) {
                const dur = d.duration || 0;
                totalActual += dur;
                const sport = d.sport; 
                if (buckets[sport]) buckets[sport].actual += dur;
            }
        });
    }

    // 4. Render Bars
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
                    <i class="fa-solid ${icon} w-5 text-center" style="color: ${barColorVar}"></i>
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

    // 5. RETURN ONLY THE WIDGET WRAPPER
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
