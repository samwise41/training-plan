import { toLocalYMD, getSportColorVar, getIcon, buildCollapsibleSection } from './utils.js';

export function renderPlannedWorkouts(plannedJson, cleanLogData) {
    if (!plannedJson || plannedJson.length === 0) {
        return buildCollapsibleSection('planned-workouts-section', 'Planned Workouts', 
            '<div class="p-4 text-slate-500 italic text-center">No planned workouts found.</div>', true
        );
    }

    const workouts = [...plannedJson].sort((a, b) => new Date(a.date) - new Date(b.date));
    const grouped = {};
    workouts.forEach(w => { 
        const key = w.date; 
        if (!grouped[key]) grouped[key] = []; 
        grouped[key].push(w); 
    });
    
    const sortedKeys = Object.keys(grouped).sort();
    const today = new Date(); 
    today.setHours(0,0,0,0);

    let cardsHtml = '';

    sortedKeys.forEach(dateKey => {
        const dailyWorkouts = grouped[dateKey];
        const [y, m, d] = dateKey.split('-').map(Number);
        const dateObj = new Date(y, m-1, d); 
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const isToday = dateObj.getTime() === today.getTime();

        dailyWorkouts.forEach(w => {
            const notes = w.notes ? w.notes.replace(/\[.*?\]/g, '') : "No specific notes.";
            let statusText = "PLANNED"; 
            let statusColorClass = "text-white"; 
            let cardBorder = 'border border-slate-700 hover:border-slate-600'; 
            let actualDur = 0;

            const match = cleanLogData.find(log => 
                toLocalYMD(log.date) === dateKey && 
                log.sport.toUpperCase() === w.activityType.toUpperCase()
            );

            if (match) {
                statusText = "COMPLETED";
                statusColorClass = "text-emerald-500";
                actualDur = Math.round(match.duration);
                const plan = w.plannedDuration || 0;
                const ratio = plan > 0 ? (actualDur / plan) : 1;
                
                if (ratio >= 0.95) cardBorder = 'ring-1 ring-emerald-500 bg-slate-800/80'; 
                else if (ratio >= 0.80) cardBorder = 'ring-1 ring-yellow-500 bg-slate-800/80'; 
                else cardBorder = 'ring-1 ring-red-500 bg-slate-800/80'; 
            } else if (isToday) {
                cardBorder = 'ring-1 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]';
            }

            const titleStyle = `style="color: ${getSportColorVar(w.activityType)}"`;

            cardsHtml += `
            <div class="bg-slate-800 rounded-xl p-6 shadow-lg relative overflow-hidden transition-all ${cardBorder}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[11px] font-bold text-slate-500 uppercase tracking-widest">${dayName}</span>
                    ${getIcon(w.activityType)}
                </div>
                <div class="flex justify-between items-center mb-6 mt-1">
                    <div class="flex flex-col">
                        <div class="flex items-baseline gap-1">
                            <span class="text-5xl font-bold text-white tracking-tight leading-none">${w.plannedDuration}</span>
                            <span class="text-lg font-medium text-slate-400 font-mono">mins</span>
                        </div>
                        <div class="text-xs font-bold ${statusColorClass} uppercase tracking-widest mt-2 border border-slate-700/50 inline-block px-2 py-0.5 rounded bg-slate-900/50">${statusText}</div>
                    </div>
                    <div class="text-right pl-4 max-w-[55%]">
                        <h3 class="text-lg font-bold leading-tight" ${titleStyle}>${w.activityName}</h3>
                    </div>
                </div>
                <div class="h-px bg-slate-700/50 w-full mb-4"></div>
                <div><p class="text-sm text-slate-300 leading-relaxed font-sans line-clamp-3">${notes}</p></div>
                ${actualDur > 0 ? `<div class="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center bg-slate-900/20 -mx-6 -mb-6 px-6 py-3"><span class="text-[10px] font-bold text-slate-500 uppercase">Actual</span><span class="text-sm font-mono font-bold text-emerald-400 flex items-center gap-2"><i class="fa-solid fa-check-circle"></i> ${actualDur} min</span></div>` : ''}
            </div>`;
        });
    });

    return buildCollapsibleSection('planned-workouts-section', 'Planned Workouts', `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-0 p-2">${cardsHtml}</div>`, true);
}
