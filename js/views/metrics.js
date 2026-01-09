// js/views/metrics.js

// --- STATE MANAGEMENT ---
let metricsState = { timeRange: '6m' };
let cachedData = [];

// --- SPORT ID CONSTANTS (Matches Python Script) ---
const SPORT_IDS = {
    RUN: [1],      // Running, Trail, Treadmill
    BIKE: [2],     // Cycling, Indoor, Gravel, MTB
    SWIM: [5, 26, 18] // Lap Swim (5), Open Water (26), Multisport Swim (18)
};

// --- HELPER: ROBUST SPORT CHECK ---
const checkSport = (activity, sportKey) => {
    // 1. Try ID Match (Most Robust)
    const typeId = activity.activityType ? activity.activityType.typeId : null;
    const parentId = activity.activityType ? activity.activityType.parentTypeId : null;
    
    if (SPORT_IDS[sportKey].includes(typeId) || SPORT_IDS[sportKey].includes(parentId)) {
        return true;
    }

    // 2. Fallback: String Match (Safety Net)
    // Sometimes cachedData has a simplified 'actualType' field from preprocessing
    if (activity.actualType && activity.actualType.toUpperCase() === sportKey) {
        return true;
    }
    
    return false;
};

// --- GLOBAL TOGGLE & SCROLL HELPERS ---
if (!window.toggleSection) {
    window.toggleSection = (id) => {
        const content = document.getElementById(id);
        if (!content) return;
        const header = content.previousElementSibling;
        const icon = header.querySelector('i.fa-caret-down');
        const isCollapsed = content.classList.contains('max-h-0');

        if (isCollapsed) {
            content.classList.remove('max-h-0', 'opacity-0', 'py-0', 'mb-0');
            content.classList.add('max-h-[5000px]', 'opacity-100', 'py-4', 'mb-8'); 
            if (icon) { icon.classList.add('rotate-0'); icon.classList.remove('-rotate-90'); }
        } else {
            content.classList.add('max-h-0', 'opacity-0', 'py-0', 'mb-0');
            content.classList.remove('max-h-[5000px]', 'opacity-100', 'py-4', 'mb-8');
            if (icon) { icon.classList.remove('rotate-0'); icon.classList.add('-rotate-90'); }
        }
    };
}

window.scrollToMetric = (key) => {
    const sectionId = 'metrics-charts-section';
    const chartId = `metric-chart-${key}`;
    const section = document.getElementById(sectionId);
    
    if (section && section.classList.contains('max-h-0')) {
        window.toggleSection(sectionId);
        setTimeout(() => performScroll(chartId), 300);
    } else {
        performScroll(chartId);
    }
};

const performScroll = (id) => {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;
    
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    const card = wrapper.firstElementChild;
    if (card) {
        card.classList.remove('bg-slate-800/30'); 
        card.classList.add('bg-slate-800', 'ring-2', 'ring-inset', 'ring-blue-500', 'shadow-lg', 'shadow-blue-900/50', 'transition-all', 'duration-500');
        
        setTimeout(() => {
            card.classList.remove('bg-slate-800', 'ring-2', 'ring-inset', 'ring-blue-500', 'shadow-lg', 'shadow-blue-900/50');
            card.classList.add('bg-slate-800/30'); 
        }, 1500);
    }
};

const buildCollapsibleSection = (id, title, contentHtml, isOpen = true) => {
    const contentClasses = isOpen ? "max-h-[5000px] opacity-100 py-4 mb-8" : "max-h-0 opacity-0 py-0 mb-0";
    const iconClasses = isOpen ? "rotate-0" : "-rotate-90";
    return `
        <div class="w-full">
            <div class="flex items-center gap-2 cursor-pointer py-3 border-b-2 border-slate-700 hover:border-slate-500 transition-colors group select-none" onclick="window.toggleSection('${id}')">
                <i class="fa-solid fa-caret-down text-slate-400 text-base transition-transform duration-300 group-hover:text-white ${iconClasses}"></i>
                <h2 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">${title}</h2>
            </div>
            <div id="${id}" class="collapsible-content overflow-hidden transition-all duration-500 ease-in-out ${contentClasses}">
                ${contentHtml}
            </div>
        </div>
    `;
};

// --- TOOLTIP STATE MANAGER ---
let activeTooltips = { data: null, static: null };
let tooltipTimers = { data: null, static: null };

const closeTooltip = (channel) => {
    if (channel === 'all') { closeTooltip('data'); closeTooltip('static'); return; }
    const active = activeTooltips[channel];
    if (active) {
        const el = document.getElementById(active.id);
        if (el) { el.classList.add('opacity-0', 'pointer-events-none'); el.innerHTML = ''; }
        activeTooltips[channel] = null;
        if (tooltipTimers[channel]) clearTimeout(tooltipTimers[channel]);
    }
};

