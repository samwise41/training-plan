import { Parser } from '../parser.js';

export function renderDashboard(planMd) {
    // 1. Extract Schedule Data
    const scheduleSection = Parser.getSection(planMd, "Weekly Schedule");
    if (!scheduleSection) return '<p class="text-slate-500 italic">No Weekly Schedule found.</p>';

    // Parse Workouts
    const workouts = Parser._parseTableBlock(scheduleSection);
    
    // Sort by Date
    workouts.sort((a, b) => a.date - b.date);

    // Styling Helpers
    const getIcon = (type) => {
        if (type === 'Bike') return 'fa-bicycle text-blue-500';
        if (type === 'Run') return 'fa-person-running text-emerald-500';
        if (type === 'Swim') return 'fa-person-swimming text-cyan-500';
        if (type === 'Strength') return 'fa-dumbbell text-purple-500';
        return 'fa-stopwatch text-slate-500';
    };

    const getTypeColor = (type) => {
        if (type === 'Bike') return 'text-blue-500';
        if (type === 'Run') return 'text-emerald-500';
        if (type === 'Swim') return 'text-cyan-500';
        return 'text-slate-400';
    };

    // 2. Build Grid
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
        
        // Highlight Today
        const today = new Date();
        const isToday = dateObj.getDate() === today.getDate() && 
                        dateObj.getMonth() === today.getMonth() && 
                        dateObj.getFullYear() === today.getFullYear();
        
        const cardBorder = isToday ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : 'border border-slate-700 hover:border-slate-600';

        dailyWorkouts.forEach(w => {
            const notes = w.notes ? w.notes.replace(/\[.*?\]/g, '') : "No specific notes.";
            
            // Determine "Big Number" text
            let displayDuration = w.plannedDuration;
            let displayUnit = "mins";
            let statusText = "PLANNED";
            let statusColor = "text-white"; // Default white for planned

            // Handle Completed State
            if (w.completed) {
                statusText = "COMPLETED";
                statusColor = "text-emerald-500";
                // Optionally show actual duration if you prefer
                // displayDuration = w.actualDuration > 0 ? w.actualDuration : w.plannedDuration;
            } else if (w.type === 'Rest') {
                displayDuration = "--";
                statusText = "REST DAY";
                statusColor = "text-slate-500";
            }

            cardsHtml += `
                <div class="bg-slate-800 rounded-xl p-6 shadow-lg relative overflow-hidden transition-all ${cardBorder}">
                    
                    <div class="flex justify-between items-start mb-4">
                        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-widest">${dayName}</span>
                        <i class="fa-solid ${getIcon(w.type)} text-xl"></i>
                    </div>

                    <div class="mb-6">
                        <div class="flex items-baseline gap-1">
                            <span class="text-4xl font-bold text-white tracking-tight">${displayDuration}</span>
                            <span class="text-lg font-medium text-slate-400 font-mono">${displayUnit}</span>
                        </div>
                        <div class="text-sm font-bold ${statusColor} uppercase tracking-widest mt-1">${statusText}</div>
                    </div>

                    <div class="h-px bg-slate-700 w-full mb-4"></div>

                    <div>
                        <p class="text-xs text-slate-400 leading-relaxed font-sans">
                            <span class="${getTypeColor(w.type)} font-bold mb-1 block">${w.planName}</span>
                            ${notes}
                        </p>
                    </div>

                </div>
            `;
        });
    });

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${cardsHtml}
        </div>
    `;
}
