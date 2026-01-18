// js/views/dashboard/heatmaps.js
import { getSportColorVar } from './utils.js';

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

export function renderHeatmaps(fullLogData, planMd) {
    if (!fullLogData || fullLogData.length === 0) return '<p class="text-slate-500 italic">No data for heatmaps.</p>';

    // 1. Prepare Data Buckets
    // Map: "Year-Week" -> Array[7] of { dur: 0, sports: Set, details: [] }
    const heatMap = {};
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    fullLogData.forEach(item => {
        if (!item.date) return;
        const d = new Date(item.date);
        
        // Filter: Last 365 days only
        if (d < oneYearAgo) return;

        const year = d.getFullYear();
        const week = getWeekNumber(d);
        const day = (d.getDay() + 6) % 7; // Shift so 0=Mon, 6=Sun
        
        const key = `${year}-${week}`;
        if (!heatMap[key]) heatMap[key] = Array(7).fill(null);

        if (!heatMap[key][day]) heatMap[key][day] = { dur: 0, sports: new Set(), details: [] };
        
        const entry = heatMap[key][day];
        const dur = item.actualDuration || 0;
        
        if (dur > 0) {
            entry.dur += dur;
            
            // --- DETECT SPORT (Strict Database Logic) ---
            // FIX: Stop guessing from the name! Use the DB field.
            let sport = item.actualType || item.type || 'Other';
            
            // Normalize
            if (sport === 'Running') sport = 'Run';
            if (sport === 'Cycling') sport = 'Bike';
            if (sport === 'Swimming') sport = 'Swim';
            
            entry.sports.add(sport);
            
            entry.details.push({
                name: item.actualWorkout || item.plannedWorkout || "Workout",
                val: dur,
                sport: sport
            });
        }
    });

    // 2. Render Grid
    const sortedKeys = Object.keys(heatMap).sort((a,b) => {
        const [y1, w1] = a.split('-').map(Number);
        const [y2, w2] = b.split('-').map(Number);
        return (y1 === y2) ? w2 - w1 : y2 - y1; // Descending (Newest first)
    });

    // Limit to last 20 weeks to fit screen
    const displayKeys = sortedKeys.slice(0, 20);

    let html = `
    <div class="mb-8">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Consistency Heatmap (Last 20 Weeks)</h3>
        <div class="flex flex-col gap-1">
            <div class="flex gap-1 mb-1">
                <div class="w-8 text-[9px] text-slate-500 text-right pr-2">Wk</div>
                <div class="flex-1 grid grid-cols-7 gap-1 text-[9px] text-slate-500 text-center uppercase">
                    <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
                </div>
            </div>
    `;

    displayKeys.forEach(key => {
        const weekArr = heatMap[key];
        const [yr, wk] = key.split('-');
        
        let rowHtml = `<div class="flex gap-1 h-6">
            <div class="w-8 text-[9px] text-slate-600 font-mono text-right pr-2 pt-1">#${wk}</div>
            <div class="flex-1 grid grid-cols-7 gap-1">`;
            
        for (let i=0; i<7; i++) {
            const data = weekArr ? weekArr[i] : null;
            
            if (!data) {
                rowHtml += `<div class="bg-slate-800/50 rounded-sm"></div>`;
            } else {
                // Color Logic
                let bgClass = "bg-slate-700";
                const dur = data.dur;
                const sports = Array.from(data.sports);
                
                // Opacity based on duration
                let opacity = 0.4;
                if (dur > 30) opacity = 0.6;
                if (dur > 60) opacity = 0.8;
                if (dur > 90) opacity = 1.0;
                
                // Color based on sport
                let colorVar = "var(--color-other)";
                if (sports.length === 1) {
                    if (sports[0] === 'Run') colorVar = "var(--color-run)";
                    else if (sports[0] === 'Bike') colorVar = "var(--color-bike)";
                    else if (sports[0] === 'Swim') colorVar = "var(--color-swim)";
                } else if (sports.length > 1) {
                    colorVar = "#e2e8f0"; // Multi-sport day (White/Grey)
                    opacity = 0.9;
                }

                const dateStr = `Week ${wk}, Day ${i+1}`; 
                
                // Generate Tooltip Content
                const tipLabel = data.details.map(d => `${d.sport}: ${Math.round(d.val)}m`).join(', ');
                const cleanTip = tipLabel.replace(/"/g, '&quot;');

                rowHtml += `
                <div class="rounded-sm relative group cursor-pointer transition-all hover:ring-1 hover:ring-white hover:z-10"
                     style="background-color: ${colorVar}; opacity: ${opacity};"
                     onclick="window.showDashboardTooltip(event, '${dateStr}', 0, ${Math.round(dur)}, 'Completed', '${colorVar}', '${sports.join('+')}', '${cleanTip}')"
                ></div>`;
            }
        }
        rowHtml += `</div></div>`;
        html += rowHtml;
    });

    html += `</div></div>`;
    return html;
}
