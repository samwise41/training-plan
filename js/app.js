import { Parser } from './parser.js?v=25';
import { renderKPI, updateDurationAnalysis } from './views/kpi.js?v=25'; 
import { renderGear, updateGearResult } from './views/gear.js?v=25';
import { renderZones } from './views/zones.js?v=25';
import { renderRoadmap } from './views/roadmap.js?v=25'; 
import { renderDashboard } from './views/dashboard.js?v=25'; 

console.log("🚀 App.js Loaded - Cache Buster v25");

const CONFIG = {
    PLAN_FILE: "endurance_plan.md",
    GEAR_FILE: "Gear.md",
    HISTORY_FILE: "history_archive.md", 
    WEATHER_MAP: {
        0: ["Clear", "☀️"], 1: ["Partly Cloudy", "🌤️"], 2: ["Partly Cloudy", "🌤️"], 3: ["Cloudy", "☁️"],
        45: ["Foggy", "🌫️"], 48: ["Foggy", "🌫️"], 51: ["Drizzle", "🌦️"], 61: ["Rain", "🌧️"], 63: ["Rain", "🌧️"],
        71: ["Snow", "❄️"], 95: ["Storm", "⛈️"]
    }
};

const App = {
    // ... (The rest of your App object remains exactly the same)
    // ... (Just ensure the fetch calls still include ?t=${Date.now()} which you already had)
    
    async init() {
        this.checkSecurity();
        try {
            // Your existing data fetch logic (Keep this!)
            const [planRes, gearRes, archiveRes] = await Promise.all([
                fetch(`./${CONFIG.PLAN_FILE}?t=${Date.now()}`),
                fetch(`./${CONFIG.GEAR_FILE}?t=${Date.now()}`),
                fetch(`./${CONFIG.HISTORY_FILE}?t=${Date.now()}`)
            ]);
            
            if (!planRes.ok) throw new Error(`Could not load ${CONFIG.PLAN_FILE}`);
            this.planMd = await planRes.text();
            this.gearMd = await gearRes.text();
            this.archiveMd = archiveRes.ok ? await archiveRes.text() : "";

            const currentLog = Parser.parseTrainingLog(this.planMd);
            const archiveLog = Parser.parseTrainingLog(this.archiveMd);
            this.logData = [...currentLog, ...archiveLog]; 
            
            this.setupEventListeners();
            window.addEventListener('hashchange', () => this.handleHashChange());
            this.handleHashChange(); 
            this.fetchWeather();
            
        } catch (e) {
            console.error("Init Error:", e);
        }
    },
    
    // ... (Rest of file unchanged)
    setupEventListeners() {
        const navMap = {
            'nav-dashboard': 'dashboard',
            'nav-trends': 'trends',
            'nav-logbook': 'logbook',
            'nav-roadmap': 'roadmap',
            'nav-gear': 'gear',
            'nav-zones': 'zones'
        };

        Object.keys(navMap).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => this.navigate(navMap[id]));
        });

        const btnOpen = document.getElementById('btn-sidebar-open');
        const btnClose = document.getElementById('btn-sidebar-close');
        const overlay = document.getElementById('sidebar-overlay');

        if (btnOpen) btnOpen.addEventListener('click', () => this.toggleSidebar());
        if (btnClose) btnClose.addEventListener('click', () => this.toggleSidebar());
        if (overlay) overlay.addEventListener('click', () => this.toggleSidebar());
    },

    async fetchWeather() {
        try {
            const locRes = await fetch('https://ipapi.co/json/');
            const locData = await locRes.json();
            if (locData.city) {
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${locData.latitude}&longitude=${locData.longitude}&current_weather=true&hourly=temperature_2m,weathercode&temperature_unit=fahrenheit&forecast_days=1`);
                const weatherData = await weatherRes.json();
                this.currentTemp = Math.round(weatherData.current_weather.temperature);
                this.hourlyWeather = weatherData.hourly || null; 
                const code = weatherData.current_weather.weathercode;
                const condition = CONFIG.WEATHER_MAP[code] || ["Cloudy", "☁️"];
                document.getElementById('weather-info').innerText = `${this.currentTemp}°F • ${condition[0]}`;
                document.getElementById('weather-icon-top').innerText = condition[1];
            }
        } catch (e) {
            console.error("Weather unavailable", e);
        }
    },

    updateStats() {
        if (!this.planMd) return;
        const statusMatch = this.planMd.match(/\*\*Status:\*\*\s*(Phase[^-]*)\s*-\s*(Week.*)/i);
        const currentPhaseRaw = statusMatch ? statusMatch[1].trim() : "Plan Active";
        const currentWeek = statusMatch ? statusMatch[2].trim() : "N/A";
        
        const phaseEl = document.getElementById('stat-phase');
        if (phaseEl) phaseEl.innerText = currentPhaseRaw;
        
        const weekEl = document.getElementById('stat-week');
        if (weekEl) weekEl.innerText = currentWeek;
        
        const eventSection = Parser.getSection(this.planMd, "Event Schedule");
        if (eventSection) {
            const eventLines = eventSection.split('\n').filter(l => l.includes('|') && !l.toLowerCase().includes('date') && !l.includes('---'));
            const nameEl = document.getElementById('stat-event-name');
            const countdownEl = document.getElementById('stat-event-countdown');
            if (eventLines.length > 0 && nameEl) {
                const parts = eventLines[0].split('|').map(p => p.trim()).filter(p => p.length > 0);
                if (parts.length >= 2) {
                    const eventDate = new Date(parts[0]);
                    nameEl.innerText = parts[1];
                    if (!isNaN(eventDate)) {
                        const today = new Date(); today.setHours(0,0,0,0);
                        const diff = Math.ceil((eventDate - today) / 86400000);
                        countdownEl.innerText = diff < 0 ? "Completed" : (diff === 0 ? "Today!" : `${Math.floor(diff/7)}w ${diff%7}d to go`);
                    }
                }
            }
        }
    },

    handleHashChange() {
        const hash = window.location.hash.substring(1); 
        const validViews = ['dashboard', 'trends', 'logbook', 'roadmap', 'gear', 'zones'];
        const view = validViews.includes(hash) ? hash : 'dashboard';
        this.renderView(view);
    },

    navigate(view) {
        window.location.hash = view;
    },

    renderView(view) {
        const titles = { 
            dashboard: 'Weekly Schedule', 
            trends: 'Trends & KPIs', 
            logbook: 'Logbook', 
            roadmap: 'Season Roadmap',
            gear: 'Gear Choice',
            zones: 'Training Zones'
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
                if (view === 'gear') {
                    const result = renderGear(this.gearMd, this.currentTemp, this.hourlyWeather);
                    content.innerHTML = result.html;
                    this.gearData = result.gearData;
                    this.updateGearResult(); 
                } 
                else if (view === 'zones') {
                    content.innerHTML = renderZones(this.planMd);
                } 
                else if (view === 'trends') {
                    const result = renderKPI(this.logData); 
                    content.innerHTML = result.html;
                    this.updateDurationAnalysis();
                } 
                else if (view === 'roadmap') {
                    content.innerHTML = renderRoadmap(this.planMd);
                }
                else if (view === 'logbook') {
                    const recent = Parser.getSection(this.planMd, "Appendix C: Training History Log") || Parser.getSection(this.planMd, "Training History");
                    const archive = Parser.getSection(this.archiveMd, "Training History");
                    const mdContent = (recent || "") + "\n\n" + (archive || "");
                    const safeMarked = window.marked ? window.marked.parse : (t) => t;
                    content.innerHTML = `<div class="markdown-body">${safeMarked(mdContent)}</div>`;
                }
                else {
                    const html = this.getStatsBar() + renderDashboard(this.planMd);
                    content.innerHTML = html;
                    this.updateStats();
                }
            } catch (err) {
                console.error("Render error:", err);
                content.innerHTML = `<p class="text-red-400">Error rendering view: ${err.message}</p>`;
            }
            content.classList.remove('opacity-0');
            
            if (window.innerWidth < 1024) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar.classList.contains('sidebar-open')) this.toggleSidebar();
            }
        }, 200);
    },

    updateDurationAnalysis() {
        if (this.logData) updateDurationAnalysis(this.logData);
    },

    updateGearResult() {
        if (this.gearData) updateGearResult(this.gearData);
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.toggle('sidebar-closed');
        sidebar.classList.toggle('sidebar-open');
        overlay.classList.toggle('hidden');
    }
};

window.App = App;
window.onload = () => App.init();