const manageTooltip = (evt, id, contentHTML, channel) => {
    evt.stopPropagation(); 
    const triggerEl = evt.target;

    if (activeTooltips[channel] && activeTooltips[channel].trigger === triggerEl) {
        closeTooltip(channel);
        return;
    }
    
    closeTooltip(channel);

    const tooltip = document.getElementById(id);
    if (!tooltip) return;

    tooltip.innerHTML = contentHTML;
    tooltip.classList.remove('opacity-0', 'pointer-events-none');

    const x = evt.pageX;
    const y = evt.pageY;
    const viewportWidth = window.innerWidth;

    if (x > viewportWidth * 0.6) {
        tooltip.style.right = `${viewportWidth - x + 10}px`; tooltip.style.left = 'auto';
    } else {
        tooltip.style.left = `${x + 10}px`; tooltip.style.right = 'auto';
    }
    
    let topPos = channel === 'data' ? y - tooltip.offsetHeight - 20 : y + 25;
    const otherChannel = channel === 'data' ? 'static' : 'data';
    const otherActive = activeTooltips[otherChannel];
    
    if (otherActive) {
        const otherEl = document.getElementById(otherActive.id);
        if (otherEl && !otherEl.classList.contains('opacity-0')) {
            const r2 = otherEl.getBoundingClientRect();
            if (channel === 'static' && (y - r2.bottom < 50)) {
                topPos = Math.max(topPos, r2.bottom + window.scrollY + 10);
            }
        }
    }
    tooltip.style.top = `${topPos}px`;

    activeTooltips[channel] = { id, trigger: triggerEl };
    if (tooltipTimers[channel]) clearTimeout(tooltipTimers[channel]);
    tooltipTimers[channel] = setTimeout(() => closeTooltip(channel), 15000);
};

window.addEventListener('click', (e) => {
    ['data', 'static'].forEach(channel => {
        const active = activeTooltips[channel];
        if (active) {
            const tooltipEl = document.getElementById(active.id);
            if (tooltipEl && tooltipEl.contains(e.target)) { closeTooltip(channel); return; }
            if (e.target !== active.trigger) closeTooltip(channel);
        }
    });
});

window.toggleMetricsTime = (range) => {
    metricsState.timeRange = range;
    updateMetricsCharts();
};

window.hideMetricTooltip = () => { closeTooltip('all'); };

// --- DEFINITIONS ---
const METRIC_DEFINITIONS = {
    endurance: {
        title: "Aerobic Efficiency", sport: "Bike", icon: "fa-heart-pulse", colorVar: "var(--color-bike)",
        refMin: 1.30, refMax: 1.70, invertRanges: false, rangeInfo: "1.30 – 1.70 EF",
        description: "Watts produced per heartbeat. Rising values mean your engine is getting more efficient.",
        improvement: "• Long Z2 Rides<br>• Consistent Volume"
    },
    strength: {
        title: "Torque Efficiency", sport: "Bike", icon: "fa-bolt", colorVar: "var(--color-bike)",
        refMin: 2.5, refMax: 3.5, invertRanges: false, rangeInfo: "2.5 – 3.5 W/RPM",
        description: "Watts per Revolution. High values indicate strong muscular force application.",
        improvement: "• Low Cadence Intervals (50-60 RPM)<br>• Seated Climbing"
    },
    run: {
        title: "Running Economy", sport: "Run", icon: "fa-gauge-high", colorVar: "var(--color-run)",
        refMin: 1.0, refMax: 1.6, invertRanges: false, rangeInfo: "1.0 – 1.6 m/beat",
        description: "Distance traveled per heartbeat. Higher is better.",
        improvement: "• Strides & Hill Sprints<br>• Plyometrics"
    },
    mechanical: {
        title: "Mechanical Stiffness", sport: "Run", icon: "fa-ruler-horizontal", colorVar: "var(--color-run)",
        refMin: 0.75, refMax: 0.95, invertRanges: false, rangeInfo: "0.75 – 0.95 Ratio",
        description: "Ratio of Speed vs. Power. Indicates conversion of power to forward motion.",
        improvement: "• High Cadence (170+)<br>• Form Drills (A-Skips)"
    },
    swim: {
        title: "Swim Efficiency", sport: "Swim", icon: "fa-person-swimming", colorVar: "var(--color-swim)",
        refMin: 0.3, refMax: 0.6, invertRanges: false, rangeInfo: "0.3 – 0.6 m/beat",
        description: "Distance traveled per heartbeat in water. Measures stroke efficiency relative to cardiac cost.",
        improvement: "• Drills (Catch/Pull)<br>• Long Steady Swims"
    },
    gct: {
        title: "Ground Contact Time", sport: "Run", icon: "fa-stopwatch", colorVar: "var(--color-run)",
        refMin: 220, refMax: 260, invertRanges: true, rangeInfo: "< 260 ms",
        description: "Time spent on the ground. Lower is better (more elastic).",
        improvement: "• Increase Cadence<br>• 'Hot Coals' Imagery"
    },
    vert: {
        title: "Vertical Oscillation", sport: "Run", icon: "fa-arrows-up-down", colorVar: "var(--color-run)",
        refMin: 6.0, refMax: 9.0, invertRanges: true, rangeInfo: "6.0 – 9.0 cm",
        description: "Vertical bounce. Lower is usually more efficient.",
        improvement: "• Core Stability<br>• Hill Repeats"
    },
    vo2max: {
        title: "VO₂ Max Trend", sport: "All", icon: "fa-lungs", colorVar: "var(--color-all)",
        refMin: 45, refMax: 60, invertRanges: false, rangeInfo: "45 – 60+",
        description: "Aerobic ceiling. Upward trend = engine growth.",
        improvement: "• VO2 Max Intervals<br>• Consistency"
    },
    tss: {
        title: "Weekly TSS Load", sport: "All", icon: "fa-layer-group", colorVar: "var(--color-all)",
        refMin: 300, refMax: 600, invertRanges: false, rangeInfo: "300 – 600 TSS",
        description: "Total physiological load.",
        improvement: "• Increase Volume<br>• Increase Intensity"
    },
    anaerobic: {
        title: "Anaerobic Impact", sport: "All", icon: "fa-fire", colorVar: "var(--color-all)",
        refMin: 2.0, refMax: 4.0, invertRanges: false, rangeInfo: "2.0 – 4.0",
        description: "Intensity stimulus on hard days.",
        improvement: "• All-out Sprints<br>• Full Recovery"
    }
};

