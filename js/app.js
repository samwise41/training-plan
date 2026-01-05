import { Parser } from './parser.js';
// CACHE BUSTER: Incremented to ?v=22 to force style updates
import { renderTrends } from './views/trends.js?v=22'; 
import { renderLogbook, updateDurationAnalysis } from './views/logbook.js?v=22';
import { renderRoadmap } from './views/roadmap.js?v=22';
import { renderResources, updateGearResult } from './views/resources.js?v=22';

console.log("🚀 App.js v2.2 Loaded - Big Cards Active");

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

    // --- UPDATED: Grid Renderer with Bigger Fonts ---
    renderScheduleGrid(mdContent) {
        if (!mdContent) return '<p class="text-slate-500 italic">No schedule data found.</p>';

        const lines = mdContent.split('\n').filter(line => line.trim().startsWith('|') && !line.includes('---'));
        if (lines.length === 0) return '<p class="text-slate-500 italic">No schedule rows found.</p>';

        const rows = lines[0].toLowerCase().includes('day') ? lines.slice(1) : lines;

        let gridHtml = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">';

        rows.forEach(row => {
            const cols = row.split('|').map(c => c.trim()).filter(c => c);
            
            let day = "Day";
            let activity = "Rest";
            let duration = "-";
            let notes = "";
            let icon = '<i class="fa-solid fa-bed text-slate-500"></i>';
            let colorClass = "border-slate-700 bg-slate-800/50";

            if (cols.length >= 3) {
                day = cols.find(c => /Mon|Tue|Wed|Thu|Fri|Sat|Sun/i.test(c)) || cols[0];
                duration = cols.find(c => /\d+\s*(min|hr|hour)/i.test(c)) || (cols.length > 2 ? cols[2] : "-");
                activity = cols.find(c => c !== day && c !== duration && c.length < 50) || "Workout";
                notes = cols.find(c => c.length > 50) || "";
                
                const actLower = activity.toLowerCase();
                const typeLower = (cols[2] || "").toLowerCase();
                
                if (actLower.includes('bike') || typeLower.includes('bike')) {
                    icon = '<i class="fa-solid fa-bicycle text-blue-500"></i>';
                    colorClass = "border-blue-900/40 bg-gradient-to-br from-blue-900/20 to-slate-900 hover:border-blue-500/50";
                } else if (actLower.includes('run') || typeLower.includes('run')) {
                    icon = '<i class="fa-solid fa-person-running text-emerald-500"></i>';
                    colorClass = "border-emerald-900/40 bg-gradient-to-br from-emerald-900/20 to-slate-900 hover:border-emerald-500/50";
                } else if (actLower.includes('swim') || typeLower.includes('swim')) {
                    icon = '<i class="fa-solid fa-person-swimming text-cyan-500"></i>';
                    colorClass = "border-cyan-900/40 bg-gradient-to-br from-cyan-900/20 to-slate-900 hover:border-cyan-500/50";
                } else if (actLower.includes('rest')) {
                    colorClass = "border-slate-800 bg-slate-900/30 opacity-60 hover:opacity-100";
                }
            }

            // Cleanup text for display
            const cleanActivity = activity.replace(/\[.*?\]/g, '').trim();
            
            // Format Duration to be compact (e.g. "60 mins" -> "60") if you wanted, 
            // but sticking to your request to just make the existing text bigger:
            
            gridHtml += `
                <div class="border ${colorClass} rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 flex flex-col justify-between group min-h-[180px]">
                    <div>
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-xs font-bold uppercase tracking-widest text-slate-500 pt-1">${day}</span>
                            <div class="text-2xl opacity-90 group-hover:scale-110 transition-transform">${icon}</div>
                        </div>
                        
                        <div class="text-3xl font-black text-white tracking-tight mb-2">
                            ${duration}
                        </div>

                        <h3 class="text-lg font-medium text-slate-300 leading-tight">
                            ${cleanActivity}
                        </h3>
                    </div>
                    
                    ${notes ? `<div class="text-xs text-slate-500 border-t border-slate-700/50 pt-3 mt-4 line-clamp-2 group-hover:line-clamp-none transition-all">${notes}</div>` : ''}
                </div>
            `;
        });

        gridHtml += '</div>';
        return gridHtml;
    },

    checkSecurity() {
        const curtain = document.getElementById('security-curtain');
        const input = document.getElementById('access-code');
        const btn = document.getElementById('btn-unlock');
        const errorMsg = document.getElementById('access-error');

        if (document.cookie.split(';').some((item) => item.trim().startsWith('dashboard_access=true'))) {
            if (curtain) curtain.style.display = 'none';
            return;
        }

        if (btn && input) {
            const unlock = () => {
                if (input.value.trim() === 'training2026') { 
                    document.cookie = "dashboard_access=true; path=/; max-age=315360000; SameSite=Strict";
                    curtain.style.opacity = '0';
                    setTimeout(() => curtain.style.display = 'none', 500);
                } else {
                    input.value = '';
                    if (errorMsg) errorMsg.classList.remove('hidden');
                    input.classList.add('border-red-500');
                    input.classList.remove('border-slate-700');
                }
            };
            btn.onclick = unlock; 
            input.onkeypress = (e) => { if (e.key === 'Enter') unlock(); };
            input.oninput = () => { if (errorMsg) errorMsg.classList.add('hidden'); input.classList.remove('border-red-500'); input.classList.add('border-slate-700'); };
        }
    },

    getStatsBar() {
        return `
            <div id="stats-bar" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
        this.checkSecurity(); 
        try {
            const [planRes, gearRes, archiveRes] = await Promise.all([
                fetch(`./${CONFIG.PLAN_FILE}?t=${Date.now()}`),
                fetch(`./${CONFIG.GEAR_FILE}?t=${Date.now()}`),
                fetch(`./${CONFIG.HISTORY_FILE}?t=${Date.now()}`)
            ]);
            
            if (!planRes.ok) throw new Error(`Could not load ${CONFIG.PLAN_FILE}`);
            
            this.planMd = await planRes.text();
            this.gearMd = gearRes.ok ? await gearRes.text() : "";
            this.archiveMd = archiveRes.ok ? await archiveRes.text() : "";

            const currentLog = Parser.parseTrainingLog(this.planMd);
            const archiveLog = Parser.parseTrainingLog(this.archiveMd);
            this.logData = [...currentLog, ...archiveLog]; 
            
            this.setupEventListeners();
            window.addEventListener('hashchange', () => this.handleHashChange());
            this.handleHashChange();
            this.fetchWeather().catch(err => console.warn("Weather error:", err));
            
        } catch (e) {
            console.error("Init Error:", e);
        }
    },

    setupEventListeners() {
        const bindNav = (id, view) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => this.navigate(view));
        };
        ['dashboard', 'trends', 'logbook', 'roadmap', 'resources'].forEach(v => bindNav(`nav-${v}`, v));

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
        const validViews = ['dashboard', 'trends', 'logbook', 'roadmap', 'resources'];
        const view = validViews.includes(hash) ? hash : 'dashboard';
        this.renderView(view);
    },

    navigate(view) {
        window.location.hash = view;
    },

    renderView(view) {
        const titles = { 
            dashboard: 'Daily Dashboard', 
            trends: 'Performance Trends', 
            logbook: 'Training Log', 
            roadmap: 'Training Roadmap', 
            resources: 'Tools & Resources'
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
                if (view === 'trends') {
                    content.innerHTML = renderTrends(this.logData);
                } 
                else if (view === 'logbook') {
                    content.innerHTML = renderLogbook(this.logData);
                    this.updateDurationAnalysis();
                } 
                else if (view === 'roadmap') {
                    content.innerHTML = renderRoadmap(this.planMd);
                }
                else if (view === 'resources') {
                    const result = renderResources(this.planMd, this.gearMd, this.currentTemp, this.hourlyWeather);
                    content.innerHTML = result.html;
                    this.gearData = result.gearData;
                    this.updateGearResult();
                }
                else {
                    // DASHBOARD GRID VIEW
                    const sectionTitle = "Weekly Schedule";
                    const mdContent = Parser.getSection(this.planMd, sectionTitle);
                    const gridHtml = this.renderScheduleGrid(mdContent);
                    content.innerHTML = this.getStatsBar() + gridHtml;
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
