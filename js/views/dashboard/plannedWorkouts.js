// js/views/dashboard/plannedWorkouts.js
import { Parser } from '../../parser.js';
import { toLocalYMD, getSportColorVar, getIcon, buildCollapsibleSection } from './utils.js';

export function renderPlannedWorkouts(planMd, cleanLogData) {
    const scheduleSection = Parser.getSection(planMd, "Weekly Schedule");
    if (!scheduleSection) return '<p class="text-slate-500 italic">No Weekly Schedule found.</p>';

    const workouts = Parser._parseTableBlock(scheduleSection);
    workouts.sort((a, b) => a.date - b.date);

    // Group by Date
    let cardsHtml = '';
    const grouped = {};
    workouts.forEach(w => { 
        const key = toLocalYMD(w.date); 
        if (!grouped[key]) grouped[key] = []; 
        grouped[key].push(w); 
    });
    
    const sortedKeys = Object.keys(grouped).sort();
    const today = new Date(); today.setHours(0,0,0,0);

    sortedKeys.forEach(dateKey => {
        const dailyWorkouts = grouped[dateKey];
        const dateObj = dailyWorkouts[0].date;
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        
        dailyWorkouts.forEach(w => {
            const notes = w.notes ? w.notes.replace(/\[.*?\]/g, '') : "No specific notes.";
            let statusText = "PLANNED"; 
            let statusColorClass = "text-white"; 
            let cardBorder = 'border border-slate-700 hover:border-slate-600'; 
            let actualDur = 0;

            // Match against Clean Log Data
            // We match by Date AND Sport (e.g. "Run" == "Run")
            const match = cleanLogData.find(d => 
                toLocalYMD(d.date) === dateKey && 
                d.sport.toUpperCase() === w.type.toUpperCase()
            );

            if (match) {
                statusText = "COMPLETED";
                statusColorClass = "text-emerald-500";
                actualDur = Math.round(match.duration); // FIX: Round to integer
                
                const plan = w.plannedDuration || 0;
                const ratio = plan > 0 ? (actualDur / plan) : 1;
                
                if (ratio >= 0.95) cardBorder = 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-900'; 
                else if (ratio >= 0.80) cardBorder = 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-slate-900'; 
                else cardBorder = 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-900'; 
            } else if (dateObj.getTime() === today.getTime()) {
                cardBorder = 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900';
            } else if (dateObj < today) {
                // Past and unmatched = Missed?
                // cardBorder = 'opacity-60 border border-slate-800';
            }

            const titleStyle = `style="color: ${getSportColorVar(w.type)}"`;

            cardsHtml += `
            <div class="bg-slate-800 rounded-xl p-6 shadow-lg relative overflow-hidden transition-all ${cardBorder}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[11px] font-bold text-slate-500 uppercase tracking-widest">${dayName}</span>
                    ${getIcon(w.type)}
                </div>
                <div class="flex justify-between items-center mb-6 mt-1">
                    <div class="flex flex-col">
                        <div class="flex items-baseline gap-1">
                            <span class="text-5xl font-bold text-white tracking-tight leading-none">${w.plannedDuration}</span>
                            <span class="text-lg font-medium text-slate-400 font-mono">mins</span>
                        </div>
                        <div class="text-sm font-bold ${statusColorClass} uppercase tracking-widest mt-1">${statusText}</div>
                    </div>
                    <div class="text-right pl-4 max-w-[55%]">
                        <h3 class="text-lg font-bold leading-tight" ${titleStyle}>${w.planName}</h3>
                    </div>
                </div>
                <div class="h-px bg-slate-700 w-full mb-4"></div>
                <div><p class="text-sm text-slate-300 leading-relaxed font-sans">${notes}</p></div>
                ${actualDur > 0 ? `<div class="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center"><span class="text-[10px] font-bold text-slate-500 uppercase">Actual Duration</span><span class="text-sm font-mono font-bold text-emerald-400">${actualDur} min</span></div>` : ''}
            </div>`;
        });
    });

    const cardsContainerHtml = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-0 p-2">${cardsHtml}</div>`;
    return buildCollapsibleSection('planned-workouts-section', 'Planned Workouts', cardsContainerHtml, true);
}