window.showAnalysisTooltip = (evt, key) => {
    const def = METRIC_DEFINITIONS[key];
    const rangeColor = def.invertRanges ? "bg-gradient-to-r from-emerald-500 to-red-500" : "bg-gradient-to-r from-red-500 to-emerald-500";
    const html = `
        <div class="w-[280px] space-y-3 cursor-pointer">
            <div class="flex items-center gap-2 border-b border-slate-700 pb-2">
                <i class="fa-solid ${def.icon} text-lg" style="color: ${def.colorVar}"></i>
                <div>
                    <h4 class="text-white font-bold text-sm leading-none">${def.title}</h4>
                    <span class="text-[10px] text-slate-400 font-mono">${def.sport.toUpperCase()} METRIC</span>
                </div>
            </div>
            <div class="text-xs text-slate-300 leading-relaxed">${def.description}</div>
            <div class="bg-slate-800/50 rounded p-2 border border-slate-700">
                <div class="flex justify-between items-end mb-1">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Target Range</span>
                    <span class="text-xs font-mono font-bold text-emerald-400">${def.rangeInfo}</span>
                </div>
                <div class="h-1.5 w-full rounded-full ${rangeColor} opacity-80"></div>
                <div class="flex justify-between text-[8px] text-slate-500 mt-1 font-mono">
                    <span>${def.invertRanges ? "Low (Good)" : "Floor"}</span>
                    <span>${def.invertRanges ? "High (Bad)" : "Ceiling"}</span>
                </div>
            </div>
            <div>
                <span class="text-[10px] font-bold text-blue-400 uppercase tracking-wide">How to Improve</span>
                <div class="text-[11px] text-slate-400 mt-1 pl-2 border-l-2 border-blue-500/30">${def.improvement}</div>
            </div>
            <div class="text-[9px] text-slate-600 text-center pt-1 italic">Click to close</div>
        </div>`;
    manageTooltip(evt, 'metric-info-popup', html, 'static');
};

window.showMetricTooltip = (evt, date, name, val, unitLabel, breakdown, colorVar) => {
    const html = `
        <div class="text-center min-w-[100px] cursor-pointer">
            <div class="text-[10px] text-slate-400 mb-1 border-b border-slate-700 pb-1">${date}</div>
            <div class="text-white font-bold text-xs mb-1">${name}</div>
            <div class="font-mono font-bold text-xl" style="color: ${colorVar}">${val} <span class="text-[10px] text-slate-500">${unitLabel}</span></div>
            ${breakdown ? `<div class="text-[10px] text-slate-300 font-mono bg-slate-800 rounded px-2 py-0.5 mt-1 border border-slate-700">${breakdown}</div>` : ''}
        </div>`;
    manageTooltip(evt, 'metric-tooltip-popup', html, 'data');
};

