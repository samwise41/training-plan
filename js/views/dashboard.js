import { Parser } from '../parser.js';

export function renderDashboard(planMd) {
    // 1. Extract Schedule Data using our parser
    const scheduleSection = Parser.getSection(planMd, "Weekly Schedule");
    if (!scheduleSection) return '<p class="text-slate-500 italic">No Weekly Schedule found.</p>';

    // Use the internal table parser to get structured data
    const workouts = Parser._parseTableBlock(scheduleSection);
    
    // 2. Sort by Date (just in case)
    workouts.sort((a, b) => a.date - b.date);

    // 3. Helpers for styling
    const getIcon = (type) => {
        if (type === 'Bike') return 'fa-bicycle text-blue-400';
        if (type === 'Run') return 'fa-person-running text-emerald-400';
        if (type === 'Swim') return 'fa-person-swimming text-cyan-400';
        if (type === 'Strength') return 'fa-dumbbell text-purple-400';
        return 'fa-stopwatch text-slate-400';
    };

    const getBorderColor = (type) => {
        if (type === 'Bike') return 'border-l-blue-500';
        if (type === 'Run') return 'border-l-emerald-500';
        if (type === 'Swim') return 'border-l-cyan-500';
        return 'border-l-slate-500';
    };

    // 4. Build Cards HTML
    let cardsHtml = '';
    
    // Group by Date to handle multiple workouts per day
    const grouped = {};
    workouts.forEach(w => {
        const key = w.date.toISOString().split('T')[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(w);
    });

    const sortedKeys = Object.keys(grouped).sort();

    sortedKeys.forEach(dateKey => {
        const dailyWorkouts = grouped[dateKey];
        const dateObj = dailyWorkouts[0].date;
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const shortDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        // Check if today
        const today = new Date();
        const isToday = dateObj.getDate() === today.getDate() && 
                        dateObj.getMonth() === today.getMonth() && 
                        dateObj.getFullYear() === today.getFullYear();

        const todayClass = isToday ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : '';

        // Render Day Header
        cardsHtml += `
            <div class="mb-4 break-inside-avoid">
                <div class="flex items-center gap-2 mb-2 px-1">
                    <span class="text-sm font-bold text-slate-200 uppercase tracking-widest">${dayName}</span>
                    <span class="text-xs font-mono text-slate-500">${shortDate}</span>
                    ${isToday ? '<span class="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Today</span>' : ''}
                </div>
                <div class="space-y-3">
        `;

        // Render Cards for this day
        dailyWorkouts.forEach(w => {
            const isCompleted = w.completed;
            const statusIcon = isCompleted 
                ? '<i class="fa-solid fa-circle-check text-emerald-500"></i>' 
                : '<i class="fa-regular fa-circle text-slate-600"></i>';
            
            const opacity = isCompleted ? 'opacity-60 grayscale' : 'opacity-100';
            const notes = w.notes ? w.notes.replace(/\[.*?\]/g, '') : "No specific notes.";

            cardsHtml += `
                <div class="relative bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-sm hover:border-slate-600 transition-colors border-l-4 ${getBorderColor(w.type)} ${todayClass} ${opacity}">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid ${getIcon(w.type)} text-lg w-6 text-center"></i>
                            <h4 class="font-bold text-white text-md leading-tight">${w.planName}</h4>
                        </div>
                        <div class="text-lg">${statusIcon}</div>
                    </div>

                    <div class="flex items-center gap-4 mb-3 text-xs text-slate-400 font-mono">
                        <span class="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded">
                            <i class="fa-regular fa-clock"></i> ${w.plannedDuration} min
                        </span>
                        ${w.type === 'Bike' ? '<span class="flex items-center gap-1.5"><i class="fa-solid fa-bolt"></i> Power</span>' : ''}
                        ${w.type === 'Run' ? '<span class="flex items-center gap-1.5"><i class="fa-solid fa-heart-pulse"></i> HR</span>' : ''}
                    </div>

                    <div class="bg-slate-900/50 rounded p-3 border border-slate-700/50">
                        <p class="text-xs text-slate-300 leading-relaxed font-sans">${notes}</p>
                    </div>

                    ${w.actualDuration > 0 ? `
                        <div class="mt-3 pt-2 border-t border-slate-700/50 flex justify-between items-center">
                            <span class="text-[10px] font-bold text-slate-500 uppercase">Actual</span>
                            <span class="text-xs font-mono text-emerald-400">${w.actualDuration} min</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        cardsHtml += `</div></div>`; // Close Day Wrapper
    });

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${cardsHtml}
        </div>
    `;
}