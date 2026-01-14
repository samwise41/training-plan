// js/views/metrics/definitions.js

export const SPORT_IDS = {
    RUN: [1],
    BIKE: [2],
    SWIM: [5, 26, 18]
};

export const METRIC_DEFINITIONS = {
    // --- GENERAL FITNESS ---
    vo2max: {
        title: "VO2 Max", sport: "All", icon: "fa-lungs", colorVar: "#8b5cf6", // Violet
        refMin: 45, refMax: 60, invertRanges: false, rangeInfo: "ml/kg/min",
        description: "Maximum oxygen uptake estimate from Garmin."
    },
    anaerobic: {
        title: "Anaerobic Impact", sport: "All", icon: "fa-fire", colorVar: "#f97316", // Orange
        refMin: 2.0, refMax: 4.0, invertRanges: false, rangeInfo: "Score (0-5)",
        description: "High-intensity training load contribution."
    },

    // --- SUBJECTIVE EFFICIENCY (Output / RPE) ---
    subjective_bike: {
        title: "Bike Efficiency (Pwr/RPE)", sport: "Bike", icon: "fa-bolt", colorVar: "#3b82f6", // Blue
        refMin: 20, refMax: 40, invertRanges: false, rangeInfo: "Watts/RPE",
        description: "Power produced per unit of perceived effort."
    },
    subjective_run: {
        title: "Run Efficiency (Spd/RPE)", sport: "Run", icon: "fa-person-running", colorVar: "#10b981", // Emerald
        refMin: 0.5, refMax: 1.0, invertRanges: false, rangeInfo: "Speed/RPE",
        description: "Speed maintained per unit of perceived effort."
    },
    subjective_swim: {
        title: "Swim Efficiency (Spd/RPE)", sport: "Swim", icon: "fa-person-swimming", colorVar: "#06b6d4", // Cyan
        refMin: 0.5, refMax: 1.0, invertRanges: false, rangeInfo: "Speed/RPE",
        description: "Water speed per unit of perceived effort."
    },

    // --- BIKE TECH ---
    endurance: {
        title: "Aerobic Efficiency (EF)", sport: "Bike", icon: "fa-heart-pulse", colorVar: "#3b82f6",
        refMin: 1.30, refMax: 1.70, invertRanges: false, rangeInfo: "Pw/HR",
        description: "Watts produced per heartbeat."
    },
    strength: {
        title: "Torque Efficiency", sport: "Bike", icon: "fa-dumbbell", colorVar: "#3b82f6",
        refMin: 2.5, refMax: 3.5, invertRanges: false, rangeInfo: "W/RPM",
        description: "Power per revolution (Force)."
    },

    // --- RUN TECH ---
    run: {
        title: "Running Economy", sport: "Run", icon: "fa-gauge-high", colorVar: "#10b981",
        refMin: 1.0, refMax: 1.6, invertRanges: false, rangeInfo: "m/beat",
        description: "Distance traveled per heartbeat."
    },
    mechanical: {
        title: "Mechanical Stiffness", sport: "Run", icon: "fa-ruler-horizontal", colorVar: "#10b981",
        refMin: 0.75, refMax: 0.95, invertRanges: false, rangeInfo: "Ratio",
        description: "Speed to Power ratio."
    },
    gct: {
        title: "Ground Contact", sport: "Run", icon: "fa-shoe-prints", colorVar: "#10b981",
        refMin: 220, refMax: 260, invertRanges: true, rangeInfo: "ms",
        description: "Time spent on ground (lower is better)."
    },
    vert: {
        title: "Vert Oscillation", sport: "Run", icon: "fa-arrows-up-down", colorVar: "#10b981",
        refMin: 6.0, refMax: 9.0, invertRanges: true, rangeInfo: "cm",
        description: "Vertical bounce height."
    },

    // --- SWIM TECH ---
    swim: {
        title: "Swim Index", sport: "Swim", icon: "fa-water", colorVar: "#06b6d4",
        refMin: 0.3, refMax: 0.6, invertRanges: false, rangeInfo: "m/beat",
        description: "Distance per heartbeat in water."
    }
};
