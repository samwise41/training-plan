const renderVolumeChart = (data, sportType = 'All', title = 'Weekly Volume Trend') => {
    try {
        if (!data || data.length === 0) return '<div class="p-4 text-slate-500 italic">No data available</div>';
        const buckets = []; const now = new Date(); const day = now.getDay(); const distToSat = 6 - day; const endOfCurrentWeek = new Date(now); endOfCurrentWeek.setDate(now.getDate() + distToSat); endOfCurrentWeek.setHours(23, 59, 59, 999);
        for (let i = 7; i >= 0; i--) {
            const end = new Date(endOfCurrentWeek); end.setDate(end.getDate() - (i * 7)); const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0,0,0,0);
            buckets.push({ start, end, label: `${end.getMonth()+1}/${end.getDate()}`, actualMins: 0, plannedMins: 0 });
        }
        data.forEach(item => {
            if (!item.date) return; if (sportType !== 'All' && item.type !== sportType) return;
            const t = item.date.getTime(); const bucket = buckets.find(b => t >= b.start.getTime() && t <= b.end.getTime());
            if (bucket) { bucket.actualMins += (item.actualDuration || 0); bucket.plannedMins += (item.plannedDuration || 0); }
        });
        
        let barsHtml = ''; 
        const maxVol = Math.max(...buckets.map(b => Math.max(b.actualMins, b.plannedMins))) || 1;
        const sportColorVar = colorMap[sportType] || colorMap.All; 

        buckets.forEach((b, idx) => {
            const isCurrentWeek = (idx === buckets.length - 1); 
            const hActual = Math.round((b.actualMins / maxVol) * 100); 
            const hPlan = Math.round((b.plannedMins / maxVol) * 100); 
            const prevActual = idx > 0 ? buckets[idx - 1].actualMins : 0;
            
            let planColorVar = sportColorVar; 
            let growthLabel = "--"; 
            let growthColor = "text-slate-400";

            if (idx > 0 && prevActual > 0) {
                const planGrowth = (b.plannedMins - prevActual) / prevActual;
                
                // --- UPDATED RISK LIMITS ---
                let limitYellow = 0.15; // Default for 'All'
                let limitRed = 0.20; 

                if (sportType === 'Run') { 
                    limitYellow = 0.10; // Stricter
                    limitRed = 0.15; 
                } else if (sportType === 'Bike' || sportType === 'Swim') {
                    limitYellow = 0.20; // More lenient
                    limitRed = 0.25;
                }
                
                if (planGrowth > limitRed) planColorVar = 'var(--color-danger, #ef4444)';
                else if (planGrowth > limitYellow) planColorVar = 'var(--color-warning, #eab308)';
                
                const displayGrowth = planGrowth; 
                const sign = displayGrowth > 0 ? '▲' : (displayGrowth < 0 ? '▼' : ''); 
                growthLabel = `${sign} ${Math.round(displayGrowth * 100)}%`;
                
                if (displayGrowth > limitRed) growthColor = "text-red-400"; 
                else if (displayGrowth > limitYellow) growthColor = "text-yellow-400"; 
                else if (displayGrowth < -0.20) growthColor = "text-slate-500"; 
                else growthColor = "text-emerald-400";
            }
            
            const planBarStyle = `background: repeating-linear-gradient(45deg, ${planColorVar} 0, ${planColorVar} 4px, transparent 4px, transparent 8px); border: 1px solid ${planColorVar}; opacity: 0.4;`;
            const actualBgStyle = `background-color: ${sportColorVar};`;
            const actualOpacity = isCurrentWeek ? 'opacity-90' : 'opacity-80'; 
            const planHrs = (b.plannedMins / 60).toFixed(1); 
            const actHrs = (b.actualMins / 60).toFixed(1);
            
            barsHtml += `
            <div class="flex flex-col items-center gap-1 flex-1 group relative">
                <div class="relative w-full bg-slate-800/30 rounded-t-sm h-32 flex items-end justify-center">
                    <div class="absolute -top-20 left-1/2 -translate-x-1/2 bg-slate-900 text-xs font-bold text-white px-3 py-2 rounded border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap text-center pointer-events-none shadow-xl">
                        <div class="mb-1 leading-tight">
                            <div>Plan: ${Math.round(b.plannedMins)}m | Act: ${Math.round(b.actualMins)}m</div>
                            <div class="text-[10px] text-slate-400 font-normal mt-0.5">Plan: ${planHrs}h | Act: ${actHrs}h</div>
                        </div>
                        <div class="text-[10px] ${growthColor} border-t border-slate-700 pt-1 mt-1">
                            Plan vs Prev Act: ${growthLabel}
                        </div>
                    </div>
                    <div style="height: ${hPlan}%; ${planBarStyle}" class="absolute bottom-0 w-full rounded-t-sm z-0"></div>
                    <div style="height: ${hActual}%; ${actualBgStyle}" class="relative z-10 w-2/3 ${actualOpacity} rounded-t-sm"></div>
                </div>
                <span class="text-[9px] text-slate-500 font-mono text-center leading-none mt-1">
                    ${b.label}${isCurrentWeek ? '<br><span class="text-[8px] text-blue-400 font-bold">NEXT</span>' : ''}
                </span>
            </div>`;
        });
        
        const iconStyle = `style="color: ${sportColorVar}"`;
        let iconHtml = `<i class="fa-solid fa-chart-column" ${iconStyle}></i>`; 
        if (sportType === 'Bike') iconHtml = `<i class="fa-solid fa-bicycle" ${iconStyle}></i>`; 
        if (sportType === 'Run') iconHtml = `<i class="fa-solid fa-person-running" ${iconStyle}></i>`; 
        if (sportType === 'Swim') iconHtml = `<i class="fa-solid fa-person-swimming" ${iconStyle}></i>`;

        return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 mb-4">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">${iconHtml} ${title}</h3>
            </div>
            <div class="flex items-start justify-between gap-1 w-full">${barsHtml}</div>
        </div>`;
    } catch (e) { return `<div class="p-4 text-red-400">Chart Error: ${e.message}</div>`; }
};
