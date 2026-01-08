// js/app.js - Fixed Dashboard Priority Version

(async function initApp() {
    console.log("🚀 Booting App (Fixed Plan-Priority Mode)...");

    const cacheBuster = Date.now();
    
    // Helper to safely import modules
    const safeImport = async (path, name) => {
        try {
            return await import(`${path}?t=${cacheBuster}`);
        } catch (e) {
            console.error(`⚠️ Failed to load module: ${name}`, e);
            return null;
        }
    };

    // --- 1. IMPORT MODULES ---
    const parserMod = await safeImport('./parser.js', 'Parser');
    const trendsMod = await safeImport('./views/trends.js', 'Trends');
    const gearMod = await safeImport('./views/gear.js', 'Gear');
    const zonesMod = await safeImport('./views/zones.js', 'Zones');
    const roadmapMod = await safeImport('./views/roadmap.js', 'Roadmap');
    const dashMod = await safeImport('./views/dashboard.js', 'Dashboard');
    const readinessMod = await safeImport('./views/readiness.js', 'Readiness');
    const metricsMod = await safeImport('./views/metrics.js', 'Metrics');

    // --- 2. DESTRUCTURE FUNCTIONS ---
    const Parser = parserMod?.Parser || { parseTrainingLog: () => [], getSection: () => "" };
    const { renderTrends, updateDurationAnalysis } = trendsMod || { renderTrends: () => ({html: ''}) };
    const { renderGear, updateGearResult } = gearMod || { renderGear: () => ({html: ''}) };
    const { renderZones } = zonesMod || { renderZones: () => '' };
    const { renderRoadmap } = roadmapMod || { renderRoadmap: () => '' };
    const { renderDashboard } = dashMod || { renderDashboard: () => '' };
    const { renderReadiness } = readinessMod || { renderReadiness: () => '' };
    const renderReadinessChart = readinessMod?.renderReadinessChart || (() => {});
    const { renderMetrics } = metricsMod || { renderMetrics: () => '' };

    const CONFIG = {
        PLAN_FILE: "endurance_plan.md",
        GEAR_FILE: "Gear.md",
        HISTORY_FILE: "MASTER_TRAINING_DATABASE.md", 
        WEATHER_MAP: {
            0: ["Clear", "☀️"], 1: ["Partly Cloudy", "🌤️"], 2: ["Partly Cloudy", "🌤️"], 3: ["Cloudy", "☁️"],
            45: ["Foggy", "🌫️"], 48: ["Foggy", "🌫️"], 51: ["Drizzle", "🌦️"], 61: ["Rain", "🌧️"], 63: ["Rain", "🌧️"],
            71: ["Snow", "❄️"], 95: ["Storm", "⛈️"]
        }
    };

    const App = {
        planMd: "",
        gearMd: "",
        archiveMd: "", 
        planOnlyData: [], // Exclusive data for the dashboard charts
        historyData: [], 
        allData: [],      // Combined data for historical trends
        gearData: null,
        currentTemp: null,

        async init() {
            this.checkSecurity();
            this.handleHashChange(); 
            
            try {
                const [planRes, gearRes, archiveRes] = await Promise.all([
                    fetch(`./${CONFIG.PLAN_FILE}?t=${cacheBuster}`),
                    fetch(`./${CONFIG.GEAR_FILE}?t=${cacheBuster}`),
                    fetch(`./${CONFIG.HISTORY_FILE}?t=${cacheBuster}`)
                ]);
                
                this.planMd = await planRes.text();
                this.gearMd = await gearRes.text();
                this.archiveMd = archiveRes.ok ? await archiveRes.text() : "";

                // --- NEW DATA STRATEGY ---
                // We keep them separate to avoid contamination
                this.planOnlyData = Parser.parseTrainingLog(this.planMd); 
                this.historyData = Parser.parseTrainingLog(this.archiveMd);
                
                // allData is now used ONLY for long-term health metrics/trends
                this.allData = [...this.planOnlyData, ...this.historyData].sort((a,b) => b.date - a.date);

                this.setupEventListeners();
                this.fetchWeather();
                this.renderView(window.location.hash.substring(1) || 'dashboard');
                
            } catch (e) {
                console.error("Init Error:", e);
            }
        },

        renderView(view) {
            const content = document.getElementById('content');
            content.classList.add('opacity-0');
            
            setTimeout(() => {
                try {
                    if (view === 'dashboard') {
                        // DASHBOARD: Only use data from the current plan
                        const html = this.getStatsBar() + renderDashboard(this.planMd, this.planOnlyData);
                        content.innerHTML = html;
                        this.updateStats(); 
                    } 
                    else if (view === 'trends') {
                        // TRENDS: Only use plan data for Volume bars
                        const result = renderTrends(this.planOnlyData); 
                        content.innerHTML = result.html;
                        this.updateDurationAnalysis(this.planOnlyData);
                    } 
                    else if (view === 'metrics') {
                        // METRICS: Pull from ALL data for history
                        content.innerHTML = renderMetrics(this.allData);
                    }
                    else if (view === 'logbook') {
                        const mdContent = (this.planMd || "") + "\n\n" + (this.archiveMd || "");
                        content.innerHTML = `<div class="markdown-body">${window.marked.parse(mdContent)}</div>`;
                    }
                    else if (view === 'gear') content.innerHTML = renderGear(this.gearMd, this.currentTemp).html;
                    else if (view === 'zones') content.innerHTML = renderZones(this.planMd);
                    else if (view === 'roadmap') content.innerHTML = renderRoadmap(this.planMd);
                    else if (view === 'readiness') {
                        content.innerHTML = renderReadiness(this.allData, this.planMd);
                        renderReadinessChart(this.allData);
                    }
                } catch (err) {
                    content.innerHTML = `<p class="text-red-400">Render error: ${err.message}</p>`;
                }
                content.classList.remove('opacity-0');
            }, 200);
        },

        // ... rest of App helper functions (checkSecurity, getStatsBar, setupEventListeners, etc.) ...
    };

    window.App = App;
    App.init();
})();
