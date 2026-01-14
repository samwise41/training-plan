// js/views/metrics/utils.js

export const checkSport = (item, sport) => {
    if (!item) return false;
    const type = (item.activityType || "").toLowerCase();
    const sType = item.sportTypeId;
    
    if (sport === 'RUN') return sType === '1' || type.includes('run');
    if (sport === 'BIKE') return sType === '2' || type.includes('cycl') || type.includes('bik') || type.includes('virt');
    if (sport === 'SWIM') return sType === '5' || type.includes('swim');
    return false;
};

export const calculateTrend = (data) => {
    if (!data || data.length < 2) return null;
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    data.forEach((d, i) => {
        sumX += i; sumY += d.val;
        sumXY += i * d.val; sumXX += i * i;
    });
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const startVal = (sumY - slope * sumX) / n;
    const endVal = startVal + slope * (n - 1);
    return { slope, startVal, endVal };
};

export const getTrendIcon = (slope, invert = false) => {
    const threshold = 0.001;
    let direction = 'flat';
    if (slope > threshold) direction = 'up';
    if (slope < -threshold) direction = 'down';

    if (invert) {
        if (direction === 'up') return { icon: 'fa-arrow-trend-up', color: 'text-red-400' };
        if (direction === 'down') return { icon: 'fa-arrow-trend-down', color: 'text-emerald-400' };
    } else {
        if (direction === 'up') return { icon: 'fa-arrow-trend-up', color: 'text-emerald-400' };
        if (direction === 'down') return { icon: 'fa-arrow-trend-down', color: 'text-red-400' };
    }
    return { icon: 'fa-minus', color: 'text-slate-500' };
};

export const buildCollapsibleSection = (id, title, content, isOpen = false) => {
    const iconClass = isOpen ? 'fa-chevron-down' : 'fa-chevron-right';
    const contentClass = isOpen ? '' : 'hidden';
    
    return `
        <div class="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden transition-all duration-300">
            <button onclick="document.getElementById('${id}').classList.toggle('hidden'); this.querySelector('i').classList.toggle('fa-chevron-down'); this.querySelector('i').classList.toggle('fa-chevron-right');" 
                class="w-full flex justify-between items-center p-4 bg-slate-800/50 hover:bg-slate-700/50 transition-colors">
                <h3 class="font-bold text-slate-200 text-sm uppercase tracking-wide">${title}</h3>
                <i class="fa-solid ${iconClass} text-slate-400 text-xs transition-transform duration-300"></i>
            </button>
            <div id="${id}" class="${contentClass} p-4 border-t border-slate-700/50">
                ${content}
            </div>
        </div>
    `;
};
