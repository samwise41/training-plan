// js/views/zones/components.js
import { fetchPacingData } from './logic.js';

export const renderGauge = (wkgNum, percent, cat) => {
    return `
        <div class="gauge-wrapper" style="margin: 0 auto;">
            <svg viewBox="0 0 300 185" class="gauge-svg">
                <path d="M 30 150 A 120 120 0 0 1 64.1 66.2" fill="none" stroke="#ef4444" stroke-width="24" />
                <path d="M 64.1 66.2 A 120 120 0 0 1 98.3 41.8" fill="none" stroke="#f97316" stroke-width="24" />
                <path d="M 98.3 41.8 A 120 120 0 0 1 182.0 34.4" fill="none" stroke="#22c55e" stroke-width="24" />
                <path d="M 182.0 34.4 A 120 120 0 0 1 249.2 82.6" fill="none" stroke="#3b82f6" stroke-width="24" />
                <path d="M 249.2 82.6 A 120 120 0 0 1 270 150" fill="none" stroke="#a855f7" stroke-width="24" />
                <text x="150" y="135" text-anchor="middle" class="text-4xl font-black fill-white">${wkgNum.toFixed(2)}</text>
                <text x="150" y="160" text-anchor="middle" font-weight="800" fill="${cat.color}">${cat.label.toUpperCase()}</text>
                <g class="gauge-needle" style="transform: rotate(${-90 + (percent * 180)}deg)">
                    <path d="M 147 150 L 150 45 L 153 150 Z" fill="white" />
                    <circle cx="150" cy="150" r="6" fill="white" />
                </g>
            </svg>
        </div>
    `;
};

// --- NEW COMPONENT: Split Cycling Stats ---
export const renderCyclingStats = (bio) => {
    return `
        <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl text-center shadow-lg flex flex-col justify-center h-full">
            <div class="flex items-center justify-center gap-2 mb-2">
                <i class="fa-solid fa-bicycle icon-bike"></i>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cycling FTP</span>
            </div>
            <div class="flex flex-col">
                <span class="text-3xl font-black text-white">${bio.watts > 0 ? bio.watts + ' W' : '--'}</span>
                <span class="text-xs text-slate-400 font-mono mt-1">${bio.wkgNum.toFixed(2)} W/kg</span>
            </div>
        </div>
    `;
};

// --- NEW COMPONENT: Split Running Stats ---
export const renderRunningStats = (bio) => {
    return `
        <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-xl text-center shadow-lg h-full">
            <div class="flex items-center justify-center gap-2 mb-3">
                <i class="fa-solid fa-person-running icon-run"></i>
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Running Profile</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
                <div class="flex flex-col">
                    <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Pace (FTP)</span>
                    <span class="text-lg font-bold text-white leading-none">${bio.runFtp}</span>
                </div>
                <div class="flex flex-col border-l border-slate-700">
                    <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">LTHR</span>
                    <span class="text-lg font-bold text-white leading-none">${bio.lthr}</span>
                </div>
                <div class="flex flex-col border-l border-slate-700">
                    <span class="text-[9px] text-slate-500 font-bold uppercase mb-0.5">5K Est</span>
                    <span class="text-lg font-bold text-white leading-none">${bio.fiveK}</span>
                </div>
            </div>
        </div>
    `;
};

export const renderButton = () => {
    return `
        <div class="text-center mt-12 mb-4 h-20 flex items-center justify-center">
            <button onclick="this.parentElement.innerHTML='<span class=&quot;text-6xl font-black text-emerald-500 animate-bounce block&quot;>67</span>'" 
                    class="px-8 py-3 bg-slate-800 border border-slate-700 rounded-full text-slate-500 hover:text-white hover:border-emerald-500 hover:bg-slate-700 transition-all text-xs uppercase tracking-[0.2em] font-bold shadow-lg">
                PUSH ME
            </button>
        </div>
    `;
};

// --- NEW FUNCTION: Chart Logic ---
export const initPacingChart = async (canvasId) => {
    const data = await fetchPacingData();
    const ctx = document.getElementById(canvasId);
    
    if (!ctx || !data.length) return;

    // Define Distance Order and Values (km)
    const distMap = { 
        '1 km': 1, '1 Mile': 1.61, '5 km': 5, '10 km': 10, 
        'Half Marathon': 21.1, 'Marathon': 42.2 
    };
    
    // Process Data
    const processed = data
        .filter(d => Object.keys(distMap).some(k => d.label.includes(k)))
        .map(d => {
            const key = Object.keys(distMap).find(k => d.label.includes(k));
            const parts = d.value.split(':').map(Number);
            let totalSeconds = 0;
            
            // Handle H:MM:SS or MM:SS
            if (parts.length === 3) totalSeconds = parts[0]*3600 + parts[1]*60 + parts[2];
            else if (parts.length === 2) totalSeconds = parts[0]*60 + parts[1];
            
            // Calculate Pace (sec/km)
            const dist = distMap[key];
            const paceSec = totalSeconds / dist;
            
            return {
                label: key,
                dist: dist,
                pace: paceSec
            };
        })
        .sort((a, b) => a.dist - b.dist);

    if (window.Chart) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: processed.map(d => d.label),
                datasets: [{
                    label: 'Pace (min/km)',
                    data: processed.map(d => d.pace / 60), // decimal minutes
                    borderColor: '#38bdf8', // Light Blue
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#0f172a',
                    pointBorderColor: '#38bdf8',
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        grid: { color: '#334155' },
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
                                return `Pace: ${m}:${s.toString().padStart(2, '0')} /km`;
                            }
                        }
                    }
                }
            }
        });
    }
};