// --- DATA HELPERS ---
const aggregateWeeklyTSS = (data) => {
    const weeks = {};
    data.forEach(d => {
        if (!d.trainingStressScore || d.trainingStressScore === 0) return;
        const date = new Date(d.date);
        const day = date.getDay(); 
        const diff = date.getDate() - day + (day === 0 ? 0 : 7); 
        const weekEnd = new Date(date.setDate(diff));
        weekEnd.setHours(0,0,0,0);
        const key = weekEnd.toISOString().split('T')[0];
        if (!weeks[key]) weeks[key] = 0;
        weeks[key] += parseFloat(d.trainingStressScore);
    });
    return Object.keys(weeks).sort().map(k => ({
        date: new Date(k),
        dateStr: `Week Ending ${k}`,
        name: "Weekly Load",
        val: weeks[k],
        breakdown: `Total TSS: ${Math.round(weeks[k])}`
    }));
};

const getMetricData = (key) => {
    const d = cachedData;
    const isInt = (item, labels) => {
        const l = (item.trainingEffectLabel || "").toString().toUpperCase().trim();
        return labels.some(allowed => l === allowed.toUpperCase());
    };

    switch(key) {
        // BIKE: Uses ID 2
        case 'endurance': return d.filter(x => checkSport(x, 'BIKE') && x.avgPower > 0 && x.avgHR > 0 && isInt(x, ['AEROBIC_BASE', 'RECOVERY'])).map(x => ({ val: x.avgPower / x.avgHR, date: x.date, dateStr: x.date.toISOString().split('T')[0], name: x.actualName, breakdown: `Pwr:${Math.round(x.avgPower)} / HR:${Math.round(x.avgHR)}` }));
        case 'strength': return d.filter(x => checkSport(x, 'BIKE') && x.avgPower > 0 && x.avgCadence > 0 && isInt(x, ['VO2MAX', 'LACTATE_THRESHOLD', 'TEMPO', 'ANAEROBIC_CAPACITY'])).map(x => ({ val: x.avgPower / x.avgCadence, date: x.date, dateStr: x.date.toISOString().split('T')[0], name: x.actualName, breakdown: `Pwr:${Math.round(x.avgPower)} / RPM:${Math.round(x.avgCadence)}` }));
        
        // RUN: Uses ID 1
        case 'run': return d.filter(x => checkSport(x, 'RUN') && x.avgSpeed > 0 && x.avgHR > 0).map(x => ({ val: (x.avgSpeed * 60) / x.avgHR, date: x.date, dateStr: x.date.toISOString().split('T')[0], name: x.actualName, breakdown: `Pace:${Math.round(x.avgSpeed*60)}m/m / HR:${Math.round(x.avgHR)}` }));
        case 'mechanical': return d.filter(x => checkSport(x, 'RUN') && x.avgSpeed > 0 && x.avgPower > 0).map(x => ({ val: (x.avgSpeed * 100) / x.avgPower, date: x.date, dateStr: x.date.toISOString().split('T')[0], name: x.actualName, breakdown: `Spd:${x.avgSpeed.toFixed(1)} / Pwr:${Math.round(x.avgPower)}` }));
        case 'gct': return d.filter(x => checkSport(x, 'RUN') && x.avgGroundContactTime > 0).map(x => ({ val: x.avgGroundContactTime, date: x.date, dateStr: x.date.toISOString().split('T')[0], name: x.actualName, breakdown: `${Math.round(x.avgGroundContactTime)} ms` }));
        case 'vert': return d.filter(x => checkSport(x, 'RUN') && x.avgVerticalOscillation > 0).map(x => ({ val: x.avgVerticalOscillation, date: x.date, dateStr: x.date.toISOString().split('T')[0], name: x.actualName, breakdown: `${x.avgVerticalOscillation.toFixed(1)} cm` }));
        
        // SWIM: Uses ID 5, 26, 18
        case 'swim': return d.filter(x => checkSport(x, 'SWIM') && x.avgSpeed > 0 && x.avgHR > 0).map(x => ({ val: (x.avgSpeed * 60) / x.avgHR, date: x.date, dateStr: x.date.toISOString().split('T')[0], name: x.actualName, breakdown: `Spd:${(x.avgSpeed*60).toFixed(1)}m/m / HR:${Math.round(x.avgHR)}` }));
        
        // ALL
        case 'vo2max': return d.filter(x => x.vO2MaxValue > 0).map(x => ({ val: x.vO2MaxValue, date: x.date, dateStr: x.date.toISOString().split('T')[0], name: "VO2 Est", breakdown: `Score: ${x.vO2MaxValue}` }));
        case 'anaerobic': return d.filter(x => x.anaerobicTrainingEffect > 0.5).map(x => ({ val: x.anaerobicTrainingEffect, date: x.date, dateStr: x.date.toISOString().split('T')[0], name: x.actualName, breakdown: `Anaerobic: ${x.anaerobicTrainingEffect}` }));
        case 'tss': return aggregateWeeklyTSS(d);
        default: return [];
    }
};

