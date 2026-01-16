import { Parser } from '../../parser.js';

// --- CONFIGURATION ---
const CONFIG = {
    WKG_SCALE: { min: 1.0, max: 6.0 },
    CATEGORIES: [
        { threshold: 5.05, label: "Exceptional", color: "#a855f7" },
        { threshold: 3.93, label: "Very Good",   color: "#3b82f6" },
        { threshold: 2.79, label: "Good",        color: "#22c55e" },
        { threshold: 2.23, label: "Fair",        color: "#f97316" },
        { threshold: 0.00, label: "Untrained",   color: "#ef4444" }
    ]
};

// --- DATA FETCHING ---
const fetchCyclingData = async () => {
    try {
        const res = await fetch('strava_data/cycling/power_curve_graph.json');
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        return [];
    }
};

const fetchRunningData = async () => {
    try {
        const res = await fetch('strava_data/running/my_running_prs.md');
        if (!res.ok) return [];
        const text = await res.text();
        return parseRunningMarkdown(text);
    } catch (e) {
        return [];
    }
};

const parseRunningMarkdown = (md) => {
    const rows = [];
    const distMap = { 
        '400m': 0.248, '1/2 mile': 0.5, '1 mile': 1.0, '2 mile': 2.0, 
        '5k': 3.106, '10k': 6.213, '15k': 9.32, '10 mile': 10.0, 
        '20k': 12.42, 'Half-Marathon': 13.109, '30k': 18.64, 'Marathon': 26.218, '50k': 31.06
    };

    md.split('\n').forEach(line => {
        const cols = line.split('|').map(c => c.trim());
        if (cols.length >= 6 && !line.includes('---') && cols[1] !== 'Distance') {
            const label = cols[1];
            const dist = distMap[label] || distMap[Object.keys(distMap).find(k => label.toLowerCase().includes(k.toLowerCase()))];
            
            if (dist) {
                const parseTime = (str) => {
                    if (!str || str === '--') return null;
                    const clean = str.replace(/\*\*/g, '');
                    const parts = clean.split(':').map(Number);
                    if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
                    if (parts.length === 2) return parts[0]*60 + parts[1];
                    return null;
                };

                const timeAllTime = parseTime(cols[2]);
                const time6Week = parseTime(cols[4]);

                const paceAllTime = timeAllTime ? (timeAllTime / 60) / dist : null;
                const pace6Week = time6Week ? (time6Week / 60) / dist : null;

                if (paceAllTime) {
                    rows.push({ label, dist, paceAllTime, pace6Week });
                }
            }
        }
    });
    return rows.sort((a,b) => a.dist - b.dist);
};

