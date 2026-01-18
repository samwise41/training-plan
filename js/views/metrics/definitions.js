// js/views/metrics/definitions.js

const valid = (v) => typeof v === 'number' && v > 0;

export const METRIC_DEFINITIONS = {
    // --- CYCLING ---
    'subjective_bike': {
        title: "Bike RPE Efficiency", 
        sport: "Bike", 
        icon: "fa-person-biking", 
        colorVar: "var(--color-bike)",
        formula: "(Power / RPE)",
        refMin: 25, refMax: 50,
        rangeInfo: "25 – 50 W/RPE",
        description: "Power produced per unit of perceived effort. Higher is better.",
        improvement: "• Aerobic Base<br>• Muscular Endurance",
        getValue: (d) => (valid(d.power) && valid(d.rpe)) ? d.power / d.rpe : null,
        getLabel: (d) => `${d.power}w / ${d.rpe} RPE`
    },
    'endurance': {
        title: "Aerobic Efficiency", 
        sport: "Bike", 
        icon: "fa-heart-pulse", 
        colorVar: "var(--color-bike)",
        formula: "(Power / HR)",
        refMin: 1.30, refMax: 1.70,
        rangeInfo: "1.30 – 1.70 EF",
        description: "Watts produced per heartbeat.",
        improvement: "• Long Z2 Rides<br>• Consistent Volume",
        getValue: (d) => (valid(d.power) && valid(d.hr)) ? d.power / d.hr : null,
        getLabel: (d) => `${d.power}w / ${d.hr}bpm`
    },
    'strength': {
        title: "Torque Efficiency", 
        sport: "Bike", 
        icon: "fa-bolt", 
        colorVar: "var(--color-bike)",
        formula: "(Power / Cadence)",
        refMin: 2.5, refMax: 3.5,
        rangeInfo: "2.5 – 3.5 W/RPM",
        description: "Watts per Revolution.",
        improvement: "• Low Cadence Intervals (50-60 RPM)<br>• Seated Climbing",
        getValue: (d) => (valid(d.power) && valid(d.cadence)) ? d.power / d.cadence : null,
        getLabel: (d) => `${d.power}w / ${d.cadence}rpm`
    },

    // --- RUNNING ---
    'subjective_run': {
        title: "Run RPE Efficiency", 
        sport: "Run", 
        icon: "fa-person-running", 
        colorVar: "var(--color-run)",
        formula: "(Speed / RPE)",
        refMin: 0.6, refMax: 1.0,
        rangeInfo: "0.6 – 1.0 Spd/RPE",
        description: "Speed (m/s) produced per unit of perceived effort.",
        improvement: "• Run Economy<br>• Durability",
        getValue: (d) => (valid(d.speed) && valid(d.rpe)) ? d.speed / d.rpe : null,
        getLabel: (d) => `${d.speed.toFixed(2)}m/s / ${d.rpe} RPE`
    },
    'run': {
        title: "Running Economy", 
        sport: "Run", 
        icon: "fa-gauge-high", 
        colorVar: "var(--color-run)",
        formula: "(Speed / HR)",
        refMin: 1.0, refMax: 1.6,
        rangeInfo: "1.0 – 1.6 m/beat",
        description: "Distance traveled per heartbeat.",
        improvement: "• Strides & Hill Sprints<br>• Plyometrics",
        getValue: (d) => (valid(d.speed) && valid(d.hr)) ? (d.speed * 60) / d.hr : null,
        getLabel: (d) => `${d.speed.toFixed(2)}m/s / ${d.hr}bpm`
    },
    'mechanical': {
        title: "Mechanical Stiffness", 
        sport: "Run", 
        icon: "fa-ruler-horizontal", 
        colorVar: "var(--color-run)",
        formula: "(Speed / Power)",
        refMin: 0.75, refMax: 0.95,
        rangeInfo: "0.75 – 0.95 Ratio",
        description: "Ratio of Speed vs. Power.",
        improvement: "• High Cadence (170+)<br>• Form Drills (A-Skips)",
        getValue: (d) => (valid(d.speed) && valid(d.power)) ? (d.speed * 100) / d.power : null,
        getLabel: (d) => `${d.speed.toFixed(1)}m/s / ${d.power}w`
    },
    'gct': {
        title: "Ground Contact Time", 
        sport: "Run", 
        icon: "fa-stopwatch", 
        colorVar: "var(--color-run)",
        formula: "(ms)",
        refMin: 220, refMax: 260,
        invertRanges: true,
        rangeInfo: "< 260 ms",
        description: "Time spent on the ground.",
        improvement: "• Increase Cadence<br>• 'Hot Coals' Imagery",
        getValue: (d) => valid(d.gct) ? d.gct : null,
        getLabel: (d) => `${Math.round(d.gct)}ms`
    },
    'vert': {
        title: "Vertical Oscillation", 
        sport: "Run", 
        icon: "fa-arrows-up-down", 
        colorVar: "var(--color-run)",
        formula: "(cm)",
        refMin: 6.0, refMax: 9.0,
        invertRanges: true,
        rangeInfo: "6.0 – 9.0 cm",
        description: "Vertical bounce.",
        improvement: "• Core Stability<br>• Hill Repeats",
        getValue: (d) => valid(d.vert) ? d.vert : null,
        getLabel: (d) => `${d.vert.toFixed(1)}cm`
    },

    // --- SWIMMING ---
    'subjective_swim': {
        title: "Swim RPE Efficiency", 
        sport: "Swim", 
        icon: "fa-person-swimming", 
        colorVar: "var(--color-swim)",
        formula: "(Speed / RPE)",
        refMin: 0.15, refMax: 0.3,
        rangeInfo: "0.15 – 0.3 Spd/RPE",
        description: "Water speed (m/s) relative to effort.",
        improvement: "• Technique<br>• Drag Reduction",
        getValue: (d) => (valid(d.speed) && valid(d.rpe)) ? d.speed / d.rpe : null,
        getLabel: (d) => `${d.speed.toFixed(2)}m/s / ${d.rpe} RPE`
    },
    'swim': {
        title: "Swim Efficiency", 
        sport: "Swim", 
        icon: "fa-person-swimming", 
        colorVar: "var(--color-swim)",
        formula: "(Speed / HR)",
        refMin: 0.3, refMax: 0.6,
        rangeInfo: "0.3 – 0.6 m/beat",
        description: "Distance traveled per heartbeat in water.",
        improvement: "• Drills (Catch/Pull)<br>• Long Steady Swims",
        getValue: (d) => (valid(d.speed) && valid(d.hr)) ? (d.speed * 60) / d.hr : null,
        getLabel: (d) => `${(d.speed*60).toFixed(1)}m/min / ${d.hr}bpm`
    },

    // --- GENERAL PHYSIOLOGY ---
    'vo2max': {
        title: "VO₂ Max Trend", 
        sport: "All", 
        icon: "fa-lungs", 
        colorVar: "var(--color-all)",
        formula: "(Est Score)",
        refMin: 45, refMax: 60,
        rangeInfo: "45 – 60+",
        description: "Aerobic ceiling.",
        improvement: "• VO2 Max Intervals<br>• Consistency",
        getValue: (d) => valid(d.vo2) ? d.vo2 : null,
        getLabel: (d) => `Score: ${d.vo2}`
    },
    'tss': {
        title: "Weekly TSS Load", 
        sport: "All", 
        icon: "fa-layer-group", 
        colorVar: "var(--color-all)",
        formula: "(Aggregate Score)",
        refMin: 300, refMax: 600,
        rangeInfo: "300 – 600 TSS",
        description: "Total physiological load.",
        improvement: "• Increase Volume<br>• Increase Intensity",
        isWeekly: true,
        getValue: (d) => valid(d.tss) ? d.tss : 0,
        getLabel: (d) => `${Math.round(d.tss)} TSS`
    },
    'anaerobic': {
        title: "Anaerobic Impact", 
        sport: "All", 
        icon: "fa-fire", 
        colorVar: "var(--color-all)",
        formula: "(Training Effect)",
        refMin: 2.0, refMax: 4.0,
        rangeInfo: "2.0 – 4.0",
        description: "Intensity stimulus on hard days.",
        improvement: "• All-out Sprints<br>• Full Recovery",
        getValue: (d) => (valid(d.anaerobic) && d.anaerobic > 2.0) ? d.anaerobic : null,
        getLabel: (d) => `TE: ${d.anaerobic}`
    }
};