// --- TREND LOGIC ---
const calculateTrend = (dataPoints) => {
    const n = dataPoints.length;
    if (n < 3) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i; sumY += dataPoints[i].val;
        sumXY += i * dataPoints[i].val; sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, startVal: intercept, endVal: intercept + slope * (n - 1) };
};

const getTrendIcon = (slope, invert) => {
    if (Math.abs(slope) < 0.001) return { icon: 'fa-arrow-right', color: 'text-slate-500' };
    const isUp = slope > 0;
    const isGood = invert ? !isUp : isUp;
    return {
        icon: isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down',
        color: isGood ? 'text-emerald-400' : 'text-red-400'
    };
};

// --- TABLE BUILDER ---
const buildSummaryTable = () => {
    let rows = '';
    const now = new Date();

    Object.keys(METRIC_DEFINITIONS).forEach(key => {
        const def = METRIC_DEFINITIONS[key];
        const fullData = getMetricData(key).sort((a,b) => a.date - b.date);
        
        if (!fullData.length) return;

        const getT = (days) => {
            const cutoff = new Date();
            cutoff.setDate(now.getDate() - days);
            const subset = fullData.filter(d => d.date >= cutoff);
            const trend = calculateTrend(subset);
            return trend ? getTrendIcon(trend.slope, def.invertRanges) : { icon: 'fa-minus', color: 'text-slate-600' };
        };

        const t30 = getT(30);
        const t90 = getT(90);
        const t6m = getT(180);

        const recentSubset = fullData.filter(d => d.date >= new Date(now.getTime() - 30*24*60*60*1000));
        let statusHtml = '<span class="text-slate-500">--</span>';
        if (recentSubset.length > 0) {
            const avg30 = recentSubset.reduce((sum, d) => sum + d.val, 0) / recentSubset.length;
            if (def.invertRanges) {
                if (avg30 <= def.refMax) statusHtml = '<span class="text-emerald-400 font-bold text-[10px] bg-emerald-900/30 px-1.5 py-0.5 rounded">✅ On Target</span>';
                else statusHtml = '<span class="text-red-400 font-bold text-[10px] bg-red-900/30 px-1.5 py-0.5 rounded">⚠️ High</span>';
            } else {
                if (avg30 >= def.refMin) statusHtml = '<span class="text-emerald-400 font-bold text-[10px] bg-emerald-900/30 px-1.5 py-0.5 rounded">✅ On Target</span>';
                else statusHtml = '<span class="text-red-400 font-bold text-[10px] bg-red-900/30 px-1.5 py-0.5 rounded">⚠️ Low</span>';
            }
        }

        const iconCell = `
            <div onclick="window.scrollToMetric('${key}')" class="w-6 h-6 rounded flex items-center justify-center bg-slate-800 border border-slate-700 cursor-pointer hover:bg-slate-700 hover:border-slate-500 hover:scale-110 transition-all duration-200 group shadow-sm" title="Jump to Chart">
                <i class="fa-solid ${def.icon} text-xs group-hover:text-white transition-colors" style="color: ${def.colorVar}"></i>
            </div>`;

        rows += `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                <td class="px-4 py-3 flex items-center gap-3">
                    ${iconCell}
                    <div>
                        <div class="font-bold text-slate-200">${def.title}</div>
                        <div class="text-[9px] text-slate-500 font-mono">${def.rangeInfo}</div>
                    </div>
                </td>
                <td class="px-4 py-3 text-center"><i class="fa-solid ${t30.icon} ${t30.color}"></i></td>
                <td class="px-4 py-3 text-center"><i class="fa-solid ${t90.icon} ${t90.color}"></i></td>
                <td class="px-4 py-3 text-center"><i class="fa-solid ${t6m.icon} ${t6m.color}"></i></td>
                <td class="px-4 py-3 text-right">${statusHtml}</td>
            </tr>`;
    });

    return `
        <div class="overflow-x-auto bg-slate-800/30 border border-slate-700 rounded-xl mb-4 shadow-sm">
            <table class="w-full text-left text-xs">
                <thead class="bg-slate-900/50 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                        <th class="px-4 py-3">Metric & Target</th>
                        <th class="px-4 py-3 text-center">30d</th>
                        <th class="px-4 py-3 text-center">90d</th>
                        <th class="px-4 py-3 text-center">6m</th>
                        <th class="px-4 py-3 text-right">Current Status</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-700/50 text-slate-300">
                    ${rows}
                </tbody>
            </table>
        </div>`;
};

