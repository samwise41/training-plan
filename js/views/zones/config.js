// js/views/zones/config.js

export const CONFIG = {
    WKG_SCALE: { min: 1.0, max: 6.0 },
    CATEGORIES: [
        { threshold: 5.05, label: "Exceptional", color: "#a855f7" },
        { threshold: 3.93, label: "Very Good",   color: "#3b82f6" },
        { threshold: 2.79, label: "Good",        color: "#22c55e" },
        { threshold: 2.23, label: "Fair",        color: "#f97316" },
        { threshold: 0.00, label: "Untrained",   color: "#ef4444" }
    ]
};
