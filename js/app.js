import { Parser } from './parser.js';
import { renderKPI, updateDurationAnalysis } from './views/kpi.js';
// import { renderGear, updateGearResult } from './views/gear.js'; // (Create similarly)

const CONFIG = {
    PLAN_FILE: "endurance_plan.md",
    GEAR_FILE: "Gear.md",
    WEATHER_MAP: { 0: ["Clear", "☀️"], /* ... */ }
};

const App = {
    planMd: "",
    gearMd: "",
    logData: [],

    async init() {
        try {
            const [planRes, gearRes] = await Promise.all([
                fetch(`./${CONFIG.PLAN_FILE}?t=${Date.now()}`),
                fetch(`./${CONFIG.GEAR_FILE}?t=${Date.now()}`)
            ]);
            this.planMd = planRes.ok ? await planRes.text() : "";
            this.gearMd = gearRes.ok ? await gearRes.text() : "";
            
            this.updateStats();
            this.fetchWeather();
            
            window.addEventListener('hashchange', () => this.handleHashChange());
            this.handleHashChange();
        } catch (e) {
            console.error("Init Error", e);
        }
    },

    // ... (fetchWeather, updateStats logic remains same) ...

    renderView(view) {
        // ... (Standard logic) ...
        
        if (view === 'kpi') {
            const result = renderKPI(this.planMd);
            document.getElementById('content').innerHTML = result.html;
            this.logData = result.logData;
            // Initialize the calculator
            this.updateDurationAnalysis(); 
        } 
        else if (view === 'gear') {
            // Logic for gear...
        }
        else {
            // Standard Markdown rendering
            const content = Parser.getSection(this.planMd, "Weekly Schedule"); // etc based on view
            document.getElementById('content').innerHTML = marked.parse(content || "");
        }
    },

    // Wrapper for the KPI calculator
    updateDurationAnalysis() {
        updateDurationAnalysis(this.logData);
    },
    
    navigate(view) {
        window.location.hash = view;
    },
    
    toggleSidebar() {
        // ...
    }
};

// Make App global so HTML onclick/onchange events can see it
window.App = App;
window.onload = () => App.init();
