// js/views/metrics/definitions.js

// 1. Define Helper Functions for Calculations
const valid = (v) => typeof v === 'number' && v > 0;

export const METRIC_DEFINITIONS = {
    // --- CYCLING ---
    'endurance': {
        title: 'Aerobic Efficiency',
        sport: 'Bike', // Matches app.js "Bike"
        icon: 'fa-heart-pulse',
        colorVar: '#38bdf8', // Light Blue
        refMin: 1.2, refMax: 1.6,
        // The Engine will run this function for every data point
        getValue: (d) => (valid(d.power) && valid(d.hr)) ? d.power / d.hr : null,
        getLabel: (d) => `${d.power}w / ${d.hr}bpm`
    },
    'strength': {
        title: 'Torque Factor',
        sport: 'Bike',
        icon: 'fa-dumbbell',
        colorVar: '#818cf8', // Indigo
        refMin: 2.0, refMax: 4.0,
        getValue: (d) => (valid(d.power) && valid(d.cadence)) ? d.power / d.cadence : null,
        getLabel: (d) => `${d.power}w / ${d.cadence}rpm`
    },
    'subjective_bike': {
        title: 'RPE Efficiency',
        sport: 'Bike',
        icon: 'fa-face-tired',
        colorVar: '#a78bfa', // Purple
        getValue: (d) => (valid(d.power) && valid(d.rpe)) ? d.power / d.rpe : null,
        getLabel: (d) => `${d.power}w / ${d.rpe} RPE`
    },

    // --- RUNNING ---
    'run': {
        title: 'Running Efficiency',
        sport: 'Run', // Matches app.js "Run"
        icon: 'fa-person-running',
        colorVar: '#f472b6', // Pink
        refMin: 1.0, refMax: 1.4,
        getValue: (d) => (valid(d.speed) && valid(d.hr)) ? (d.speed * 60) / d.hr : null,
        getLabel: (d) => `${d.speed.toFixed(2)}m/s / ${d.hr}bpm`
    },
    'mechanical': {
        title: 'Stiffness Proxy',
        sport: 'Run',
        icon: 'fa-ruler-horizontal',
        colorVar: '#2dd4bf', // Teal
        getValue: (d) => (valid(d.speed) && valid(d.power)) ? (d.speed * 100) / d.power : null,
        getLabel: (d) => `${d.speed.toFixed(1)}m/s / ${d.power}w`
    },
    'gct': {
        title: 'Ground Contact Time',
        sport: 'Run',
        icon: 'fa-shoe-prints',
        colorVar: '#fbbf24', // Amber
        invertRanges: true, // Lower is better
        refMin: 200, refMax: 260,
        getValue: (d) => valid(d.gct) ? d.gct : null,
        getLabel: (d) => `${Math.round(d.gct)}ms`
    },
    'vert': {
        title: 'Vertical Oscillation',
        sport: 'Run',
        icon: 'fa-arrows-up-down',
        colorVar: '#34d399', // Emerald
        invertRanges: true,
        refMin: 6.0, refMax: 10.0,
        getValue: (d) => valid(d.vert) ? d.vert : null,
        getLabel: (d) => `${d.vert.toFixed(1)}cm`
    },

    // --- SWIMMING ---
    'swim': {
        title: 'Swim Efficiency',
        sport: 'Swim',
        icon: 'fa-person-swimming',
        colorVar: '#06b6d4', // Cyan
        getValue: (d) => (valid(d.speed) && valid(d.hr)) ? (d.speed * 60) / d.hr : null,
        getLabel: (d) => `${(d.speed*60).toFixed(1)}m/min / ${d.hr}bpm`
    },

    // --- PHYSIOLOGY (General) ---
    'vo2max': {
        title: 'VO2 Max Estimate',
        sport: 'All', // Special flag for "Don't filter by sport"
        icon: 'fa-lungs',
        colorVar: '#10b981', // Green
        getValue: (d) => valid(d.vo2) ? d.vo2 : null,
        getLabel: (d) => `Score: ${d.vo2}`
    },
    'anaerobic': {
        title: 'Anaerobic Impact',
        sport: 'All',
        icon: 'fa-fire',
        colorVar: '#f59e0b', // Orange
        getValue: (d) => (valid(d.anaerobic) && d.anaerobic > 2.0) ? d.anaerobic : null,
        getLabel: (d) => `TE: ${d.anaerobic}`
    },
    'tss': {
        title: 'Weekly Training Load',
        sport: 'All',
        icon: 'fa-layer-group',
        colorVar: '#3b82f6', // Blue
        isWeekly: true, // Flag for special aggregation
        getValue: (d) => valid(d.tss) ? d.tss : 0,
        getLabel: (d) => `${Math.round(d.tss)} TSS`
    }
};
