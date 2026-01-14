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
    
    // Simple linear regression approximation
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    data.forEach((d, i) => {
        sumX += i;
        sumY += d.val;
        sumXY += i * d.val;
        sumXX += i * i;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const startVal = (sumY - slope * sumX) / n;
    const endVal = startVal + slope * (n - 1);
    
    return { slope, startVal, endVal };
};

export const getTrendIcon = (slope, invert = false) => {
    const threshold = 0.001; // Sensitivity
    let direction = 'flat';
    if (slope > threshold) direction = 'up';
    if (slope < -threshold) direction = 'down';

    // Invert logic for metrics where "Lower is Better" (e.g., GCT)
    if (invert) {
        if (direction === 'up') return { icon: 'fa-arrow-trend-up', color: 'text-red-400' };
        if (direction === 'down') return { icon: 'fa-arrow-trend-down', color: 'text-emerald-400' };
    } else {
        if (direction === 'up') return { icon: 'fa-arrow-trend-up', color: 'text-emerald-400' };
        if (direction === 'down') return { icon: 'fa-arrow-trend-down', color: 'text-red-400' };
    }
    return { icon: 'fa-minus', color: 'text-slate-500' };
};
