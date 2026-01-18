// js/views/metrics/definitions.js

const valid = (v) => typeof v === 'number' && v > 0;

export const METRIC_DEFINITIONS = {
    // --- CYCLING ---
    'subjective_bike': {
        title: "Bike RPE Efficiency", 
        sport: "Bike", 
        icon: "fa-person-biking", 
        colorVar: "var(--color-bike)",
        refMin: 25, refMax: 50, // Matches your file
        rangeInfo: "25 – 50 W/RPE",
        description: "Power produced per unit of perceived effort. Higher is better.",
        improvement: "• Aerobic Base<br>• Muscular Endurance",
        // Logic: Power / RPE
        getValue: (d) => (valid(d.power) && valid(d.rpe)) ? d.power / d.rpe : null,
        getLabel: (d) => `${d.power}w / ${d.rpe} RPE`
    },
    'endurance': {
        title: "Aerobic Efficiency", 
        sport: "Bike", 
        icon: "fa-heart-pulse", 
        colorVar: "var(--color-bike)",
        refMin: 1.30, refMax: 1.70, // Matches your file
        rangeInfo: "1.30 – 1.70 EF",
        description: "Watts produced per heartbeat.",
        improvement: "• Long Z2 Rides<br>• Consistent Volume",
        // Logic: Power / HR
        getValue: (d) => (valid(d.power) && valid(d.hr)) ? d.power / d.hr : null,
        getLabel: (d) => `${d.power}w / ${d.hr}bpm`
    },
    'strength': {
        title: "Torque Efficiency", 
        sport: "Bike", 
        icon: "fa-bolt", 
        colorVar: "var(--color-bike)",
        refMin: 2.5, refMax: 3.5, // Matches your file
        rangeInfo: "2.5 – 3.5 W/RPM",
        description: "Watts per Revolution.",
        improvement: "• Low Cadence Intervals (50-60 RPM)<br>• Seated Climbing",
        // Logic: Power / Cadence
        getValue: (d) => (valid(d.power) && valid(d.cadence)) ? d.power / d.cadence : null,
        getLabel: (d) => `${d.power}w / ${d.cadence}rpm`
    },

    // --- RUNNING ---
    'subjective_run': {
        title: "Run RPE Efficiency", 
        sport: "Run", 
        icon: "fa-person-running", 
        colorVar: "var(--color-run)",
        refMin: 0.6, refMax: 1.0, // Matches your file
        rangeInfo: "0.6 – 1.0 Spd/RPE",
        description: "Speed (m/s) produced per unit of perceived effort.",
        improvement: "• Run Economy<br>• Durability",
        // Logic: Speed / RPE
        getValue: (d) => (valid(d.speed) && valid(d.rpe)) ? d.speed / d.rpe : null,
        getLabel: (d) => `${d.speed.toFixed(2)}m/s / ${d.rpe} RPE`
    },
    'run': {
        title: "Running Economy", 
        sport: "Run", 
        icon: "fa-gauge-high", 
        colorVar: "var(--color-run)",
        refMin: 1.0, refMax: 1.6, // Matches your file
        rangeInfo: "1.0 – 1.6 m/beat",
        description: "Distance traveled per heartbeat.",
        improvement: "• Strides & Hill Sprints<br>• Plyometrics",
        // Logic: (Speed * 60) / HR -> Meters per minute per beat
        getValue: (d) => (valid(d.speed) && valid(d.hr)) ? (d.speed * 60) / d.hr : null,
        getLabel: (d) => `${d.speed.toFixed(2)}m/s / ${d.hr}bpm`
    },
    'mechanical': {
        title: "Mechanical Stiffness", 
        sport: "Run", 
        icon: "fa-ruler-horizontal", 
        colorVar: "var(--color-run)",
        refMin: 0.75, refMax: 0.95, // Matches your file
        rangeInfo: "0.75 – 0.95 Ratio",
        description: "Ratio of Speed vs. Power.",
        improvement: "• High Cadence (170+)<br>• Form Drills (A-Skips)",
        // Logic: (Speed * 100) / Power
        getValue: (d) => (valid(d.speed) && valid(d.power)) ? (d.speed * 100) / d.power : null,
        getLabel: (d) => `${d.speed.toFixed(1)}m/s / ${d.power}w`
    },
    'gct': {
        title: "Ground Contact Time", 
        sport: "Run", 
        icon: "fa-stopwatch", 
        colorVar: "var(--color-run)",
        refMin: 220, refMax: 260, // Matches your file
        invertRanges: true, // Lower is better
        rangeInfo: "< 260 ms",
        description: "Time spent on the ground.",
        improvement: "• Increase Cadence<br>• 'Hot Coals' Imagery",
        // Logic: GCT
        getValue: (d) => valid(d.gct) ? d.gct : null,
        getLabel: (d) => `${Math.round(d.gct)}ms`
    },
    'vert': {
        title: "Vertical Oscillation", 
        sport: "Run", 
        icon: "fa-arrows-up-down", 
        colorVar: "var(--color-run)",
        refMin: 6.0, refMax: 9.0, // Matches your file
        invertRanges: true, // Lower is better
        rangeInfo: "6.0 – 9.0 cm",
        description: "Vertical bounce.",
        improvement: "• Core Stability<br>• Hill Repeats",
        // Logic: Vert Osc
        getValue: (d) => valid(d.vert) ? d.vert : null,
        getLabel: (d) => `${d.vert.toFixed(1)}cm`
    },

    // --- SWIMMING ---
    'subjective_swim': {
        title: "Swim RPE Efficiency", 
        sport: "Swim", 
        icon: "fa-person-swimming", 
        colorVar: "var(--color-swim)",
        refMin: 0.15, refMax: 0.3, // Matches your file
        rangeInfo: "0.15 – 0.3 Spd/RPE",
        description: "Water speed (m/s) relative to effort.",
        improvement: "• Technique<br>• Drag Reduction",
        // Logic: Speed / RPE
        getValue: (d) => (valid(d.speed) && valid(d.rpe)) ? d.speed / d.rpe : null,
        getLabel: (d) => `${d.speed.toFixed(2)}m/s / ${d.rpe} RPE`
    },
    'swim': {
        title: "Swim Efficiency", 
        sport: "Swim", 
        icon: "fa-person-swimming", 
        colorVar: "var(--color-swim)",
        refMin: 0.3, refMax: 0.6, // Matches your file
        rangeInfo: "0.3 – 0.6 m/beat",
        description: "Distance traveled per heartbeat in water.",
        improvement: "• Drills (Catch/Pull)<br>• Long Steady Swims",
        // Logic: (Speed * 60) / HR
        getValue: (d) => (valid(d.speed) && valid(d.hr)) ? (d.speed * 60) / d.hr : null,
        getLabel: (d) => `${(d.speed*60).toFixed(1)}m/min / ${d.hr}bpm`
    },

    // --- GENERAL PHYSIOLOGY ---
    'vo2max': {
        title: "VO₂ Max Trend", 
        sport: "All", 
        icon: "fa-lungs", 
        colorVar: "var(--color-all)",
        refMin: 45, refMax: 60, // Matches your file
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
        refMin: 300, refMax: 600, // Matches your file
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
        refMin: 2.0, refMax: 4.0, // Matches your file
        rangeInfo: "2.0 – 4.0",
        description: "Intensity stimulus on hard days.",
        improvement: "• All-out Sprints<br>• Full Recovery",
        getValue: (d) => (valid(d.anaerobic) && d.anaerobic > 2.0) ? d.anaerobic : null,
        getLabel: (d) => `TE: ${d.anaerobic}`
    }
};