// --- GRAPH BUILDER ---
const buildMetricChart = (displayData, fullData, key) => {
    const def = METRIC_DEFINITIONS[key];
    const unitLabel = def.rangeInfo.split(' ').pop(); 
    const color = def.colorVar;

    const now = new Date();
    const getSlope = (days) => {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - days);
        const subset = fullData.filter(d => d.date >= cutoff);
        const trend = calculateTrend(subset);
        return trend ? getTrendIcon(trend.slope, def.invertRanges) : { icon: 'fa-minus', color: 'text-slate-600' };
    };
    const t30 = getSlope(30);
    const t90 = getSlope(90);
    const t6m = getSlope(180);

    const indicatorsHtml = `
        <div class="flex gap-1 ml-auto">
            <div class="flex items-center gap-1 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50" title="30d Trend">
                <span class="text-[8px] font-bold text-slate-400">30d</span><i class="fa-solid ${t30.icon} ${t30.color} text-[8px]"></i>
            </div>
            <div class="flex items-center gap-1 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50" title="90d Trend">
                <span class="text-[8px] font-bold text-slate-400">90d</span><i class="fa-solid ${t90.icon} ${t90.color} text-[8px]"></i>
            </div>
            <div class="flex items-center gap-1 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50" title="6m Trend">
                <span class="text-[8px] font-bold text-slate-400">6m</span><i class="fa-solid ${t6m.icon} ${t6m.color} text-[8px]"></i>
            </div>
        </div>`;

    if (!displayData || displayData.length < 2) {
        return `<div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6 h-full flex flex-col justify-between">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="text-xs font-bold text-white flex items-center gap-2">
                    <i class="fa-solid ${def.icon}" style="color: ${color}"></i> ${def.title}
                </h3>
            </div>
            <div class="flex-1 flex items-center justify-center"><p class="text-xs text-slate-500 italic">No data available.</p></div>
        </div>`;
    }

    const width = 800, height = 150;
    const pad = { t: 20, b: 30, l: 50, r: 20 };
    const getX = (d, i) => pad.l + (i / (displayData.length - 1)) * (width - pad.l - pad.r);
    
    const dataValues = displayData.map(d => d.val);
    let minV = Math.min(...dataValues);
    let maxV = Math.max(...dataValues);

    if (def.refMin !== undefined) minV = Math.min(minV, def.refMin);
    if (def.refMax !== undefined) maxV = Math.max(maxV, def.refMax);

    const range = maxV - minV;
    const buf = range * 0.15 || (maxV * 0.1); 
    const domainMin = Math.max(0, minV - buf);
    const domainMax = maxV + buf;

    const getY = (val) => height - pad.b - ((val - domainMin) / (domainMax - domainMin)) * (height - pad.t - pad.b);

    let refLinesHtml = '';
    if (def.refMin !== undefined && def.refMax !== undefined) {
        const yMin = getY(def.refMin);
        const yMax = getY(def.refMax);
        const colorMax = def.invertRanges ? '#ef4444' : '#10b981';
        const colorMin = def.invertRanges ? '#10b981' : '#ef4444';

        if (yMin >= pad.t && yMin <= height - pad.b) refLinesHtml += `<line x1="${pad.l}" y1="${yMin}" x2="${width - pad.r}" y2="${yMin}" stroke="${colorMin}" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />`;
        if (yMax >= pad.t && yMax <= height - pad.b) refLinesHtml += `<line x1="${pad.l}" y1="${yMax}" x2="${width - pad.r}" y2="${yMax}" stroke="${colorMax}" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />`;
    }

    const yAxisLine = `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height - pad.b}" stroke="#475569" stroke-width="1" />`;
    const yMid = (domainMin + domainMax) / 2;
    const axisLabelsHtml = `
        <text x="${pad.l - 6}" y="${getY(domainMax) + 4}" text-anchor="end" font-size="9" fill="#64748b">${domainMax.toFixed(1)}</text>
        <text x="${pad.l - 6}" y="${getY(yMid) + 4}" text-anchor="end" font-size="9" fill="#64748b">${yMid.toFixed(1)}</text>
        <text x="${pad.l - 6}" y="${getY(domainMin) + 4}" text-anchor="end" font-size="9" fill="#64748b">${domainMin.toFixed(1)}</text>
    `;

    const chartTrend = calculateTrend(displayData);
    let trendHtml = chartTrend ? `<line x1="${getX(null, 0)}" y1="${getY(chartTrend.startVal)}" x2="${getX(null, displayData.length - 1)}" y2="${getY(chartTrend.endVal)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.5" />` : '';
    
    let pathD = `M ${getX(displayData[0], 0)} ${getY(displayData[0].val)}`;
    let pointsHtml = '';
    displayData.forEach((d, i) => {
        const x = getX(d, i), y = getY(d.val);
        pathD += ` L ${x} ${y}`;
        pointsHtml += `<circle cx="${x}" cy="${y}" r="3.5" fill="#0f172a" stroke="${color}" stroke-width="2" class="cursor-pointer hover:stroke-white transition-all" onclick="window.showMetricTooltip(event, '${d.dateStr}', '${d.name.replace(/'/g, "")}', '${d.val.toFixed(2)}', '${unitLabel}', '${d.breakdown || ""}', '${color}')"></circle>`;
    });

    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-4 h-full flex flex-col hover:border-slate-600 transition-colors">
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded flex items-center justify-center bg-slate-800 border border-slate-700">
                        <i class="fa-solid ${def.icon} text-sm" style="color: ${color}"></i>
                    </div>
                    <h3 class="text-xs font-bold text-white uppercase tracking-wide leading-none">${def.title}</h3>
                </div>
                <div class="flex items-center gap-3">
                    ${indicatorsHtml}
                    <div class="cursor-pointer text-slate-500 hover:text-white transition-colors p-1" onclick="window.showAnalysisTooltip(event, '${key}')">
                        <i class="fa-solid fa-circle-info text-sm"></i>
                    </div>
                </div>
            </div>
            <div class="flex-1 w-full h-[120px]">
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
                    ${yAxisLine}
                    ${axisLabelsHtml}
                    ${refLinesHtml}
                    ${trendHtml}
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.9" />
                    ${pointsHtml}
                </svg>
            </div>
        </div>
    `;
};

const updateMetricsCharts = () => {
    if (!cachedData || cachedData.length === 0) return;
    
    const cutoff = new Date();
    if (metricsState.timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (metricsState.timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (metricsState.timeRange === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (metricsState.timeRange === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);
    
    // FULL DATASETS
    const isIntensity = (item, labels) => {
        const l = (item.trainingEffectLabel || "").toString().toUpperCase().trim();
        return labels.some(allowed => l === allowed.toUpperCase());
    };

    const buildSet = (filterFn, mapFn) => {
        const full = cachedData.filter(filterFn).map(mapFn).sort((a,b) => a.date - b.date);
        const display = full.filter(d => d.date >= cutoff);
        return { full, display };
    };

    // Use robust checkSport helper
    const ef = buildSet(
        d => checkSport(d, 'BIKE') && d.avgPower > 0 && d.avgHR > 0 && isIntensity(d, ['AEROBIC_BASE', 'RECOVERY']),
        d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: d.avgPower / d.avgHR, breakdown: `Pwr:${Math.round(d.avgPower)} / HR:${Math.round(d.avgHR)}` })
    );

    const torque = buildSet(
        d => checkSport(d, 'BIKE') && d.avgPower > 0 && d.avgCadence > 0 && isIntensity(d, ['VO2MAX', 'LACTATE_THRESHOLD', 'TEMPO', 'ANAEROBIC_CAPACITY']),
        d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: d.avgPower / d.avgCadence, breakdown: `Pwr:${Math.round(d.avgPower)} / RPM:${Math.round(d.avgCadence)}` })
    );

    const runEcon = buildSet(
        d => checkSport(d, 'RUN') && d.avgSpeed > 0 && d.avgHR > 0,
        d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: (d.avgSpeed * 60) / d.avgHR, breakdown: `Pace:${Math.round(d.avgSpeed * 60)}m/m / HR:${Math.round(d.avgHR)}` })
    );

    const mech = buildSet(
        d => checkSport(d, 'RUN') && d.avgSpeed > 0 && d.avgPower > 0,
        d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: (d.avgSpeed * 100) / d.avgPower, breakdown: `Spd:${d.avgSpeed.toFixed(1)} / Pwr:${Math.round(d.avgPower)}` })
    );

    const swim = buildSet(
        d => checkSport(d, 'SWIM') && d.avgSpeed > 0 && d.avgHR > 0,
        d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: (d.avgSpeed * 60) / d.avgHR, breakdown: `Spd:${(d.avgSpeed*60).toFixed(1)}m/m / HR:${Math.round(d.avgHR)}` })
    );

    const vo2 = buildSet(
        d => d.vO2MaxValue > 0,
        d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: "VO2 Estimate", val: parseFloat(d.vO2MaxValue), breakdown: `Score: ${d.vO2MaxValue}` })
    );

    const fullTss = aggregateWeeklyTSS(cachedData);
    const displayTss = fullTss.filter(d => d.date >= cutoff);

    const gct = buildSet(
        d => checkSport(d, 'RUN') && d.avgGroundContactTime > 0,
        d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: parseFloat(d.avgGroundContactTime), breakdown: `${Math.round(d.avgGroundContactTime)} ms` })
    );

    const vert = buildSet(
        d => checkSport(d, 'RUN') && d.avgVerticalOscillation > 0,
        d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: parseFloat(d.avgVerticalOscillation), breakdown: `${d.avgVerticalOscillation.toFixed(1)} cm` })
    );

    const ana = buildSet(
        d => d.anaerobicTrainingEffect > 0.5,
        d => ({ date: d.date, dateStr: d.date.toISOString().split('T')[0], name: d.actualName, val: parseFloat(d.anaerobicTrainingEffect), breakdown: `Anaerobic: ${d.anaerobicTrainingEffect}` })
    );

    // RENDER CONTENT
    document.getElementById('trends-table-container').innerHTML = buildSummaryTable();

    const render = (id, dataObj, key) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = buildMetricChart(dataObj.display, dataObj.full, key);
    };

    render('metric-chart-endurance', ef, 'endurance');
    render('metric-chart-strength', torque, 'strength');
    render('metric-chart-run', runEcon, 'run');
    render('metric-chart-mechanical', mech, 'mechanical');
    render('metric-chart-gct', gct, 'gct');
    render('metric-chart-vert', vert, 'vert');
    render('metric-chart-swim', swim, 'swim');
    render('metric-chart-vo2max', vo2, 'vo2max');
    render('metric-chart-tss', { full: fullTss, display: displayTss }, 'tss');
    render('metric-chart-anaerobic', ana, 'anaerobic');

    ['30d', '90d', '6m', '1y'].forEach(range => {
        const btn = document.getElementById(`btn-metric-${range}`);
        if(btn) btn.className = metricsState.timeRange === range ? 
            "bg-emerald-500 text-white font-bold px-3 py-1 rounded text-[10px] transition-all shadow-lg" : 
            "bg-slate-800 text-slate-400 hover:text-white px-3 py-1 rounded text-[10px] transition-all hover:bg-slate-700";
    });
};

export function renderMetrics(allData) {
    cachedData = allData || [];
    setTimeout(updateMetricsCharts, 0);
    const buildToggle = (range, label) => `<button id="btn-metric-${range}" onclick="window.toggleMetricsTime('${range}')" class="bg-slate-800 text-slate-400 px-3 py-1 rounded text-[10px] transition-all">${label}</button>`;
    
    // Header (Sticky)
    const headerHtml = `
        <div class="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800 backdrop-blur-sm sticky top-0 z-10 mb-6">
            <h2 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <i class="fa-solid fa-bullseye text-emerald-500"></i> Performance Lab
            </h2>
            <div class="flex gap-1.5">${buildToggle('30d', '30d')}${buildToggle('90d', '90d')}${buildToggle('6m', '6m')}${buildToggle('1y', '1y')}</div>
        </div>`;

    const tableSection = buildCollapsibleSection('metrics-table-section', 'Physiological Trends', '<div id="trends-table-container"></div>', true);

    const chartsGrid = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div id="metric-chart-endurance"></div>
            <div id="metric-chart-strength"></div>
            <div id="metric-chart-run"></div>
            <div id="metric-chart-swim"></div> <div id="metric-chart-mechanical"></div>
            <div id="metric-chart-gct"></div>
            <div id="metric-chart-vert"></div>
            <div id="metric-chart-vo2max"></div>
            <div id="metric-chart-tss"></div>
            <div id="metric-chart-anaerobic"></div>
        </div>`;
    
    const chartsSection = buildCollapsibleSection('metrics-charts-section', 'Detailed Charts', chartsGrid, true);

    return `
        <div class="max-w-7xl mx-auto space-y-6 pb-12 relative">
            ${headerHtml}
            ${tableSection}
            ${chartsSection}
        </div>
        <div id="metric-tooltip-popup" class="z-50 bg-slate-900 border border-slate-600 p-3 rounded-md shadow-xl text-xs opacity-0 transition-opacity absolute pointer-events-auto cursor-pointer"></div>
        <div id="metric-info-popup" class="z-50 bg-slate-800 border border-blue-500/50 p-4 rounded-xl shadow-2xl text-xs opacity-0 transition-opacity absolute pointer-events-auto cursor-pointer max-w-[320px]"></div>
    `;
}
