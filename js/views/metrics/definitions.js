// js/views/metrics/definitions.js

export const SPORT_IDS = {
    RUN: [1],
    BIKE: [2],
    SWIM: [5, 26, 18]
};

export const METRIC_DEFINITIONS = {
    // --- SUBJECTIVE EFFICIENCY ---
    subjective_bike: {
        title: "Bike Efficiency (Pwr/RPE)", sport: "Bike", icon: "fa-bolt", colorVar: "var(--color-bike)",
        refMin: 20, refMax: 40, invertRanges: false, rangeInfo: "Watts per RPE point",
        description: "Power produced per unit of perceived effort.",
        improvement: "• Mental resilience<br>• Muscular endurance"
    },
    subjective_run: {
        title: "Run Efficiency (Spd/RPE)", sport: "Run", icon: "fa-person-running", colorVar: "var(--color-run)",
        refMin: 0.5, refMax: 1.0, invertRanges: false, rangeInfo: "Speed per RPE point",
        description: "Speed maintained per unit of perceived effort.",
        improvement: "• Tempo runs<br>• Pacing drills"
    },
    subjective_swim: {
        title: "Swim Efficiency (Spd/RPE)", sport: "Swim", icon: "fa-person-swimming", colorVar: "var(--color-swim)",
        refMin: 0.5, refMax: 1.0, invertRanges: false, rangeInfo: "Speed per RPE point",
        description: "Water speed per unit of perceived effort.",
        improvement: "• Stroke technique<br>• Breathing drills"
    },

    // --- PHYSIOLOGICAL ---
    vo2max: {
        title: "VO2 Max Estimate", sport: "All", icon: "fa-lungs", colorVar: "var(--color-all)",
        refMin: 45, refMax: 60, invertRanges: false, rangeInfo: "ml/kg/min",
        description: "Maximum oxygen volume your body can use.",
        improvement: "• HIIT Intervals<br>• Threshold training"
    },

    // --- STANDARD METRICS ---
    endurance: {
        title: "Aerobic Efficiency", sport: "Bike", icon: "fa-heart-pulse", colorVar: "var(--color-bike)",
        refMin: 1.30, refMax: 1.70, invertRanges: false, rangeInfo: "1.30 – 1.70 EF",
        description: "Watts produced per heartbeat.",
        improvement: "• Long Z2 Rides<br>• Consistent Volume"
    },
    strength: {
        title: "Torque Efficiency", sport: "Bike", icon: "fa-bolt", colorVar: "var(--color-bike)",
        refMin: 2.5, refMax: 3.5, invertRanges: false, rangeInfo: "2.5 – 3.5 W/RPM",
        description: "Watts per Revolution.",
        improvement: "• Low Cadence Intervals (50-60 RPM)<br>• Seated Climbing"
    },
    run: {
        title: "Running Economy", sport: "Run", icon: "fa-gauge-high", colorVar: "var(--color-run)",
        refMin: 1.0, refMax: 1.6, invertRanges: false, rangeInfo: "1.0 – 1.6 m/beat",
        description: "Distance traveled per heartbeat.",
        improvement: "• Strides & Hill Sprints<br>• Plyometrics"
    },
    mechanical: {
        title: "Mechanical Stiffness", sport: "Run", icon: "fa-ruler-horizontal", colorVar: "var(--color-run)",
        refMin: 0.75, refMax: 0.95, invertRanges: false, rangeInfo: "0.75 – 0.95 Ratio",
        description: "Ratio of Speed vs. Power.",
        improvement: "• High Cadence (170+)<br>• Form Drills (A-Skips)"
    },
    swim: {
        title: "Swim Efficiency", sport: "Swim", icon: "fa-person-swimming", colorVar: "var(--color-swim)",
        refMin: 0.3, refMax: 0.6, invertRanges: false, rangeInfo: "0.3 – 0.6 m/beat",
        description: "Distance traveled per heartbeat in water.",
        improvement: "• Drills (Catch/Pull)<br>• Long Steady Swims"
    },
    gct: {
        title: "Ground Contact Time", sport: "Run", icon: "fa-stopwatch", colorVar: "var(--color-run)",
        refMin: 220, refMax: 260, invertRanges: true, rangeInfo: "< 260 ms",
        description: "Time spent on the ground.",
        improvement: "• Increase Cadence<br>• 'Hot Coals' Imagery"
    },
    vert: {
        title: "Vertical Oscillation", sport: "Run", icon: "fa-arrows-up-down", colorVar: "var(--color-run)",
        refMin: 6.0, refMax: 9.0, invertRanges: true, rangeInfo: "6.0 – 9.0 cm",
        description: "Vertical bounce.",
        improvement: "• Core Stability<br>• Hill Repeats"
    },
    anaerobic: {
        title: "Anaerobic Impact", sport: "All", icon: "fa-fire", colorVar: "var(--color-all)",
        refMin: 2.0, refMax: 4.0, invertRanges: false, rangeInfo: "2.0 – 4.0",
        description: "Intensity stimulus on hard days.",
        improvement: "• All-out Sprints<br>• Full Recovery"
    }
};
