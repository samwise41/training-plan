// --- Weekly Volume Chart Helper ---
const buildWeeklyVolumeChart = (data) => {
    try {
        if (!data || data.length === 0) return '<div class="p-4 text-slate-500 italic">No data available for volume chart</div>';
        
        // 1. Setup 8-Week Buckets (Sun-Sat)
        const buckets = [];
        const now = new Date();
        const day = now.getDay(); // 0 (Sun) to 6 (Sat)
        
        // Calculate the most recent Sunday (Start of Current Week)
        const diff = now.getDate() - day; 
        const currentSunday = new Date(now.setDate(diff));
        currentSunday.setHours(0,0,0,0);

        for (let i = 7; i >= 0; i--) {
            const d = new Date(currentSunday);
            d.setDate(d.getDate() - (i * 7)); // Start Date (Sunday)
            
            const e = new Date(d);
            e.setDate(e.getDate() + 6); // End Date (Saturday)
            e.setHours(23,59,59,999);
            
            buckets.push({ 
                start: d, 
                end: e, 
                label: `${e.getMonth()+1}/${e.getDate()}`, 
                actualMins: 0, 
                plannedMins: 0 
            });
        }

        // 2. Aggregate Data
        data.forEach(item => {
            if (!item.date) return;
            const t = item.date.getTime();
            const bucket = buckets.find(b => t >= b.start.getTime() && t <= b.end.getTime());
            if (bucket) {
                bucket.actualMins += (item.actualDuration || 0);
                bucket.plannedMins += (item.plannedDuration || 0);
            }
        });

        // 3. Render
        let barsHtml = '';
        let prevMins = 0; 

        // Find Max Volume (Actual OR Planned) to scale chart correctly
        const maxVol = Math.max(...buckets.map(b => Math.max(b.actualMins, b.plannedMins))) || 1;

        buckets.forEach((b, idx) => {
            const isCurrentWeek = (idx === buckets.length - 1); 
            
            // Value to Display: Use Planned for Current Week, Actual for Past
            const val = isCurrentWeek ? b.plannedMins : b.actualMins;
            const height = Math.round((val / maxVol) * 100);
            
            // 10% Rule Logic
            let barColorClass = 'bg-blue-500'; 
            let barStyle = '';
            
            if (idx > 0 && prevMins > 0) {
                const pctChange = (val - prevMins) / prevMins;
                if (pctChange > 0.15) barColorClass = 'bg-red-500'; 
                else if (pctChange > 0.10) barColorClass = 'bg-yellow-500'; 
                else if (pctChange < -0.20) barColorClass = 'bg-slate-600'; 
                else barColorClass = 'bg-emerald-500'; 
            }

            // Apply "Planned" Styling for Current Week
            if (isCurrentWeek) {
                let baseColor = barColorClass.replace('bg-', '');
                const colorMap = {
                    'emerald-500': '#10b981', 'yellow-500': '#eab308', 
                    'red-500': '#ef4444', 'slate-600': '#475569', 'blue-500': '#3b82f6'
                };
                const hex = colorMap[baseColor] || '#3b82f6';
                
                barColorClass = ''; 
                barStyle = `background: repeating-linear-gradient(45deg, ${hex}, ${hex} 4px, #1e293b 4px, #1e293b 8px); border: 1px solid ${hex};`;
            }

            if (!isCurrentWeek) prevMins = b.actualMins; 

            // FIXED: Removed 'overflow-hidden' from parent div so tooltip can pop out top
            // Added 'group' to parent and 'group-hover' classes for tooltip visibility
            barsHtml += `
                <div class="flex flex-col items-center gap-2 flex-1 group relative">
                    <div class="relative w-full bg-slate-800/50 rounded-t-sm h-48 flex items-end justify-center">
                        
                        <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-xs font-bold text-white px-3 py-1.5 rounded border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl pointer-events-none">
                            ${isCurrentWeek ? 'Plan: ' : ''}${Math.round(val)} min
                            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-slate-600 transform rotate-45"></div>
                        </div>

                        <div style="height: ${height}%; ${barStyle}" class="w-full mx-1 ${barColorClass} opacity-80 hover:opacity-100 transition-all rounded-t-sm"></div>
                    </div>
                    <span class="text-[10px] ${isCurrentWeek ? 'text-white font-bold' : 'text-slate-500'} font-mono text-center leading-none">
                        ${b.label}<br>
                        ${isCurrentWeek ? '<span class="text-[8px] text-blue-400">PLAN</span>' : ''}
                    </span>
                </div>
            `;
        });

        return `
            <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-12">
                <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-2">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-chart-column text-blue-500"></i> Weekly Volume Trend
                    </h2>
                    <div class="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Safe</span>
                        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500"></span> Spike</span>
                        <span class="flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full border border-blue-500" style="background: repeating-linear-gradient(45deg, #3b82f6, #3b82f6 2px, transparent 2px, transparent 4px)"></span> Planned
                        </span>
                    </div>
                </div>
                <div class="flex items-end justify-between gap-2 w-full">${barsHtml}</div>
            </div>
        `;
    } catch (e) {
        return `<div class="p-4 text-red-400">Chart Error: ${e.message}</div>`;
    }
};
