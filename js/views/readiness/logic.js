// js/views/readiness/logic.js
import { parseDur } from './utils.js';

export const getTrainingStats = (mergedLogData) => {
    let maxSwim = 0;
    let maxBike = 0;
    let maxRun = 0;
    let maxBikeElev = 0; // New Metric

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    const safeLog = Array.isArray(mergedLogData) ? mergedLogData : [];

    safeLog.forEach(d => {
        const entryDate = new Date(d.date);
        if (entryDate >= lookbackDate) {
            let dur = 0;
            if (typeof d.actualDuration === 'number') dur = d.actualDuration;
            else if (typeof d.duration === 'string') dur = parseDur(d.duration);
            
            if (d.type === 'Swim') maxSwim = Math.max(maxSwim, dur);
            if (d.type === 'Bike') {
                maxBike = Math.max(maxBike, dur);
                maxBikeElev = Math.max(maxBikeElev, d.elevationGain || 0); // Track max climb
            }
            if (d.type === 'Run') maxRun = Math.max(maxRun, dur);
        }
    });

    return { maxSwim, maxBike, maxRun, maxBikeElev };
};

export const parseEvents = (planMd) => {
    if (!planMd) return [];
    
    const lines = planMd.split('\n');
    let inTable = false;
    let events = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('| **Date** |')) { inTable = true; continue; }
        if (inTable && line.startsWith('| :---')) continue; 
        if (inTable && line.startsWith('|')) {
            const cleanLine = line.replace(/^\||\|$/g, '');
            const cols = cleanLine.split('|').map(c => c.trim());
            if (cols.length >= 2) {
                events.push({
                    dateStr: cols[0],
                    name: cols[1],
                    priority: cols[3] || 'C',
                    swimGoal: cols[7] || '',
                    bikeGoal: cols[9] || '',
                    runGoal: cols[11] || '',
                    bikeElevGoal: cols[12] || '' // Capture new column (Index 12)
                });
            }
        } else if (inTable && line === '') { inTable = false; }
    }

    events.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
    const today = new Date();
    today.setHours(0,0,0,0);
    
    return events.filter(e => {
        const d = new Date(e.dateStr);
        return !isNaN(d.getTime()) && d >= today;
    });
};
