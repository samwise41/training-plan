// js/views/trends/analysis.js

/**
 * Calculates rolling statistics (7d, 30d, 60d) for the adherence chart.
 */
export const getRollingPoints = (data, typeFilter, isCount, timeRange) => {
    const points = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    let weeksBack = 26; 
    if (timeRange === '30d') weeksBack = 4;
    else if (timeRange === '60d') weeksBack = 8;
    else if (timeRange === '90d') weeksBack = 13;
    else if (timeRange === '1y') weeksBack = 52; 

    for (let i = weeksBack; i >= 0; i--) {
        const anchorDate = new Date(today);
        anchorDate.setDate(today.getDate() - (i * 7)); 
        
        const getStats = (days) => {
            const startWindow = new Date(anchorDate);
            startWindow.setDate(anchorDate.getDate() - days);
            let plan = 0; let act = 0;
            data.forEach(d => {
                if (d.date >= startWindow && d.date <= anchorDate) {
                    if (typeFilter !== 'All' && d.type !== typeFilter) return;
                    if (isCount) {
                        if (d.plannedDuration > 0 || d.type === 'Rest') { plan++; if (d.completed) act++; }
                    } else {
                        plan += (d.plannedDuration || 0); act += (d.actualDuration || 0);
                    }
                }
            });
            return plan > 0 ? Math.min(Math.round((act / plan) * 100), 300) : 0; 
        };
        points.push({ 
            label: `${anchorDate.getMonth()+1}/${anchorDate.getDate()}`, 
            val7: getStats(7),
            val30: getStats(30), 
            val60: getStats(60) 
        });
    }
    return points;
};

/**
 * Parses volume caps from the Plan Markdown file.
 */
export const parsePlanLimits = (md, sportType) => {
    const getCap = (keyword) => {
        const regex = new RegExp(`\\*\\*${keyword} Cap:\\*\\*\\s*\\[(\\d+)%\\]`, 'i');
        const match = md.match(regex);
        return match ? parseInt(match[1], 10) / 100 : null;
    };
    const defaults = { 'Run': 0.10, 'Bike': 0.20, 'Swim': 0.20, 'All': 0.15 };
    const limitRed = getCap(sportType) !== null ? getCap(sportType) : (defaults[sportType] || 0.15);
    const limitYellow = Math.max(0, limitRed - 0.05);
    return { limitRed, limitYellow };
};

/**
 * Aggregates data into weekly buckets for the Volume Chart.
 */
export const aggregateVolumeBuckets = (data, sportType) => {
    const buckets = []; 
    const now = new Date(); 
    const day = now.getDay(); 
    const distToSat = 6 - day; 
    const endOfCurrentWeek = new Date(now); 
    endOfCurrentWeek.setDate(now.getDate() + distToSat); 
    endOfCurrentWeek.setHours(23, 59, 59, 999);

    for (let i = 11; i >= 0; i--) {
        const end = new Date(endOfCurrentWeek); 
        end.setDate(end.getDate() - (i * 7)); 
        const start = new Date(end); 
        start.setDate(start.getDate() - 6); 
        start.setHours(0,0,0,0);
        buckets.push({ start, end, label: `${end.getMonth()+1}/${end.getDate()}`, actualMins: 0, plannedMins: 0 });
    }

    data.forEach(item => {
        if (!item.date) return; 
        const t = item.date.getTime(); 
        const bucket = buckets.find(b => t >= b.start.getTime() && t <= b.end.getTime());
        
        if (bucket) { 
            if (sportType === 'All' || item.type === sportType) {
                bucket.plannedMins += (item.plannedDuration || 0); 
            }
            const executedType = item.actualType || item.type;
            if (sportType === 'All' || executedType === sportType) {
                bucket.actualMins += (item.actualDuration || 0);
            }
        }
    });
    return buckets;
};

/**
 * Calculates simple adherence stats (count or duration).
 */
