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
    } catch (e) { return []; }
};

const fetchRunningData = async () => {
    try {
        const res = await fetch('strava_data/running/my_running_prs.md');
        if (!res.ok) return [];
        const text = await res.text();
        return parseRunningMarkdown(text);
    } catch (e) { return []; }
};

const parseRunningMarkdown = (md) => {
    const rows = [];
    // Distances in Miles for calculation
    const distMap = { 
        '400m': 0.248, '1/2 mile': 0.5, '1 mile': 1.0, '2 mile': 2.0, 
        '5k': 3.106, '10k': 6.213, '15k': 9.32, '10 mile': 10.0, 
        '20k': 12.42, 'Half-Marathon': 13.109, '30k': 18.64, 'Marathon': 26.218, '50k': 31.06
    };

    md.split('\n').forEach(line => {
        const cols = line.split('|').map(c => c.trim());
        if (cols.length >= 6 && !line.includes('---') && cols[1] !== 'Distance') {
            const label = cols[1];
            // Find closest distance key
            const distKey = Object.keys(distMap).find(k => label.toLowerCase().includes(k.toLowerCase())) || label;
            const dist = distMap[distKey];
            
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

                // Pace = Minutes per Mile
                const paceAllTime = timeAllTime ? (timeAllTime / 60) / dist : null;
                const pace6Week = time6Week ? (time6Week / 60) / dist : null;

                if (paceAllTime) {
                    rows.push({ label: distKey, dist, paceAllTime, pace6Week });
                }
            }
        }
    });
    return rows.sort((a,b) => a.dist - b.dist);
};

// --- LOG CHART GENERATOR (SVG) ---
const renderLogChart = (data, options) => {
    const { 
        width = 800, height = 300, 
        yLabel = '', 
        colorAll = '#a855f7', color6w = '#22c55e',
        xType = 'time', // 'time' or 'distance'
        showPoints = true // New Option: Toggle dots
    } = options;

    const pad = { t: 30, b: 30, l: 50, r: 20 };
    
    // 1. Calculate Scales
    const xValues = data.map(d => d.x);
    const yValues = data.flatMap(d => [d.yAll, d.y6w]).filter(v => v !== null);

    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    
    let minY = Math.min(...yValues);
    let maxY = Math.max(...yValues);
    // Add buffer to Y
    const buf = (maxY - minY) * 0.1;
    minY = Math.max(0, minY - buf);
    maxY = maxY + buf;

    // Logarithmic X Scale Helper
    const getX = (val) => {
        const logMin = Math.log(minX);
        const logMax = Math.log(maxX);
        const logVal = Math.log(val);
        const pct = (logVal - logMin) / (logMax - logMin);
        return pad.l + pct * (width - pad.l - pad.r);
    };

    // Linear Y Scale Helper
    const getY = (val) => {
        const pct = (val - minY) / (maxY - minY);
        return height - pad.b - (pct * (height - pad.t - pad.b));
    };

    // 2. Generate Grid Lines (Ticks)
    let xTicks = [];
    if (xType === 'time') {
        const timeMarkers = [
            {v: 1, l: '1s'}, {v: 60, l: '1m'}, {v: 300, l: '5m'}, 
            {v: 1200, l: '20m'}, {v: 3600, l: '1h'}, {v: 14400, l: '4h'}
        ];
        xTicks = timeMarkers.filter(m => m.v >= minX && m.v <= maxX);
    } else {
        const distMarkers = [
            {v: 0.248, l: '400m'}, {v: 1.0, l: '1mi'}, {v: 3.106, l: '5k'}, 
            {v: 6.213, l: '10k'}, {v: 13.109, l: 'Half'}, {v: 26.218, l: 'Full'}
        ];
        xTicks = distMarkers.filter(m => m.v >= minX * 0.9 && m.v <= maxX * 1.1);
    }

    let gridHtml = '';
    
    // X-Axis Grid
    xTicks.forEach(tick => {
        const x = getX(tick.v);
        gridHtml += `
            <line x1="${x}" y1="${pad.t}" x2="${x}" y2="${height - pad.b}" stroke="#334155" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />
            <text x="${x}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#94a3b8">${tick.l}</text>
        `;
    });

    // Y-Axis Grid (Generate ~6 lines)
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
        const pct = i / ySteps;
        const val = minY + (pct * (maxY - minY));
        const y = getY(val);
        gridHtml += `
            <line x1="${pad.l}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="#334155" stroke-width="1" opacity="0.3" />
            <text x="${pad.l - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#94a3b8">
                ${xType === 'distance' ? formatPace(val) : Math.round(val)}
            </text>
        `;
    }

    // 3. Generate Paths
    const genPath = (dataset, key) => {
        let d = '';
        dataset.forEach((pt, i) => {
            if (pt[key] === null) return;
            const x = getX(pt.x);
            const y = getY(pt[key]);
            d += (i === 0 || d === '') ? `M ${x} ${y}` : ` L ${x} ${y}`;
        });
        return d;
    };

    const pathAll = genPath(data, 'yAll');
    const path6w = genPath(data, 'y6w');

    // 4. Generate Points (ONLY if showPoints is true)
    let pointsHtml = '';
    if (showPoints) {
        data.forEach(pt => {
            const x = getX(pt.x);
            
            if (pt.yAll !== null) {
                pointsHtml += `
                    <circle cx="${x}" cy="${getY(pt.yAll)}" r="3" fill="#0f172a" stroke="${colorAll}" stroke-width="2">
                        <title>${pt.label || pt.x} - All Time: ${xType==='distance' ? formatPace(pt.yAll) : Math.round(pt.yAll)}</title>
                    </circle>`;
            }
            if (pt.y6w !== null) {
                 pointsHtml += `
                    <circle cx="${x}" cy="${getY(pt.y6w)}" r="3" fill="#0f172a" stroke="${color6w}" stroke-width="2">
                        <title>${pt.label || pt.x} - 6 Week: ${xType==='distance' ? formatPace(pt.y6w) : Math.round(pt.y6w)}</title>
                    </circle>`;
            }
        });
    }

    return `
        <div class="w-full h-full overflow-hidden">
            <svg viewBox="0 0 ${width} ${height}" class="w-full h-full" preserveAspectRatio="none">
                ${gridHtml}
                <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" stroke="#475569" stroke-width="1" />
                
                <path d="${pathAll}" fill="none" stroke="${colorAll}" stroke-width="2" />
                <path d="${path6w}" fill="none" stroke="${color6w}" stroke-width="2" stroke-dasharray="5,5" />
                
                ${pointsHtml}
                
                <g transform="translate(${width - 120}, ${pad.t})">
                    <circle cx="0" cy="0" r="3" fill="${colorAll}" />
                    <text x="10" y="3" font-size="10" fill="#cbd5e1">All Time</text>
                    
                    <circle cx="0" cy="15" r="3" fill="none" stroke="${color6w}" stroke-width="2" />
                    <text x="10" y="18" font-size="10" fill="#cbd5e1">6 Weeks</text>
                </g>
            </svg>
        </div>
    `;
};

