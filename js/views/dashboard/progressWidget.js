// js/views/dashboard/progressWidget.js

// --- DEBUG MODE ---

// 1. This is the Event Card that Index.js puts in the Top Row
export function renderNextEvent(planMd) {
    return `
        <div style="border: 2px solid red; padding: 20px; background: #330000; color: white; font-weight: bold; border-radius: 10px; margin-bottom: 20px;">
            🟥 TEST: I AM THE TOP ROW EVENT CARD
        </div>
    `;
}

// 2. This is the Progress Widget Area
export function renderProgressWidget(plannedWorkouts, fullLogData) { 
    return `
        <div style="border: 2px solid yellow; padding: 20px; background: #333300; color: yellow; font-weight: bold; border-radius: 10px; margin-bottom: 20px;">
            🟨 TEST: I AM THE PROGRESS WIDGET AREA
            <br>
            (If you see a card inside or below me, the cache is not cleared)
        </div>
    `;
}
