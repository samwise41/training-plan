export const METRIC_DEFINITIONS = {
    // --- BIKE (Watts / RPE) ---
    subjective_bike: {
        title: "Bike RPE Efficiency", 
        sport: "Bike", 
        icon: "fa-person-biking", 
        colorVar: "var(--color-bike)",
        refMin: 25, refMax: 50, invertRanges: false, rangeInfo: "25 – 50 W/RPE",
        description: "Power produced per unit of perceived effort.",
        improvement: "• Aerobic Base<br>• Muscular Endurance"
    },

    // --- RUN (Speed / RPE) ---
    subjective_run: {
        title: "Run RPE Efficiency", 
        sport: "Run", 
        icon: "fa-person-running", 
        colorVar: "var(--color-run)",
        refMin: 0.6, refMax: 1.0, invertRanges: false, rangeInfo: "0.6 – 1.0 Speed/RPE",
        description: "Speed (m/s) produced per unit of perceived effort.",
        improvement: "• Run Economy<br>• Durability"
    },

    // --- SWIM (Speed / RPE) ---
    subjective_swim: {
        title: "Swim RPE Efficiency", 
        sport: "Swim", 
        icon: "fa-person-swimming", 
        colorVar: "var(--color-swim)",
        refMin: 0.15, refMax: 0.3, invertRanges: false, rangeInfo: "0.15 – 0.3 Speed/RPE",
        description: "Water speed (m/s) relative to effort.",
        improvement: "• Technique<br>• Drag Reduction"
    },
    
    // ... keep existing metrics ...
};