// --- HELPERS ---
const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds/60)}m`;
    return `${Math.floor(seconds/3600)}h`;
};

const formatPace = (val) => {
    const m = Math.floor(val);
    const s = Math.round((val - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const getBiometricsData = (planMd) => {
    const bio = Parser.getBiometrics(planMd) || {};
    const watts = bio.watts || 0;
    const weight = bio.weight || 0;
    const lthr = bio.lthr || '--';
    const runFtp = bio.runFtp || '--';
    const fiveK = bio.fiveK || '--';

    const weightKg = weight * 0.453592;
    const wkgNum = weightKg > 0 ? (watts / weightKg) : 0;
    
    const cat = CONFIG.CATEGORIES.find(c => wkgNum >= c.threshold) || CONFIG.CATEGORIES[CONFIG.CATEGORIES.length - 1];
    const percent = Math.min(Math.max((wkgNum - CONFIG.WKG_SCALE.min) / (CONFIG.WKG_SCALE.max - CONFIG.WKG_SCALE.min), 0), 1);

    return { watts, weight, lthr, runFtp, fiveK, wkgNum, cat, percent };
};

// --- CHARTS ---
const initCharts = async () => {
    if (!window.Chart) return;

    // 1. CYCLING CHART
    const cyclingData = await fetchCyclingData();
    if (cyclingData.length > 0) {
        const tickValues = [1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 10800, 14400, 18000, 21600];
        
        const ctx = document.getElementById('cyclingPowerChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: cyclingData.map(d => d.seconds),
                    datasets: [
                        {
                            label: 'All Time',
                            data: cyclingData.map(d => ({ x: d.seconds, y: d.all_time_watts })),
                            borderColor: '#a855f7',
                            borderWidth: 2, pointRadius: 0, tension: 0.1, fill: false
                        },
                        {
                            label: '6 Week',
                            data: cyclingData.map(d => ({ x: d.seconds, y: d.six_week_watts || null })),
                            borderColor: '#22c55e',
                            borderWidth: 2, pointRadius: 0, borderDash: [5, 5], tension: 0.1, fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: {
                            type: 'logarithmic',
                            min: 1, max: 21600,
                            grid: { color: '#334155', drawTicks: true },
                            ticks: {
                                color: '#94a3b8',
                                maxRotation: 0,
                                autoSkip: false,
                                callback: function(val) {
                                    return tickValues.includes(val) ? formatDuration(val) : '';
                                }
                            },
                            afterBuildTicks: (axis) => {
                                axis.ticks = tickValues.map(v => ({ value: v }));
                            }
                        },
                        y: {
                            grid: { color: '#334155' },
                            title: { display: true, text: 'Watts', color: '#94a3b8' },
                            ticks: { color: '#94a3b8' }
                        }
                    },
                    plugins: { legend: { labels: { color: '#cbd5e1' } } }
                }
            });
        }
    }

    // 2. RUNNING CHART
    const runningData = await fetchRunningData();
    if (runningData.length > 0) {
        const ctx = document.getElementById('runningPacingChart');
        // Extract the exact distances we want to show
        const runningTicks = runningData.map(d => d.dist);

        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: runningData.map(d => d.label), 
                    datasets: [
                        {
                            label: 'All Time',
                            data: runningData.map(d => ({ x: d.dist, y: d.paceAllTime })),
                            borderColor: '#38bdf8',
                            borderWidth: 2, pointRadius: 4, tension: 0.3, fill: false
                        },
                        {
                            label: '6 Week',
                            data: runningData.map(d => ({ x: d.dist, y: d.pace6Week })),
                            borderColor: '#f97316',
                            borderWidth: 2, pointRadius: 4, borderDash: [5, 5], tension: 0.3, fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: {
                            type: 'logarithmic',
                            grid: { color: '#334155' },
                            title: { display: true, text: 'Distance', color: '#94a3b8' },
                            ticks: {
                                color: '#94a3b8',
                                autoSkip: false,
                                maxRotation: 45,
                                minRotation: 45,
                                callback: function(val) {
                                    // Only show label if val is extremely close to a data point
                                    const match = runningData.find(d => Math.abs(d.dist - val) < 0.001);
                                    return match ? match.label : '';
                                }
                            },
                            // Strict tick generation prevents duplicates
                            afterBuildTicks: (axis) => {
                                axis.ticks = runningTicks.map(v => ({ value: v }));
                            }
                        },
                        y: {
                            grid: { color: '#334155' },
                            title: { display: true, text: 'Pace (min/mi)', color: '#94a3b8' },
                            ticks: {
                                color: '#94a3b8',
                                callback: (val) => formatPace(val)
                            }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#cbd5e1' } },
                        tooltip: {
                            callbacks: {
                                title: (items) => {
                                    const idx = items[0].dataIndex;
                                    return runningData[idx].label;
                                },
                                label: (ctx) => `${ctx.dataset.label}: ${formatPace(ctx.parsed.y)} /mi`
                            }
                        }
                    }
                }
            });
        }
    }
};

// --- RENDER ---
const renderGauge = (wkgNum, percent, cat) => {
    return `
        <div class="gauge-wrapper w-full h-full flex items-center justify-center p-4 bg-slate-800/50 border border-slate-700 rounded-xl shadow-lg relative overflow-hidden">
            <svg viewBox="0 0 300 160" class="gauge-svg w-full h-full max-h-[220px]" preserveAspectRatio="xMidYMid meet">
                <path d="M 30 150 A 120 120 0 0 1 64.1 66.2" fill="none" stroke="#ef4444" stroke-width="24" />
                <path d="M 64.1 66.2 A 120 120 0 0 1 98.3 41.8" fill="none" stroke="#f97316" stroke-width="24" />
                <path d="M 98.3 41.8 A 120 120 0 0 1 182.0 34.4" fill="none" stroke="#22c55e" stroke-width="24" />
                <path d="M 182.0 34.4 A 120 120 0 0 1 249.2 82.6" fill="none" stroke="#3b82f6" stroke-width="24" />
                <path d="M 249.2 82.6 A 120 120 0 0 1 270 150" fill="none" stroke="#a855f7" stroke-width="24" />
                <text x="150" y="130" text-anchor="middle" class="text-5xl font-black fill-white">${wkgNum.toFixed(2)}</text>
                <text x="150" y="155" text-anchor="middle" font-weight="800" fill="${cat.color}" style="font-size: 14px; letter-spacing: 1px;">${cat.label.toUpperCase()}</text>
                <g class="gauge-needle" style="transform-origin: 150px 150px; transform: rotate(${-90 + (percent * 180)}deg)">
                    <path d="M 147 150 L 150 40 L 153 150 Z" fill="white" />
                    <circle cx="150" cy="150" r="6" fill="white" />
                </g>
            </svg>
        </div>
    `;
};

const renderCyclingStats = (bio) => {
    return `
        <div class="bg-slate-800/50 border border-slate-700 p-6 rounded-xl text-center shadow-lg flex flex-col justify-center h-full">
            <div class="flex items-center justify-center gap-2 mb-2">
                <i class="fa-solid fa-bicycle icon-bike text-2xl"></i>
                <span class="text-sm font-bold text-slate-500 uppercase tracking-widest">Cycling FTP</span>
            </div>
            <div class="flex flex-col mt-2">
                <span class="text-5xl font-black text-white">${bio.watts > 0 ? bio.watts + ' W' : '--'}</span>
                <span class="text-sm text-slate-400 font-mono mt-2">${bio.wkgNum.toFixed(2)} W/kg</span>
            </div>
        </div>
    `;
};

const renderRunningStats = (bio) => {
    return `
        <div class="bg-slate-800/50 border border-slate-700 p-6 rounded-xl text-center shadow-lg h-full flex flex-col justify-center">
            <div class="flex items-center justify-center gap-2 mb-6">
                <i class="fa-solid fa-person-running icon-run text-xl"></i>
                <span class="text-xs font-bold text-slate-500 uppercase tracking-widest">Running Profile</span>
            </div>
            <div class="grid grid-cols-3 gap-4">
                <div class="flex flex-col">
                    <span class="text-[10px] text-slate-500 font-bold uppercase mb-1">Pace (FTP)</span>
                    <span class="text-xl font-bold text-white leading-none">${bio.runFtp}</span>
                </div>
                <div class="flex flex-col border-l border-slate-700 pl-4">
                    <span class="text-[10px] text-slate-500 font-bold uppercase mb-1">LTHR</span>
                    <span class="text-xl font-bold text-white leading-none">${bio.lthr}</span>
                </div>
                <div class="flex flex-col border-l border-slate-700 pl-4">
                    <span class="text-[10px] text-slate-500 font-bold uppercase mb-1">5K Est</span>
                    <span class="text-xl font-bold text-white leading-none">${bio.fiveK}</span>
                </div>
            </div>
        </div>
    `;
};

export function renderFTP(planMd) {
    const bio = getBiometricsData(planMd);
    
    // Generate HTML
    const gaugeHtml = renderGauge(bio.wkgNum, bio.percent, bio.cat);
    const cyclingStatsHtml = renderCyclingStats(bio);
    const runningStatsHtml = renderRunningStats(bio);
    
    // Initialize charts after render
    setTimeout(initCharts, 200);

    return `
        <div class="zones-layout grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="flex flex-col gap-6">
                <div class="grid grid-cols-2 gap-4 h-64">
                    <div class="col-span-1 h-full">${gaugeHtml}</div>
                    <div class="col-span-1 h-full">${cyclingStatsHtml}</div>
                </div>
                <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-lg h-80 flex flex-col">
                    <div class="flex items-center gap-2 mb-2 shrink-0">
                        <i class="fa-solid fa-bolt text-yellow-500"></i>
                        <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Cycling Power Curve</span>
                    </div>
                    <div class="flex-1 w-full relative min-h-0">
                        <canvas id="cyclingPowerChart"></canvas>
                    </div>
                </div>
            </div>

            <div class="flex flex-col gap-6">
                <div class="h-64">
                    ${runningStatsHtml}
                </div>
                <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-lg h-80 flex flex-col">
                    <div class="flex items-center gap-2 mb-2 shrink-0">
                        <i class="fa-solid fa-stopwatch text-sky-500"></i>
                        <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Running Pace vs Distance</span>
                    </div>
                    <div class="flex-1 w-full relative min-h-0">
                        <canvas id="runningPacingChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
}
