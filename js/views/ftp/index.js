import { Parser } from '../../parser.js';

// --- CONFIGURATION ---
const CONFIG = {
    WKG_SCALE: { min: 1.0, max: 6.0 },
    CATEGORIES: [
        { threshold: 5.05, label: "Exceptional", color: "#a855f7" }, // Purple
        { threshold: 3.93, label: "Very Good",   color: "#3b82f6" }, // Blue
        { threshold: 2.79, label: "Good",        color: "#22c55e" }, // Green
        { threshold: 2.23, label: "Fair",        color: "#f97316" }, // Orange
        { threshold: 0.00, label: "Untrained",   color: "#ef4444" }  // Red
    ]
};

// --- DATA FETCHING ---
const fetchCurveData = async (type) => {
    const file = type === 'cycling' 
        ? 'strava_data/cycling/power_curve_graph.json' 
        : 'strava_data/running/running_pace_curve.json';
        
    try {
        const res = await fetch(file);
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        console.error(`Error loading ${type} curve:`, e);
        return [];
    }
};

// --- LOGIC ---
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

// --- HELPERS ---
const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds/60)}m`;
    return `${Math.floor(seconds/3600)}h`;
};

const mpsToMinMile = (mps) => {
    if (!mps || mps <= 0) return null;
    return 26.8224 / mps; // Convert m/s to min/mile
};

const formatPace = (val) => {
    const m = Math.floor(val);
    const s = Math.round((val - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// --- CHART GENERATION ---
const initCharts = async () => {
    if (!window.Chart) return;

    // 1. CYCLING POWER CURVE
    const cyclingData = await fetchCurveData('cycling');
    if (cyclingData.length > 0) {
        const ctx = document.getElementById('cyclingPowerChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: cyclingData.map(d => d.seconds),
                    datasets: [
                        {
                            label: 'All Time Best',
                            data: cyclingData.map(d => ({ x: d.seconds, y: d.all_time_watts })),
                            borderColor: '#a855f7', // Purple
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            pointRadius: 0,
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true
                        },
                        {
                            label: 'Last 6 Weeks',
                            data: cyclingData.map(d => ({ x: d.seconds, y: d.six_week_watts || null })),
                            borderColor: '#22c55e', // Green
                            pointRadius: 0,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            tension: 0.3
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
                            ticks: {
                                color: '#94a3b8',
                                callback: (val) => [1, 5, 15, 30, 60, 300, 1200, 3600, 7200, 14400].includes(val) ? formatDuration(val) : ''
                            }
                        },
                        y: {
                            grid: { color: '#334155' },
                            title: { display: true, text: 'Power (Watts)', color: '#94a3b8' },
                            ticks: { color: '#94a3b8' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#cbd5e1' } },
                        tooltip: {
                            callbacks: {
                                title: (items) => formatDuration(items[0].parsed.x),
                                label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}w`
                            }
                        }
                    }
                }
            });
        }
    }

    // 2. RUNNING PACE CURVE
    const runningData = await fetchCurveData('running');
    if (runningData.length > 0) {
        const ctx = document.getElementById('runningPacingChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: runningData.map(d => d.seconds),
                    datasets: [
                        {
                            label: 'All Time Best',
                            data: runningData.map(d => ({ x: d.seconds, y: mpsToMinMile(d.all_time_mps) })),
                            borderColor: '#38bdf8', // Blue
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            pointRadius: 0,
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true
                        },
                        {
                            label: 'Last 6 Weeks',
                            data: runningData.map(d => ({ x: d.seconds, y: mpsToMinMile(d.six_week_mps) })),
                            borderColor: '#f97316', // Orange
                            pointRadius: 0,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            tension: 0.3
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
                            ticks: {
                                color: '#94a3b8',
                                callback: (val) => [1, 5, 15, 30, 60, 300, 1200, 3600, 7200].includes(val) ? formatDuration(val) : ''
                            }
                        },
                        y: {
                            reverse: true, // Lower pace (faster) at top
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
                                title: (items) => formatDuration(items[0].parsed.x),
                                label: (ctx) => `${ctx.dataset.label}: ${formatPace(ctx.parsed.y)} /mi`
                            }
                        }
                    }
                }
            });
        }
    }
};

// --- COMPONENTS ---
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

// --- MAIN EXPORT ---
export function renderFTP(planMd) {
    const bio = getBiometricsData(planMd);
    
    // HTML Generation
    const gaugeHtml = renderGauge(bio.wkgNum, bio.percent, bio.cat);
    const cyclingStatsHtml = renderCyclingStats(bio);
    const runningStatsHtml = renderRunningStats(bio);
    
    // Trigger Chart Init
    setTimeout(initCharts, 100);

    return `
        <div class="zones-layout grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="flex flex-col gap-6">
                <div class="grid grid-cols-2 gap-4 h-64">
                    <div class="col-span-1 h-full">
                        ${gaugeHtml}
                    </div>
                    <div class="col-span-1 h-full">
                        ${cyclingStatsHtml}
                    </div>
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
                        <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Running Pace Curve</span>
                    </div>
                    <div class="flex-1 w-full relative min-h-0">
                        <canvas id="runningPacingChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
}
