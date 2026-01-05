import { Parser } from './parser.js';
// CACHE BUSTER: Added ?v=10 to force browser to re-download kpi.js
import { renderKPI, updateDurationAnalysis } from './views/kpi.js?v=10'; 
import { renderGear, updateGearResult } from './views/gear.js';
import { renderZones } from './views/zones.js';
import { renderPhases } from './views/phases.js';

console.log("🚀 App.js Safe Mode Loaded");

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
    planMd: "",
    gearMd: "",
    archiveMd: "", 
    logData: [],
    gearData: null,
    currentTemp: null,
    hourlyWeather: null,

    checkSecurity() {
        console.log("🔒 Checking Security...");
        const curtain = document.getElementById('security-curtain');
        const input = document.getElementById('access-code');
        const btn = document.getElementById('btn-unlock');
        const errorMsg = document.getElementById('access-error');

        // 1. Check Cookie
        if (document.cookie.split(';').some((item) => item.trim().startsWith('dashboard_access=true'))) {
            console.log("✅ Cookie found. Unlocking.");
            if (curtain) curtain.style.display = 'none';
            return;
        }

        // 2. Bind Unlock Button
        if (btn && input) {
            console.log("🔒 Lock active. Waiting for password.");
            
            const unlock = () => {
                const code = input.value.trim(); // Trim whitespace
                console.log("🔑 Attempting unlock with:", code);
                
                if (code === 'training2026') { 
                    console.log("🔓 Access Granted!");
                    document.cookie = "dashboard_access=true; path=/; max-age=315360000; SameSite=Strict";
                    curtain.style.opacity = '0';
                    setTimeout(() => curtain.style.display = 'none', 500);
                } else {
                    console.warn("⛔ Access Denied");
                    input.value = '';
                    if (errorMsg) errorMsg.classList.remove('hidden');
                    input.classList.add('border-red-500');
                    input.classList.remove('border-slate-700');
                }
            };

            btn.onclick = unlock; 
            input.onkeypress = (e) => {
                if (e.key === 'Enter') unlock();
            };
            input.oninput = () => {
                if (errorMsg) errorMsg.classList.add('hidden');
                input.classList.remove('border-red-500');
                input.classList.add('border-slate-700');
            };
        } else {
            console.error("❌ Security elements not found in HTML!");
        }
    },

    getStatsBar() {
        return `
            <div id="stats-bar" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Current Phase</p>
                    <p class="text-lg font-semibold text-blue-400" id="stat-phase">--</p>
                </div>
                <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Current Week</p>
                    <p class="text-lg font-semibold text-slate-300" id="stat-week">--</p>
                </div>
                <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Next Event</p>
                    <div id="stat-event">
                        <p class="text-lg font-semibold text-emerald-400 leading-tight" id="stat-event-name">--</p>
                        <p class="text-[10px] font-normal text-slate-400 mt-1 uppercase" id="stat-event-countdown">--</p>
                    </div>
                </div>
            </div>
        `;
    },

    async init() {
        this.checkSecurity(); // Run first!
        console.log("App init started");
        
        try {
            const [planRes, gearRes, archiveRes] = await Promise.all([
                fetch(`./${CONFIG.PLAN_FILE}?t=${Date.now()}`),
                fetch(`./${CONFIG.GEAR_FILE}?t=${Date.now()}`),
                fetch(`./${CONFIG.HISTORY_FILE}?t=${Date.now()}`)
            ]);
            
            if (!planRes.ok) throw new Error(`Could not load ${CONFIG.PLAN_FILE}`);
            if (!gearRes.ok) throw new Error(`Could not load ${CONFIG.GEAR_FILE}`);
            
            this.planMd = await planRes.text();
            this.gearMd = await gearRes.text();
            
            if (archiveRes.ok) this.archiveMd = await archiveRes.text();
            else this.archiveMd = "";

            const currentLog = Parser.parseTrainingLog(this.planMd);
            const archiveLog = Parser.parseTrainingLog(this.archiveMd);
            this.logData = [...currentLog, ...archiveLog]; 
            
            this.setupEventListeners();
            window.addEventListener('hashchange', () => this.handleHashChange());
            this.handleHashChange();
            this.fetchWeather().catch(err => console.warn("Weather error:", err));
            
        } catch (e) {
            console.error("Init Error:", e);
            const curtain = document.getElementById('security-curtain');
            if (curtain) {
                curtain.innerHTML += `<p class='text-red-500 mt-4 font-bold'>System Error: ${e.message}</p>`;
            }
        }
    },

    setupEventListeners() {
        const bindNav = (id, view) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => this.navigate(view));
        };
        ['schedule', 'gear', 'kpi', 'zones', 'phases', 'history', 'full'].forEach(v => bindNav(`nav-${v}`, v));

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
                document.getElementById('weather-location').innerText = `${locData.city}, ${locData.region_code}`;
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
            console.error("Weather Error", e);
            document.getElementById('weather-info').innerText = "Weather Unavailable";
        }
    },

    updateStats() {
        if (!this.planMd) return;
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
        const titles = { 
            schedule: 'Weekly Schedule', phases: 'Phases', zones: 'Zones', 
            gear: 'Gear Selection', full: 'Master Plan', history: 'Training History',
            kpi: 'Performance KPIs'
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
                else if (view === 'kpi') {
                    const result = renderKPI(this.logData); 
                    content.innerHTML = result.html;
                    this.updateDurationAnalysis();
                } 
                else if (view === 'phases') {
                    content.innerHTML = renderPhases(this.planMd);
                }
                else {
                    let sectionTitle = "Weekly Schedule";
                    
                    let mdContent = "";
                    if (view === 'full') {
                        mdContent = this.planMd;
                    } 
                    else if (view === 'history') {
                        const recent = Parser.getSection(this.planMd, "Appendix C: Training History Log") || Parser.getSection(this.planMd, "Training History");
                        const archive = Parser.getSection(this.archiveMd, "Training History");
                        mdContent = (recent || "") + "\n\n" + (archive || "");
                    }
                    else {
                        mdContent = Parser.getSection(this.planMd, sectionTitle);
                    }
                    
                    const safeMarked = window.marked ? window.marked.parse : (t) => t;
                    let html = safeMarked(mdContent || "*Content not found.*");
                    if (view === 'schedule') {
                        html = this.getStatsBar() + html;
                    }
                    content.innerHTML = html;
                    if (view === 'schedule') this.updateStats();
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
