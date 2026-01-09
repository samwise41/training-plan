// js/app.js - Fixed Plan-Priority Version

(async function initApp() {
    const cacheBuster = Date.now();
    const safeImport = async (path) => import(`${path}?t=${cacheBuster}`);

    // --- 1. IMPORT MODULES ---
    const parserMod = await safeImport('./parser.js');
    const trendsMod = await safeImport('./views/trends.js');
    const dashMod = await safeImport('./views/dashboard.js');
    const metricsMod = await safeImport('./views/metrics.js');
    const readinessMod = await safeImport('./views/readiness.js');
    // ... import other modules (gear, zones, roadmap) as needed

    const Parser = parserMod.Parser;
    const { renderTrends, updateDurationAnalysis } = trendsMod;
    const { renderDashboard } = dashMod;
    const { renderMetrics } = metricsMod;

    const App = {
        planMd: "", archiveMd: "",
        planOnlyData: [], allData: [],

        async init() {
            try {
                const [planRes, archiveRes] = await Promise.all([
                    fetch(`./endurance_plan.md?t=${cacheBuster}`),
                    fetch(`./MASTER_TRAINING_DATABASE.md?t=${cacheBuster}`)
                ]);
                
                this.planMd = await planRes.text();
                this.archiveMd = await archiveRes.text();

                // --- DATA ISOLATION STRATEGY ---
                // Dashboard & Trends only use this:
                this.planOnlyData = Parser.parseTrainingLog(this.planMd); 
                
                // Historical Metrics use this:
                const historyData = Parser.parseTrainingLog(this.archiveMd);
                this.allData = [...this.planOnlyData, ...historyData].sort((a,b) => b.date - a.date);

                this.handleHashChange();
            } catch (e) { console.error("Init Error:", e); }
        },

        renderView(view) {
            const content = document.getElementById('content');
            if (view === 'dashboard') {
                // FIXED: Pulls Act/Plan strictly from the current plan file
                content.innerHTML = renderDashboard(this.planMd, this.planOnlyData);
            } else if (view === 'trends') {
                // FIXED: Volume bars only look at the plan file
                const result = renderTrends(this.planOnlyData);
                content.innerHTML = result.html;
                updateDurationAnalysis(this.planOnlyData);
            } else if (view === 'metrics') {
                content.innerHTML = renderMetrics(this.allData);
            }
            // ... handle other views (gear, logbook, etc.)
        },

        handleHashChange() {
            const view = window.location.hash.substring(1) || 'dashboard';
            this.renderView(view);
        }
    };

    App.init();
})();
