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

const fetchPacingData = async () => {
    try {
        const response = await fetch('garmind_data/garmin_records.md');
        if (!response.ok) return [];
        const text = await response.text();
        const records = [];
        
        text.split('\n').forEach(line => {
            if (line.trim().startsWith('|') && !line.includes('---')) {
                const cols = line.split('|').map(c => c.trim());
                if (cols.length > 3 && cols[1] === 'Running') {
                    records.push({ label: cols[2], value: cols[3] });
                }
            }
        });
        return records;
    } catch (e) {
        console.error("Error parsing records:", e);
        return [];
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

const initPacingChart = async (canvasId) => {
    const data = await fetchPacingData();
    const ctx = document.getElementById(canvasId);
    
    if (!ctx || !data.length) return;

    const distMap = { 
        '1 km': 0.621371, 
        '1 Mile': 1.0, 
        '5 km': 3.10686, 
        '10 km': 6.21371, 
        'Half Marathon': 13.1094, 
        'Marathon': 26.2188 
    };
    
    const processed = data
        .filter(d => Object.keys(distMap).some(k => d.label.includes(k)))
        .map(d => {
            const key = Object.keys(distMap).find(k => d.label.includes(k));
            const parts = d.value.split(':').map(Number);
            let totalSeconds = parts.length === 3 ? parts[0]*3600 + parts[1]*60 + parts[2] : parts[0]*60 + parts[1];
            const miles = distMap[key];
            return {
                label: key,
                dist: miles,
                pace: totalSeconds / miles
            };
        })
        .sort((a, b) => a.dist - b.dist);

    if (window.Chart) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: processed.map(d => d.label),
                datasets: [{
                    label: 'Pace (min/mi)',
                    data: processed.map(d => d.pace / 60),
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#0f172a',
                    pointBorderColor: '#38bdf8',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        grid: { color: '#334155' },
                        title: { display: true, text: 'Pace (min/mi)', color: '#94a3b8' },
                        ticks: {
                            color: '#94a3b8',
                            callback: val => {
                                const m = Math.floor(val);
                                const s = Math.round((val - m) * 60);
                                return `${m}:${s.toString().padStart(2, '0')}`;
                            }
                        }
                    },
                    x: {
                        grid: { color: '#334155' },
                        ticks: { color: '#94a3b8' }
                    }
                },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const val = ctx.raw;
                                const m = Math.floor(val);
                                const s = Math.round((val - m) * 60);
                                return `Pace: ${m}:${s.toString().padStart(2, '0')} /mi`;
                            }
                        }
                    }
                }
            }
        });
    }
};

// --- MAIN EXPORT ---
export function renderFTP(planMd) {
    const bio = getBiometricsData(planMd);
    
    // Generate HTML
    const cyclingStatsHtml = renderCyclingStats(bio);
    const gaugeHtml = renderGauge(bio.wkgNum, bio.percent, bio.cat);
    const runningStatsHtml = renderRunningStats(bio);
    
    // Async Chart Init
    setTimeout(() => initPacingChart('runningPacingChart'), 0);

    return `
        <div class="zones-layout grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div class="flex flex-col gap-6">
                <div class="h-72">
                    ${gaugeHtml}
                </div>
                <div class="h-48">
                    ${cyclingStatsHtml}
                </div>
            </div>

            <div class="flex flex-col gap-6">
                <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-lg h-72 flex flex-col">
                    <div class="flex items-center gap-2 mb-2 shrink-0">
                        <i class="fa-solid fa-chart-line text-sky-500"></i>
                        <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Running Pacing</span>
                    </div>
                    <div class="flex-1 w-full relative min-h-0">
                        <canvas id="runningPacingChart"></canvas>
                    </div>
                </div>
                <div class="h-48">
                    ${runningStatsHtml}
                </div>
            </div>

        </div>
    `;
}
