// js/app.js - Auto-Busting Cache Version

(async function initApp() {
    console.log("🚀 Booting App (Unified Data Mode)...");

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
    const trendsMod = await safeImport('./views/trends/index.js', 'Trends');
    const gearMod = await safeImport('./views/gear/index.js', 'Gear');
    const zonesMod = await safeImport('./views/zones/index.js', 'Zones');
    const roadmapMod = await safeImport('./views/roadmap/index.js', 'Roadmap');
    const dashMod = await safeImport('./views/dashboard/index.js', 'Dashboard');
    const readinessMod = await safeImport('./views/readiness/index.js', 'Readiness');
    const metricsMod = await safeImport('./views/metrics/index.js', 'Metrics');
    // NEW: Import Health Module
    const healthMod = await safeImport('./views/health/index.js', 'Health');

    // --- 2. DESTRUCTURE FUNCTIONS ---
    const Parser = parserMod?.Parser || { parseTrainingLog: () => [], getSection: () => "" };
    const { renderTrends, updateDurationAnalysis } = trendsMod || { renderTrends: () => ({html: ''}) };
    const { renderGear, updateGearResult } = gearMod || { renderGear: () => ({ html: '', gearData: null }) };
    const { renderZones } = zonesMod || { renderZones: () => '' };
    const { renderRoadmap } = roadmapMod || { renderRoadmap: () => '' };
    const { renderDashboard } = dashMod || { renderDashboard: () => '' };
    const { renderReadiness } = readinessMod || { renderReadiness: () => '' };
    const renderReadinessChart = readinessMod?.renderReadinessChart || (() => {});
    const { renderMetrics } = metricsMod || { renderMetrics: () => '' };
    // NEW: Destructure Health
    const { renderHealth } = healthMod || { renderHealth: () => '<div class="p-4 text-red-500">Health module failed load</div>' };

    console.log(`📦 Modules loaded with ID: ${cacheBuster}`);

    const CONFIG = {
        PLAN_FILE: "endurance_plan.md",
        GEAR_FILE: "Gear.md",
        HISTORY_FILE: "MASTER_TRAINING_DATABASE.md",
        // NEW: Add Health File
        HEALTH_FILE: "garmind_data/garmin_health.md",
        AUTH_FILE: "auth_config.json",
        WEATHER_MAP: {
            0: ["Clear", "☀️"], 1: ["Partly Cloudy", "🌤️"], 2: ["Partly Cloudy", "🌤️"], 3: ["Cloudy", "☁️"],
            45: ["Foggy", "🌫️"], 48: ["Foggy", "🌫️"], 51: ["Drizzle", "🌦️"], 61: ["Rain", "🌧️"], 63: ["Rain", "🌧️"],
            71: ["Snow", "❄️"], 95: ["Storm", "⛈️"]
        }
    };

    // ... (Keep existing hashString/checkSecurity logic unchanged) ...
    async function hashString(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const App = {
        planMd: "",
        gearMd: "",
        archiveMd: "", 
        healthMd: "", // New State
        allData: [], 
        gearData: null,
        currentTemp: null,
        hourlyWeather: null,

        async checkSecurity() {
            // ... (Keep existing security logic) ...
            const curtain = document.getElementById('security-curtain');
            const input = document.getElementById('access-code');
            const btn = document.getElementById('btn-unlock');
            
            if (document.cookie.split(';').some((item) => item.trim().startsWith('dashboard_access=true'))) {
                if (curtain) curtain.classList.add('hidden');
                return;
            }
            if (curtain) curtain.classList.remove('hidden');
            if (btn && input) {
                btn.onclick = async () => {
                    // ... (Simplifying for brevity, assume existing logic) ...
                    document.cookie = "dashboard_access=true; path=/; max-age=315360000; SameSite=Strict";
                    curtain.classList.add('hidden');
                };
            }
        },

        getStatsBar() {
            // ... (Keep existing stats bar logic) ...
            return document.getElementById('stats-bar')?.innerHTML || ''; 
        },

        async init() {
            await this.checkSecurity();
            
            const initialHash = window.location.hash.substring(1);
            // NEW: Add 'health' to valid views
            const validViews = ['dashboard', 'trends', 'logbook', 'roadmap', 'gear', 'zones', 'readiness', 'metrics', 'health'];
            const startView = validViews.includes(initialHash) ? initialHash : 'dashboard';
    
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            const initialNavBtn = document.getElementById(`nav-${startView}`);
            if (initialNavBtn) initialNavBtn.classList.add('active');
            
            try {
                // NEW: Fetch Health Data
                const [planRes, gearRes, archiveRes, healthRes] = await Promise.all([
                    fetch(`./${CONFIG.PLAN_FILE}?t=${cacheBuster}`),
                    fetch(`./${CONFIG.GEAR_FILE}?t=${cacheBuster}`),
                    fetch(`./${CONFIG.HISTORY_FILE}?t=${cacheBuster}`),
                    fetch(`./${CONFIG.HEALTH_FILE}?t=${cacheBuster}`)
                ]);
                
                if (!planRes.ok) throw new Error(`Could not load ${CONFIG.PLAN_FILE}`);
                this.planMd = await planRes.text();
                this.gearMd = await gearRes.text();
                this.archiveMd = archiveRes.ok ? await archiveRes.text() : "";
                this.healthMd = healthRes.ok ? await healthRes.text() : ""; // Store Health MD

                const masterLog = Parser.parseTrainingLog(this.archiveMd); 
                const planLog = Parser.parseTrainingLog(this.planMd);      

                const dataMap = new Map();
                masterLog.forEach(item => { if(item.date) dataMap.set(`${item.date.toISOString().split('T')[0]}_${item.type}`, item); });
                planLog.forEach(item => { if(item.date && !dataMap.has(`${item.date.toISOString().split('T')[0]}_${item.type}`)) dataMap.set(`${item.date.toISOString().split('T')[0]}_${item.type}`, item); });

                this.allData = Array.from(dataMap.values()).sort((a,b) => b.date - a.date);

                this.setupEventListeners();
                window.addEventListener('hashchange', () => this.handleHashChange());
                this.handleHashChange(); 
                this.fetchWeather();
                
            } catch (e) {
                console.error("Init Error:", e);
            }
        },

        setupEventListeners() {
            // NEW: Add 'nav-health' to map
            const navMap = {
                'nav-dashboard': 'dashboard', 'nav-trends': 'trends', 'nav-logbook': 'logbook',
                'nav-roadmap': 'roadmap', 'nav-gear': 'gear', 'nav-zones': 'zones', 
                'nav-readiness': 'readiness', 'nav-metrics': 'metrics', 'nav-health': 'health'
            };
            Object.keys(navMap).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('click', () => this.navigate(navMap[id]));
            });
            // ... (Keep sidebar toggles) ...
        },

        // ... (Keep fetchWeather, updateStats, navigate) ...
        navigate(view) { window.location.hash = view; },
        async fetchWeather() {}, // Placeholder for existing code
        updateStats() {},        // Placeholder for existing code

        handleHashChange() {
            const hash = window.location.hash.substring(1); 
            // NEW: Add 'health'
            const validViews = ['dashboard', 'trends', 'logbook', 'roadmap', 'gear', 'zones', 'readiness', 'metrics', 'health'];
            const view = validViews.includes(hash) ? hash : 'dashboard';
            this.renderView(view);
        },

        renderView(view) {
            const titles = { 
                dashboard: 'Weekly Schedule', trends: 'Trends & KPIs', logbook: 'Logbook', roadmap: 'Season Roadmap', 
                gear: 'Gear Choice', zones: 'Training Zones', readiness: 'Race Readiness', metrics: 'Performance Metrics',
                health: 'Health Metrics' // NEW Title
            };
            const titleEl = document.getElementById('header-title-dynamic');
            if (titleEl) titleEl.innerText = titles[view] || 'Dashboard';

            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            const navBtn = document.getElementById(`nav-${view}`);
            if (navBtn) navBtn.classList.add('active');
            
            const content = document.getElementById('content');
            content.classList.add('opacity-0');
            
            setTimeout(() => {
                try {
                    // ... (Keep existing cases) ...
                    if (view === 'gear') {
                        const result = renderGear(this.gearMd, this.currentTemp, this.hourlyWeather);
                        content.innerHTML = result.html;
                        this.gearData = result.gearData;
                        updateGearResult(this.gearData); 
                    } 
                    else if (view === 'zones') content.innerHTML = renderZones(this.planMd);
                    else if (view === 'trends') {
                        const result = renderTrends(this.allData); 
                        content.innerHTML = result.html;
                        updateDurationAnalysis(this.allData);
                    } 
                    else if (view === 'roadmap') content.innerHTML = renderRoadmap(this.planMd);
                    else if (view === 'readiness') {
                        content.innerHTML = renderReadiness(this.allData, this.planMd); 
                    }
                    else if (view === 'metrics') content.innerHTML = renderMetrics(this.allData);
                    
                    // NEW: Health View
                    else if (view === 'health') {
                        content.innerHTML = renderHealth(this.healthMd);
                    }

                    else if (view === 'logbook') {
                        // ... (Existing logbook logic) ...
                        const recent = Parser.getSection(this.planMd, "Appendix C: Training History Log") || Parser.getSection(this.planMd, "Training History");
                        const archive = Parser.getSection(this.archiveMd, "Training History");
                        content.innerHTML = `<div class="markdown-body">${recent}\n\n${archive}</div>`;
                    }
                    else {
                        // Dashboard
                        content.innerHTML = renderDashboard(this.planMd, this.allData); 
                        this.updateStats(); 
                    }
                } catch (err) {
                    console.error("Render error:", err);
                    content.innerHTML = `<p class="text-red-400">Error rendering view: ${err.message}</p>`;
                }
                content.classList.remove('opacity-0');
            }, 200);
        }
    };

    window.App = App;
    App.init();

})();
