import { Parser } from './parser.js';
import { renderKPI, updateDurationAnalysis } from './views/kpi.js';
import { renderGear, updateGearResult } from './views/gear.js';
import { renderZones } from './views/zones.js';

const CONFIG = {
    PLAN_FILE: "endurance_plan.md",
    GEAR_FILE: "Gear.md",
    WEATHER_MAP: {
        0: ["Clear", "☀️"], 1: ["Partly Cloudy", "🌤️"], 2: ["Partly Cloudy", "🌤️"], 3: ["Cloudy", "☁️"],
        45: ["Foggy", "🌫️"], 48: ["Foggy", "🌫️"], 51: ["Drizzle", "🌦️"], 61: ["Rain", "🌧️"], 63: ["Rain", "🌧️"],
        71: ["Snow", "❄️"], 95: ["Storm", "⛈️"]
    }
};

const App = {
    planMd: "",
    gearMd: "",
    logData: [],
    gearData: null,
    currentTemp: null,
    hourlyWeather: null,

    async init() {
        try {
            // Fetch Data
            const [planRes, gearRes] = await Promise.all([
                fetch(`./${CONFIG.PLAN_FILE}?t=${Date.now()}`),
                fetch(`./${CONFIG.GEAR_FILE}?t=${Date.now()}`)
            ]);
            
            this.planMd = planRes.ok ? await planRes.text() : "";
            this.gearMd = gearRes.ok ? await gearRes.text() : "";
            
            // Initial Setups
            this.updateStats();
            this.fetchWeather().catch(err => console.warn("Weather error:", err));
            
            // Setup Navigation
            window.addEventListener('hashchange', () => this.handleHashChange());
            this.handleHashChange();
            
        } catch (e) {
            console.error("Init Error:", e);
            document.body.innerHTML = `<div class="p-10 text-white"><h1>Error Loading Dashboard</h1><p>${e.message}</p></div>`;
        }
    },

    async fetchWeather() {
        try {
            const locRes = await fetch('https://ipapi.co/json/');
            const locData = await locRes.json();
            
            if (locData.city) {
                document.getElementById('weather-location').innerText = `${locData.city}, ${locData.region_code}`;
                const lat = locData.latitude;
                const lon = locData.longitude;
                
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode,precipitation_probability&temperature_unit=fahrenheit&forecast_days=1`);
                const weatherData = await weatherRes.json();
                
                this.currentTemp = Math.round(weatherData.current_weather.temperature);
                this.hourlyWeather = weatherData.hourly || null; 
                const code = weatherData.current_weather.weathercode;

                const condition = CONFIG.WEATHER_MAP[code] || ["Cloudy", "☁️"];
                document.getElementById('weather-info').innerText = `${this.currentTemp}°F • ${condition[0]}`;
                document.getElementById('weather-icon-top').innerText = condition[1];
            }
        } catch (e) {
            console.error("Weather Error", e);
            document.getElementById('weather-info').innerText = "Weather Unavailable";
        }
    },

    updateStats() {
        if (!this.planMd) return;
        
        // 1. Update Phase and Week
        const statusMatch = this.planMd.match(/\*\*Status:\*\*\s*(Phase[^-]*)\s*-\s*(Week.*)/i);
        const currentPhaseRaw = statusMatch ? statusMatch[1].trim() : "Plan Active";
        const currentWeek = statusMatch ? statusMatch[2].trim() : "N/A";
        
        let dateRange = "";
        const phaseNumMatch = currentPhaseRaw.match(/Phase\s*(\d+)/i);
        if (phaseNumMatch) {
            const pNum = phaseNumMatch[1];
            const phasesSection = Parser.getSection(this.planMd, "Periodization Phases");
            if (phasesSection) {
                const lines = phasesSection.split('\n');
                for (let line of lines) {
                    if (line.trim().startsWith('|') && line.includes(`**${pNum}.`)) {
                        const cols = line.split('|');
                        if (cols.length > 2) { dateRange = cols[2].trim(); break; }
                    }
                }
            }
        }

        const phaseEl = document.getElementById('stat-phase');
        if (phaseEl) {
            if (dateRange) phaseEl.innerHTML = `${currentPhaseRaw}<span class="block text-xs text-slate-400 mt-1 font-normal">${dateRange}</span>`;
            else phaseEl.innerText = currentPhaseRaw;
        }

        const weekEl = document.getElementById('stat-week');
        if (weekEl) weekEl.innerText = currentWeek;
        
        // 2. Update Next Event
        const eventSection = Parser.getSection(this.planMd, "Event Schedule");
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
                    if (diff < 0) countdownEl.innerText = "Completed";
                    else if (diff === 0) countdownEl.innerText = "Event Today!";
                    else {
                        const w = Math.floor(diff / 7);
                        const d = diff % 7;
                        countdownEl.innerText = `${w} weeks, ${d} days to go`;
                    }
                } else countdownEl.innerText = "Date TBD";
            }
        }
    },

    handleHashChange() {
        const hash = window.location.hash.substring(1); 
        const validViews = ['schedule', 'phases', 'zones', 'gear', 'full', 'history', 'kpi'];
        const view = validViews.includes(hash) ? hash : 'schedule';
        this.renderView(view);
    },

    navigate(view) {
        window.location.hash = view;
    },

    renderView(view) {
        // Update Title
        const titles = { 
            schedule: 'Weekly Schedule', phases: 'Phases', zones: 'Zones', 
            gear: 'Gear Selection', full: 'Master Plan', history: 'Training History',
            kpi: 'Performance KPIs'
        };
        const titleEl = document.getElementById('header-title-dynamic');
        if (titleEl) titleEl.innerText = titles[view] || 'Dashboard';

        // Update Nav Active State
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const navBtn = document.getElementById(`nav-${view}`);
        if (navBtn) navBtn.classList.add('active');
        
        // Transition Content
        const content = document.getElementById('content');
        content.classList.add('opacity-0');
        
        setTimeout(() => {
            try {
                if (view === 'gear') {
                    const result = renderGear(this.gearMd, this.currentTemp, this.hourlyWeather);
                    content.innerHTML = result.html;
                    this.gearData = result.gearData;
                    // Trigger initial update for the default selection
                    this.updateGearResult(); 
                } 
                else if (view === 'zones') {
                    content.innerHTML = renderZones(this.planMd);
                } 
                else if (view === 'kpi') {
                    const result = renderKPI(this.planMd);
                    content.innerHTML = result.html;
                    this.logData = result.logData;
                    this.updateDurationAnalysis();
                } 
                else {
                    // Standard Markdown Views
                    let sectionTitle = "Weekly Schedule"; // Default
                    if (view === 'phases') sectionTitle = "Periodization";
                    
                    let mdContent = "";
                    if (view === 'full') {
                        mdContent = this.planMd;
                    } 
                    else if (view === 'history') {
                        mdContent = Parser.getSection(this.planMd, "Appendix C: Training History Log") || Parser.getSection(this.planMd, "Training History");
                    }
                    else {
                        mdContent = Parser.getSection(this.planMd, sectionTitle);
                    }
                    
                    content.innerHTML = marked.parse(mdContent || "*Content not found.*");
                }
            } catch (err) {
                console.error("Render error:", err);
                content.innerHTML = `<p class="text-red-400">Error rendering view: ${err.message}</p>`;
            }
            content.classList.remove('opacity-0');
            
            // Auto-close sidebar on mobile
            if (window.innerWidth < 1024) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar.classList.contains('sidebar-open')) this.toggleSidebar();
            }
        }, 200);
    },

    // Exposed Methods for HTML Event Handlers
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

// Expose App to window so HTML onchange/onclick events can find it
window.App = App;
window.onload = () => App.init();