// --- HELPERS ---
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

// --- MAIN RENDER ---
export function renderFTP(planMd) {
    const bio = getBiometricsData(planMd);
    
    // Stats HTML
    const gaugeHtml = renderGauge(bio.wkgNum, bio.percent, bio.cat);
    const cyclingStatsHtml = renderCyclingStats(bio);
    const runningStatsHtml = renderRunningStats(bio);
    
    const cyclingChartId = `cycle-chart-${Date.now()}`;
    const runningChartId = `run-chart-${Date.now()}`;

    // Load Charts Async
    (async () => {
        // 1. CYCLING (High Density -> showPoints: false)
        const cyclingData = await fetchCyclingData();
        const cEl = document.getElementById(cyclingChartId);
        if (cEl && cyclingData.length) {
            const chartData = cyclingData.map(d => ({
                x: d.seconds,
                yAll: d.all_time_watts,
                y6w: d.six_week_watts || null
            })).filter(d => d.x >= 1);
            
            cEl.innerHTML = renderLogChart(chartData, { 
                xType: 'time', 
                colorAll: '#a855f7', 
                color6w: '#22c55e',
                yLabel: 'Watts',
                showPoints: false // <--- CLEAN LINE ONLY
            });
        }

        // 2. RUNNING (Discrete PRs -> showPoints: true)
        const runningData = await fetchRunningData();
        const rEl = document.getElementById(runningChartId);
        if (rEl && runningData.length) {
            const chartData = runningData.map(d => ({
                x: d.dist,
                yAll: d.paceAllTime,
                y6w: d.pace6Week || null,
                label: d.label
            }));
            
            rEl.innerHTML = renderLogChart(chartData, { 
                xType: 'distance', 
                colorAll: '#38bdf8', 
                color6w: '#f97316',
                yLabel: 'Pace',
                showPoints: true // <--- KEEP DOTS
            });
        }
    })();

    return `
        <div class="zones-layout grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="flex flex-col gap-6">
                <div class="grid grid-cols-2 gap-4 h-64">
                    <div class="col-span-1 h-full">${gaugeHtml}</div>
                    <div class="col-span-1 h-full">${cyclingStatsHtml}</div>
                </div>
                <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-80 flex flex-col">
                    <div class="flex items-center gap-2 mb-4 border-b border-slate-700 pb-2">
                        <i class="fa-solid fa-bolt text-yellow-500"></i>
                        <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Cycling Power Curve</span>
                    </div>
                    <div id="${cyclingChartId}" class="flex-1 w-full relative min-h-0">
                        <div class="flex items-center justify-center h-full text-slate-500 text-xs italic">Loading...</div>
                    </div>
                </div>
            </div>

            <div class="flex flex-col gap-6">
                <div class="h-64">
                    ${runningStatsHtml}
                </div>
                <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-80 flex flex-col">
                    <div class="flex items-center gap-2 mb-4 border-b border-slate-700 pb-2">
                        <i class="fa-solid fa-stopwatch text-sky-500"></i>
                        <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Running Pace vs Distance</span>
                    </div>
                    <div id="${runningChartId}" class="flex-1 w-full relative min-h-0">
                        <div class="flex items-center justify-center h-full text-slate-500 text-xs italic">Loading...</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- SUB-COMPONENTS ---
const renderGauge = (wkgNum, percent, cat) => `
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

const renderCyclingStats = (bio) => `
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

const renderRunningStats = (bio) => `
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
