// js/views/readiness.js

export function renderReadiness(logData, planMd) {
    // 1. Find the next event from the markdown
    const eventLines = (planMd.match(/\| \d{4}-\d{2}-\d{2} \| [^|]+ \|/g) || [])
        .filter(l => !l.includes('---') && !l.toLowerCase().includes('date'));
    
    let nextEvent = { name: "No Event Scheduled", date: null, daysLeft: 0 };
    
    if (eventLines.length > 0) {
        const parts = eventLines[0].split('|').map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
            const d = new Date(parts[0]);
            const today = new Date();
            today.setHours(0,0,0,0);
            const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
            nextEvent = { name: parts[1], date: d, daysLeft: diff };
        }
    }

    // 2. Calculate Consistency (Last 4 Weeks)
    const today = new Date();
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(today.getDate() - 28);
    
    const recentLogs = logData.filter(entry => {
        const d = new Date(entry.date);
        return d >= fourWeeksAgo && d <= today;
    });

    const completed = recentLogs.filter(l => l.completed).length;
    // Estimate consistency: if you log completed workouts, you are consistent.
    // If we assume ~4 workouts/week is "perfect" (16 total), we can gauge it.
    // Or simpler: count "green" (completed) vs "red" (missed) if your parser captures missed.
    // Here we'll use a simple heuristic based on volume vs arbitrary target if 'planned' isn't fully parsed.
    // Assuming the log contains both completed and skipped if parsed that way.
    const totalLogged = recentLogs.length || 1; 
    const consistencyScore = Math.round((completed / totalLogged) * 100) || 0;

    // 3. Longest Session (Last 8 weeks)
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(today.getDate() - 56);
    
    const longLogs = logData.filter(entry => {
        const d = new Date(entry.date);
        return d >= eightWeeksAgo && d <= today;
    });

    // Parse duration "1h 30m" -> minutes
    const parseDur = (str) => {
        if(!str) return 0;
        let m = 0;
        if(str.includes('h')) m += parseInt(str.split('h')[0]) * 60;
        if(str.includes('m')) m += parseInt(str.split('m')[0].split(' ').pop());
        return m;
    };

    let longestMin = 0;
    longLogs.forEach(l => {
        const dur = parseDur(l.duration);
        if (dur > longestMin) longestMin = dur;
    });
    
    const longestHrs = Math.floor(longestMin / 60);
    const longestMinsRemainder = longestMin % 60;
    const longestStr = `${longestHrs}h ${longestMinsRemainder}m`;

    return `
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-2xl font-bold text-white">Race Readiness</h2>
                    <p class="text-slate-400 text-sm">Event Prep Analysis</p>
                </div>
                <div class="text-right">
                    <div class="text-xl font-bold text-emerald-400">${nextEvent.name}</div>
                    <div class="text-sm text-slate-400">${nextEvent.daysLeft} days to go</div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <i class="fa-solid fa-calendar-check"></i>
                        </div>
                        <h3 class="font-bold text-slate-300">Consistency (4w)</h3>
                    </div>
                    <div class="text-3xl font-bold text-white">${consistencyScore}%</div>
                    <p class="text-xs text-slate-500 mt-1">Workouts completed vs logged</p>
                </div>

                <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                            <i class="fa-solid fa-stopwatch"></i>
                        </div>
                        <h3 class="font-bold text-slate-300">Longest Session</h3>
                    </div>
                    <div class="text-3xl font-bold text-white">${longestStr}</div>
                    <p class="text-xs text-slate-500 mt-1">Peak duration (Last 8w)</p>
                </div>

                <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                            <i class="fa-solid fa-battery-full"></i>
                        </div>
                        <h3 class="font-bold text-slate-300">Taper Status</h3>
                    </div>
                    <div class="text-3xl font-bold text-white">
                        ${nextEvent.daysLeft <= 14 && nextEvent.daysLeft >= 0 ? 'Active' : 'Building'}
                    </div>
                    <p class="text-xs text-slate-500 mt-1">Based on event proximity</p>
                </div>
            </div>

            <div class="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 class="text-lg font-bold text-white mb-4">Volume Trend (Last 12 Weeks)</h3>
                <div class="h-64 relative w-full">
                    <canvas id="readinessChart"></canvas>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 class="font-bold text-white mb-4"><i class="fa-solid fa-list-check mr-2 text-blue-500"></i>Pre-Race Checklist</h3>
                    <ul class="space-y-3">
                        <li class="flex items-center gap-3 text-slate-300">
                            <i class="fa-regular fa-square text-slate-500"></i>
                            <span>Bike Service / Tune-up</span>
                        </li>
                        <li class="flex items-center gap-3 text-slate-300">
                            <i class="fa-regular fa-square text-slate-500"></i>
                            <span>Nutrition Plan Finalized</span>
                        </li>
                        <li class="flex items-center gap-3 text-slate-300">
                            <i class="fa-regular fa-square text-slate-500"></i>
                            <span>Race Route Downloaded</span>
                        </li>
                        <li class="flex items-center gap-3 text-slate-300">
                            <i class="fa-regular fa-square text-slate-500"></i>
                            <span>Kit & Weather Check</span>
                        </li>
                    </ul>
                </div>

                <div class="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 class="font-bold text-white mb-4"><i class="fa-solid fa-bolt mr-2 text-yellow-500"></i>Readiness Assessment</h3>
                    <div class="text-sm text-slate-400">
                        <p class="mb-2">Based on your recent consistency of <strong>${consistencyScore}%</strong> and peak volume of <strong>${longestStr}</strong>:</p>
                        <div class="p-3 bg-slate-900/50 rounded border border-slate-700 text-slate-300 italic">
                            "${consistencyScore > 80 ? 'You are showing strong consistency. Trust your training.' : 'Consistency has been variable. Focus on rest and mental prep now.'}"
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function renderReadinessChart(logData) {
    const ctx = document.getElementById('readinessChart');
    if (!ctx) return;

    // Helper to parse duration
    const parseDur = (str) => {
        if(!str) return 0;
        let m = 0;
        if(str.includes('h')) m += parseInt(str.split('h')[0]) * 60;
        if(str.includes('m')) m += parseInt(str.split('m')[0].split(' ').pop());
        return m;
    };

    // Aggregate by Week (Last 12 weeks)
    const weeks = {};
    const today = new Date();
    
    // Initialize last 12 weeks
    for(let i=11; i>=0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - (i*7));
        const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
        weeks[weekKey] = { label: `Week -${i}`, volume: 0 };
    }

    logData.forEach(entry => {
        const d = new Date(entry.date);
        const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
        if (weeks[weekKey]) {
            weeks[weekKey].volume += parseDur(entry.duration);
        }
    });

    const labels = Object.values(weeks).map(w => w.label);
    const dataPoints = Object.values(weeks).map(w => Math.round(w.volume / 60)); // Hours

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Weekly Volume (Hours)',
                data: dataPoints,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}