export const calculateStats = (data, targetType, days, isDuration) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const now = new Date(); now.setHours(23, 59, 59, 999);
    
    const subset = data.filter(item => { 
        if (!item || !item.date) return false; 
        return item.date >= cutoff && item.date <= now && (targetType === 'All' || item.type === targetType); 
    });

    let val = 0, target = 0;
    subset.forEach(item => { 
        if (isDuration) { 
            target += (item.plannedDuration || 0); 
            if (item.type === item.actualType) val += (item.actualDuration || 0); 
        } else { 
            target++; 
            if (item.completed) val++; 
        } 
    });
    const pct = target > 0 ? Math.round((val / target) * 100) : 0;
    const label = isDuration 
        ? `${val > 120 ? (val/60).toFixed(1)+'h' : val+'m'}/${target > 120 ? (target/60).toFixed(1)+'h' : target+'m'}` 
        : `${val}/${target}`;
    return { pct, label };
};

/**
 * KPI Tool: Filters and aggregates data based on UI selectors.
 */
export const updateDurationAnalysis = (logData) => {
    const sportSelect = document.getElementById('kpi-sport-select');
    const daySelect = document.getElementById('kpi-day-select');
    const timeSelect = document.getElementById('kpi-time-select');
    
    if (!sportSelect || !daySelect || !timeSelect) return;
    
    const dataToUse = (Array.isArray(logData) && logData.length > 0) ? logData : [];
    const selectedSport = sportSelect.value;
    const selectedDay = daySelect.value;
    const selectedTime = timeSelect.value;
    
    let cutoffDate = null;
    if (selectedTime !== 'All') { 
        const days = parseInt(selectedTime); 
        cutoffDate = new Date(); 
        cutoffDate.setDate(cutoffDate.getDate() - days); 
        cutoffDate.setHours(0, 0, 0, 0); 
    }
    
    let totalPlanned = 0, totalActual = 0, debugRows = '';
    const dayMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    dataToUse.forEach(item => {
        if (!item || !item.date) return;
        if (cutoffDate && item.date < cutoffDate) return;
        
        const itemDayName = dayMap[item.date.getDay()];
        if (selectedSport !== 'All' && item.type !== selectedSport) return;
        if (selectedDay !== 'All') {
            if (selectedDay === 'Weekday' && (item.date.getDay() === 0 || item.date.getDay() === 6)) return;
            if (selectedDay !== 'Weekday' && itemDayName !== selectedDay) return;
        }
        
        totalPlanned += (item.plannedDuration || 0); 
        let thisActual = 0, actualClass = "text-slate-300";
        
        if (item.type === item.actualType) { 
            thisActual = (item.actualDuration || 0); 
            totalActual += thisActual; 
        } else if (item.plannedDuration > 0) { 
            actualClass = "text-red-400 font-bold"; 
        }
        
        debugRows += `<tr class="border-b border-slate-700 hover:bg-slate-800/50"><td class="py-2 px-2 text-xs font-mono text-slate-400">${item.date.toISOString().split('T')[0]}</td><td class="py-2 px-2 text-xs text-slate-300">${itemDayName}</td><td class="py-2 px-2 text-xs text-slate-300">${item.type}</td><td class="py-2 px-2 text-xs text-slate-300 text-center">${item.plannedDuration}m</td><td class="py-2 px-2 text-xs ${actualClass} text-center">${thisActual}m</td></tr>`;
    });

    const debugTableBody = document.querySelector('#kpi-debug-table tbody');
    if (debugTableBody) debugTableBody.innerHTML = debugRows || '<tr><td colspan="5" class="text-center py-4 text-slate-500 italic">No matching records found</td></tr>';
    
    const diff = totalActual - totalPlanned;
    const pct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
    
    const formatTime = (minutes) => { 
        const m = Math.abs(minutes); 
        if (m === 0) return "0m"; 
        const h = Math.floor(m / 60);
        const rem = m % 60; 
        return h > 0 ? `${h}h ${rem}m` : `${rem}m`; 
    };

    if (document.getElementById('kpi-analysis-planned')) {
        document.getElementById('kpi-analysis-planned').innerText = formatTime(totalPlanned);
        document.getElementById('kpi-analysis-actual').innerText = formatTime(totalActual);
        
        const diffEl = document.getElementById('kpi-analysis-diff');
        const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
        diffEl.innerText = sign + formatTime(diff);
        diffEl.className = `text-xl font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
        
        const pctEl = document.getElementById('kpi-analysis-pct');
        pctEl.innerText = `${pct}%`;
        pctEl.className = `text-xl font-bold ${pct >= 80 ? 'text-emerald-400' : (pct >= 50 ? 'text-yellow-400' : 'text-red-400')}`;
    }
};
