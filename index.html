<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Athlete Dashboard</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚲</text></svg>">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-dark.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        :root {
            --bg-dark: #0f172a;
            --bg-card: rgba(30, 41, 59, 0.3);
            --border-slate: #1e293b;
            --text-main: #f8fafc;
            --text-dim: #94a3b8;
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-main);
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            overflow-x: hidden;
        }

        .nav-link.active {
            color: #3b82f6;
            background-color: #1e293b;
            border-right: 4px solid #3b82f6;
        }

        #sidebar { transition: transform 0.3s ease-in-out; z-index: 60; }
        .sidebar-open { transform: translateX(0); }
        .sidebar-closed { transform: translateX(-100%); }

        @media (min-width: 1024px) {
            #sidebar { transform: translateX(0); }
            .main-content { margin-left: 260px; }
        }

        .markdown-body {
            background-color: transparent !important;
            color: #cbd5e1 !important;
        }
        .markdown-body table {
            display: table !important;
            width: 100% !important; 
            border-collapse: separate !important;
            border-spacing: 0 !important;
            border: 1px solid #334155 !important; 
            border-radius: 8px !important; 
            overflow: hidden !important;
            margin-bottom: 2rem !important;
        }
        .markdown-body table th { 
            background-color: #1e293b !important; 
            color: #3b82f6 !important; 
            padding: 12px !important; 
            text-align: left !important;
            text-transform: uppercase !important;
            font-size: 0.75rem !important;
            letter-spacing: 0.05em !important;
        }
        .markdown-body table td {
            padding: 12px !important;
            border-top: 1px solid #334155 !important;
        }
        .markdown-body table tr { background-color: var(--bg-dark) !important; }

        .gauge-wrapper { width: 100%; max-width: 400px; margin: 0 auto 1rem; text-align: center; }
        .gauge-needle { transition: transform 2s cubic-bezier(0.17, 0.67, 0.38, 1); transform-origin: 150px 150px; }

        #zone-grid { display: grid; grid-template-columns: 1fr; gap: 2rem; }
        @media (min-width: 768px) { #zone-grid { grid-template-columns: 1fr 1fr; } }
        
        .zone-card { background-color: var(--bg-card); border: 1px solid var(--border-slate); border-radius: 12px; padding: 1.5rem; }
        .zone-card-title {
            font-size: 1.1rem; font-weight: 800; color: var(--text-main);
            margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-slate);
            padding-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .zone-row {
            margin-bottom: 0.75rem; padding: 1rem; background: var(--bg-dark); border-radius: 8px;
            display: flex; justify-content: space-between; align-items: center; border-left: 6px solid #64748b;
        }
        .z-1 { border-left-color: #94a3b8; }
        .z-2 { border-left-color: #22c55e; }
        .z-3 { border-left-color: #eab308; }
        .z-4 { border-left-color: #f97316; }
        .z-5 { border-left-color: #ef4444; }

        .gear-select {
            background-color: #1e293b;
            color: #f8fafc;
            border: 1px solid #334155;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 0.5rem center;
            background-size: 1rem;
            width: 100%;
        }

        .gear-row-container { display: flex; flex-direction: column; gap: 1rem; }
        @media (min-width: 1024px) { .gear-row-container { flex-direction: row; align-items: stretch; } }
        
        .activity-header {
            min-width: 140px; display: flex; align-items: center; gap: 0.75rem;
            padding: 1rem; background: rgba(30, 41, 59, 0.4); border-radius: 0.5rem; border: 1px solid #1e293b;
        }

        .gear-bubbles-row { display: grid; grid-template-columns: 1fr; gap: 0.75rem; flex: 1; }
        @media (min-width: 640px) { .gear-bubbles-row { grid-template-columns: repeat(3, 1fr); } }

        .gear-bubble {
            background: rgba(15, 23, 42, 0.6); border: 1px solid #1e293b; padding: 1rem;
            border-radius: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; height: 100%;
        }

        /* KPI Styles */
        .kpi-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
        @media (min-width: 768px) { .kpi-grid { grid-template-columns: 1fr 1fr; } }
        
        .kpi-card { background: rgba(30, 41, 59, 0.4); border: 1px solid #1e293b; border-radius: 12px; padding: 1.5rem; }
        .kpi-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
        .kpi-title { font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
        
        .progress-container { margin-bottom: 1.25rem; }
        .progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.5rem; }
        .progress-bar-bg { width: 100%; height: 8px; background: #0f172a; border-radius: 4px; overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 4px; transition: width 1s ease-out; }
        
        /* Hourly Scroll */
        .hourly-scroll {
            display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem;
            scrollbar-width: thin; scrollbar-color: #334155 transparent;
        }
        .hourly-scroll::-webkit-scrollbar { height: 6px; }
        .hourly-scroll::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 3px; }
        .hourly-item {
            min-width: 70px; display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
            padding: 0.75rem; background: #0f172a; border-radius: 0.5rem; border: 1px solid #1e293b;
        }
    </style>
</head>
<body class="min-h-screen">

    <div id="sidebar-overlay" onclick="App.toggleSidebar()" class="fixed inset-0 bg-black/50 hidden z-50"></div>

    <aside id="sidebar" class="fixed top-0 left-0 h-full w-[260px] bg-slate-900 border-r border-slate-800 sidebar-closed lg:sidebar-open flex flex-col">
        <div class="p-6 border-b border-slate-800 flex justify-between items-center">
            <span class="font-bold tracking-widest text-slate-400 text-xs uppercase">Navigation</span>
            <button onclick="App.toggleSidebar()" class="lg:hidden text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
        
        <nav class="flex-1 py-4">
            <button onclick="App.navigate('schedule')" id="nav-schedule" class="nav-link w-full text-left px-6 py-4 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Weekly Schedule
            </button>
            
            <button onclick="App.navigate('gear')" id="nav-gear" class="nav-link w-full text-left px-6 py-4 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                Gear Choice
            </button>

            <button onclick="App.navigate('zones')" id="nav-zones" class="nav-link w-full text-left px-6 py-4 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
                Zones
            </button>

            <button onclick="App.navigate('phases')" id="nav-phases" class="nav-link w-full text-left px-6 py-4 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Phases
            </button>

            <button onclick="App.navigate('history')" id="nav-history" class="nav-link w-full text-left px-6 py-4 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Training History
            </button>

            <button onclick="App.navigate('full')" id="nav-full" class="nav-link w-full text-left px-6 py-4 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Full Plan
            </button>

            <button onclick="App.navigate('kpi')" id="nav-kpi" class="nav-link w-full text-left px-6 py-4 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                KPIs
            </button>
        </nav>
    </aside>

    <header class="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 h-16 lg:h-20 flex items-center justify-between px-4 lg:px-8 lg:ml-[260px]">
        <div class="flex items-center">
            <button onclick="App.toggleSidebar()" class="lg:hidden p-2 text-slate-400 hover:text-white focus:outline-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div class="ml-2 lg:ml-0">
                <h1 class="text-lg lg:text-xl font-bold text-white tracking-tight" id="header-title-dynamic">Weekly Schedule</h1>
                <p class="hidden lg:block text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Athlete Performance Suite</p>
            </div>
        </div>

        <div class="flex items-center gap-4">
            <div id="weather-widget" class="flex items-center gap-3">
                <div class="text-right block"> <p id="weather-location" class="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1 hidden sm:block">Local Weather</p> <p id="weather-info" class="text-xs font-semibold text-slate-300 leading-none">Fetching...</p>
                </div>
                <div id="weather-icon-top" class="text-xl lg:text-2xl filter drop-shadow-sm">☁️</div>
            </div>
        </div>
    </header>

    <div class="main-content">
        <main class="max-w-5xl mx-auto px-4 py-8 lg:py-12 pb-20">
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

            <div id="loader" class="flex flex-col items-center py-20 hidden">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
            </div>

            <div id="content" class="markdown-body opacity-0 transition-opacity duration-500"></div>
        </main>
    </div>

    <script>
        const CONFIG = {
            PLAN_FILE: "endurance_plan.md",
            GEAR_FILE: "Gear.md",
            WKG_SCALE: { min: 1.0, max: 6.0 },
            CATEGORIES: [
                { threshold: 5.05, label: "Exceptional", color: "#a855f7" },
                { threshold: 3.93, label: "Very Good",   color: "#3b82f6" },
                { threshold: 2.79, label: "Good",        color: "#22c55e" },
                { threshold: 2.23, label: "Fair",        color: "#f97316" },
                { threshold: 0.00, label: "Untrained",   color: "#ef4444" }
            ],
            WEATHER_MAP: {
                0: ["Clear", "☀️"], 1: ["Partly Cloudy", "🌤️"], 2: ["Partly Cloudy", "🌤️"], 3: ["Cloudy", "☁️"],
                45: ["Foggy", "🌫️"], 48: ["Foggy", "🌫️"], 51: ["Drizzle", "🌦️"], 61: ["Rain", "🌧️"], 63: ["Rain", "🌧️"],
                71: ["Snow", "❄️"], 95: ["Storm", "⛈️"]
            }
        };

        const Parser = {
            getSection(md, title) {
                if (!md) return "";
                const lines = md.split('\n');
                let capturing = false, section = [];
                for (let line of lines) {
                    const trimmed = line.trim();
                    const isHeader = trimmed.startsWith('#');
                    if (isHeader) {
                        if (trimmed.toLowerCase().includes(title.toLowerCase())) {
                            capturing = true;
                            continue;
                        }
                        if (capturing && !trimmed.startsWith('###')) {
                            break;
                        }
                    }
                    if (capturing) section.push(line);
                }
                return section.join('\n').trim();
            },

            getBiometrics(md) {
                const profileSection = this.getSection(md, "Profile") || this.getSection(md, "Biometrics");
                const ftp = profileSection.match(/Cycling FTP[^0-9]*(\d{1,3})/i);
                const weight = profileSection.match(/Weight[^0-9]*(\d{1,3})/i);
                return {
                    watts: ftp ? parseInt(ftp[1]) : 0,
                    weight: weight ? parseInt(weight[1]) : 0
                };
            },

            // --- UPDATED PARSER LOGIC FOR KPIS ---
            parseTrainingLog(md) {
                // Find the section that contains the log
                let section = this.getSection(md, "Appendix C: Training History Log");
                if (!section) section = this.getSection(md, "Training History");
                if (!section) return [];

                const lines = section.split('\n');
                let dayIdx = -1, planIdx = -1, statusIdx = -1;
                let data = [];

                // 1. Find Header Row and Indices
                for (let line of lines) {
                    if (line.includes('|')) {
                        const lowLine = line.toLowerCase();
                        if (lowLine.includes('day') || lowLine.includes('date')) {
                            const headers = line.split('|').map(h => h.trim().toLowerCase());
                            
                            headers.forEach((h, index) => {
                                if (h.includes('day') || h.includes('date')) dayIdx = index;
                                if (h.includes('planned') || h.includes('workout')) planIdx = index;
                                if (h.includes('status')) statusIdx = index;
                            });
                            
                            if (dayIdx !== -1 && planIdx !== -1 && statusIdx !== -1) {
                                break; 
                            }
                        }
                    }
                }

                if (dayIdx === -1) return [];

                // 2. Parse Rows
                const now = new Date();
                // Set hours to 0 to be strict about "future" (if a workout is later today, we count it as current/past for simplicity, or we can use strict current time)
                // User said "not include any future days".
                now.setHours(23, 59, 59, 999); 

                for (let line of lines) {
                    if (!line.includes('|') || line.includes('---')) continue; // Skip non-table lines
                    
                    const cols = line.split('|');
                    if (cols.length <= Math.max(dayIdx, planIdx, statusIdx)) continue; // Malformed row

                    const dateStr = cols[dayIdx].trim();
                    const planStr = cols[planIdx].trim().toLowerCase();
                    const statusStr = cols[statusIdx].trim().toLowerCase();

                    // Parse Date (Assume YYYY-MM-DD)
                    const dateMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
                    if (!dateMatch) continue;
                    
                    const date = new Date(dateMatch[0]);
                    date.setHours(12, 0, 0, 0); // Avoid timezone shifts

                    // Ensure date is valid and in the past/today
                    if (date <= now) {
                        data.push({
                            date: date,
                            type: planStr.includes('bike') ? 'Bike' : 
                                  planStr.includes('run') ? 'Run' : 
                                  planStr.includes('swim') ? 'Swim' : 'Other',
                            completed: statusStr.includes('completed')
                        });
                    }
                }
                
                return data;
            },

            parseGearMatrix(md) {
                const results = { bike: [], run: [] };
                const lines = md.split('\n');
                let currentType = null;
                let inTable = false;

                for (let line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('#')) {
                        const low = trimmed.toLowerCase();
                        if (low.includes('cycling') || low.includes('bike')) currentType = 'bike';
                        else if (low.includes('running') || low.includes('run')) currentType = 'run';
                        else currentType = null;
                        inTable = false;
                        continue;
                    }

                    if (currentType && trimmed.startsWith('|')) {
                        if (trimmed.includes('---') || trimmed.toLowerCase().includes('range') || trimmed.toLowerCase().includes('temp')) {
                            inTable = true;
                            continue;
                        }
                        if (inTable) {
                            const parts = trimmed.split('|').map(p => p.trim());
                            if (trimmed.startsWith('|')) parts.shift();
                            if (trimmed.endsWith('|')) parts.pop();

                            if (parts.length >= 2) {
                                const rangeStr = parts[0];
                                let min = -999, max = 999;
                                const numMatch = rangeStr.match(/\d+/g);
                                if (!numMatch) continue;
                                const lowRangeStr = rangeStr.toLowerCase();
                                
                                if (lowRangeStr.match(/below|under|<|less/)) {
                                    min = -999; max = parseInt(numMatch[0]);
                                } else if (lowRangeStr.match(/above|over|up|\+|more/)) {
                                    min = parseInt(numMatch[0]); max = 999;
                                } else if (numMatch.length >= 2) {
                                    min = parseInt(numMatch[0]); max = parseInt(numMatch[1]);
                                } else {
                                    min = parseInt(numMatch[0]); max = parseInt(numMatch[0]);
                                }
                                results[currentType].push({ min, max, upper: parts[1] || "—", lower: parts[2] || "—", extremities: parts[3] || "—" });
                            }
                        }
                    } else if (inTable && trimmed !== "") {
                        inTable = false;
                    }
                }
                return results;
            }
        };

        const App = {
            planMd: "",
            gearMd: "",
            gearData: null,
            currentTemp: null,
            hourlyWeather: null,
            
            async init() {
                try {
                    const [planRes, gearRes] = await Promise.all([
                        fetch(`./${CONFIG.PLAN_FILE}?t=${Date.now()}`),
                        fetch(`./${CONFIG.GEAR_FILE}?t=${Date.now()}`)
                    ]);
                    
                    this.planMd = planRes.ok ? await planRes.text() : "";
                    this.gearMd = gearRes.ok ? await gearRes.text() : "";
                    this.gearData = Parser.parseGearMatrix(this.gearMd);

                    this.updateStats();
                    
                    // Fetch weather gracefully
                    this.fetchWeather().catch(err => console.warn("Weather fetch failed quietly:", err));
                    
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
                        
                        const temp = Math.round(weatherData.current_weather.temperature);
                        const code = weatherData.current_weather.weathercode;
                        
                        this.currentTemp = temp;
                        this.hourlyWeather = weatherData.hourly || null; 

                        const condition = CONFIG.WEATHER_MAP[code] || ["Cloudy", "☁️"];
                        document.getElementById('weather-info').innerText = `${temp}°F • ${condition[0]}`;
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
                if (dateRange) phaseEl.innerHTML = `${currentPhaseRaw}<span class="block text-xs text-slate-400 mt-1 font-normal">${dateRange}</span>`;
                else phaseEl.innerText = currentPhaseRaw;

                document.getElementById('stat-week').innerText = currentWeek;
                
                const eventSection = Parser.getSection(this.planMd, "Event Schedule");
                const eventLines = eventSection.split('\n').filter(l => l.includes('|') && !l.toLowerCase().includes('date') && !l.includes('---'));
                
                const nameEl = document.getElementById('stat-event-name');
                const countdownEl = document.getElementById('stat-event-countdown');

                if (eventLines.length > 0) {
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
                if (window.location.hash === '#' + view) { this.renderView(view); } 
                else { window.location.hash = view; }
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
                        if (view === 'gear') this.renderGear();
                        else if (view === 'zones') this.renderZones();
                        else if (view === 'kpi') this.renderKPI();
                        else this.renderMarkdown(view);
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

            renderMarkdown(view) {
                const mdMap = {
                    schedule: Parser.getSection(this.planMd, "Weekly Schedule"),
                    phases: Parser.getSection(this.planMd, "Periodization"),
                    full: this.planMd,
                    history: Parser.getSection(this.planMd, "Appendix C: Training History Log") || Parser.getSection(this.planMd, "Training History")
                };
                document.getElementById('content').innerHTML = marked.parse(mdMap[view] || "*Content not found.*");
            },

            getIconForType(type) {
                if (type === 'Bike') return '<i class="fa-solid fa-bicycle text-blue-500 text-xl"></i>';
                if (type === 'Run') return '<i class="fa-solid fa-person-running text-emerald-500 text-xl"></i>';
                if (type === 'Swim') return '<i class="fa-solid fa-person-swimming text-cyan-500 text-xl"></i>';
                return '<i class="fa-solid fa-chart-line text-purple-500 text-xl"></i>';
            },

            // --- UPDATED RENDER KPI ---
            renderKPI() {
                // Parse the log using the new Parser method
                const logData = Parser.parseTrainingLog(this.planMd);

                const calculateStats = (targetType, days) => {
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - days);
                    const now = new Date();
                    now.setHours(23, 59, 59, 999);

                    // Filter based on Date Range and Type
                    const subset = logData.filter(item => {
                        const dateOk = item.date >= cutoff && item.date <= now;
                        const typeOk = targetType === 'All' || item.type === targetType;
                        return dateOk && typeOk;
                    });

                    // Denominator: Total planned workouts (that exist in the log for these dates)
                    const planned = subset.length; 
                    
                    // Numerator: Completed only
                    const completed = subset.filter(item => item.completed).length; 
                    
                    const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;
                    
                    return { planned, completed, pct };
                };

                const buildMetric = (title, type) => {
                    const stats30 = calculateStats(type, 30);
                    const stats60 = calculateStats(type, 60);

                    const color30 = stats30.pct >= 80 ? '#22c55e' : (stats30.pct >= 50 ? '#f59e0b' : '#ef4444');
                    const color60 = stats60.pct >= 80 ? '#22c55e' : (stats60.pct >= 50 ? '#f59e0b' : '#ef4444');

                    return `
                        <div class="kpi-card">
                            <div class="kpi-header">
                                ${this.getIconForType(type)}
                                <span class="kpi-title">${title}</span>
                            </div>
                            
                            <div class="progress-container">
                                <div class="progress-label"><span>Last 30 Days</span> <span>${stats30.pct}% (${stats30.completed}/${stats30.planned})</span></div>
                                <div class="progress-bar-bg">
                                    <div class="progress-bar-fill" style="width: ${stats30.pct}%; background-color: ${color30}"></div>
                                </div>
                            </div>
                            
                            <div class="progress-container">
                                <div class="progress-label"><span>Last 60 Days</span> <span>${stats60.pct}% (${stats60.completed}/${stats60.planned})</span></div>
                                <div class="progress-bar-bg">
                                    <div class="progress-bar-fill" style="width: ${stats60.pct}%; background-color: ${color60}"></div>
                                </div>
                            </div>
                        </div>
                    `;
                };

                const html = `
                    <div class="kpi-grid">
                        ${buildMetric("All Workouts", "All")}
                        ${buildMetric("Cycling", "Bike")}
                        ${buildMetric("Running", "Run")}
                        ${buildMetric("Swimming", "Swim")}
                    </div>
                    <div class="mt-8 text-center text-xs text-slate-500 italic">
                        * Calculations based on the "Training History Log" table in the markdown file.
                    </div>
                `;
                document.getElementById('content').innerHTML = html;
            },

            renderGear() {
                let defaultVal = 50;
                if (this.currentTemp !== null) {
                    if (this.currentTemp < 30) defaultVal = 25;
                    else if (this.currentTemp > 70) defaultVal = 75;
                    else defaultVal = this.currentTemp;
                }

                let tempOptions = `<option value="25" ${defaultVal === 25 ? 'selected' : ''}>&lt;30°F</option>`;
                for(let i=30; i<=70; i++) {
                    tempOptions += `<option value="${i}" ${i === defaultVal ? 'selected' : ''}>${i}°F</option>`;
                }
                tempOptions += `<option value="75" ${defaultVal === 75 ? 'selected' : ''}>70°F+</option>`;

                // Hourly Forecast Logic
                let hourlyHtml = '';
                if (this.hourlyWeather && this.hourlyWeather.time && Array.isArray(this.hourlyWeather.time)) {
                    const times = this.hourlyWeather.time.slice(0, 24); 
                    const temps = this.hourlyWeather.temperature_2m;
                    const codes = this.hourlyWeather.weathercode;
                    
                    hourlyHtml = `<div class="mb-6">
                        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Hourly Forecast</p>
                        <div class="hourly-scroll">`;
                    
                    times.forEach((t, index) => {
                        const date = new Date(t);
                        if (index < 24 && temps[index] !== undefined) { 
                            const h = date.getHours();
                            const ampm = h >= 12 ? 'PM' : 'AM';
                            const hourLabel = h % 12 === 0 ? 12 : h % 12;
                            const icon = (CONFIG.WEATHER_MAP[codes[index]] || ["", "☁️"])[1];
                            hourlyHtml += `
                                <div class="hourly-item">
                                    <span class="text-[10px] text-slate-400 font-bold">${hourLabel} ${ampm}</span>
                                    <span class="text-lg">${icon}</span>
                                    <span class="text-xs font-bold text-slate-200">${Math.round(temps[index])}°</span>
                                </div>
                            `;
                        }
                    });
                    hourlyHtml += `</div></div>`;
                }

                const generateRow = (idPrefix, iconClass, label) => `
                    <div class="gear-row-container">
                        <div class="activity-header">
                            <i class="${iconClass} text-slate-400 text-lg"></i>
                            <span class="text-xs font-bold text-slate-200 uppercase tracking-widest">${label}</span>
                        </div>
                        <div class="gear-bubbles-row">
                            <div class="gear-bubble">
                                <span class="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1">Upper Body</span>
                                <p id="${idPrefix}-upper" class="text-sm text-slate-100 font-medium leading-relaxed">--</p>
                            </div>
                            <div class="gear-bubble">
                                <span class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Lower Body</span>
                                <p id="${idPrefix}-lower" class="text-sm text-slate-100 font-medium leading-relaxed">--</p>
                            </div>
                            <div class="gear-bubble">
                                <span class="text-[9px] font-bold text-purple-500 uppercase tracking-widest mb-1">Extremities</span>
                                <p id="${idPrefix}-extremities" class="text-sm text-slate-100 font-medium leading-relaxed">--</p>
                            </div>
                        </div>
                    </div>
                `;

                const html = `
                    <div class="bg-slate-800/30 border border-slate-800 rounded-xl p-6 mb-8">
                        ${hourlyHtml}
                        
                        <div class="flex flex-col gap-2 mb-8 max-w-md mx-auto">
                            <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Select Temperature</label>
                            <select id="gear-temp" onchange="App.updateGearResult()" class="gear-select text-center text-lg py-3">
                                ${tempOptions}
                            </select>
                        </div>

                        <div class="mb-10">
                            <h3 class="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Standard Conditions
                            </h3>
                            <div class="flex flex-col gap-4">
                                ${generateRow('bike-standard', 'fa-solid fa-bicycle', 'Cycling')}
                                ${generateRow('run-standard', 'fa-solid fa-person-running', 'Running')}
                            </div>
                        </div>

                        <div>
                            <h3 class="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Windy & Rainy (-10°F)
                            </h3>
                            <div class="flex flex-col gap-4">
                                ${generateRow('bike-weather', 'fa-solid fa-bicycle', 'Cycling')}
                                ${generateRow('run-weather', 'fa-solid fa-person-running', 'Running')}
                            </div>
                        </div>
                    </div>

                    <div class="mt-8 border-t border-slate-800 pt-8">
                        <div class="flex items-center gap-2 mb-6">
                            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest">Full Documentation</h3>
                        </div>
                        <div class="markdown-body">
                            ${marked.parse(this.gearMd || "*No gear data found in Gear.md.*")}
                        </div>
                    </div>
                `;
                document.getElementById('content').innerHTML = html;
                this.updateGearResult();
            },

            updateGearResult() {
                if (!this.gearData) return;
                
                const tempSelect = document.getElementById('gear-temp');
                if (!tempSelect) return;
                const temp = parseInt(tempSelect.value);
                
                const processActivity = (activity, prefixBase) => {
                    const list = this.gearData[activity] || [];
                    const findMatch = (t) => {
                        const match = list.find(r => {
                            if (r.min === -999) return t < r.max;
                            if (r.max === 999) return t >= r.min;
                            return t >= r.min && t <= r.max;
                        });
                        return match || { upper: "—", lower: "—", extremities: "—" };
                    };

                    const standard = findMatch(temp);
                    const weather = findMatch(temp - 10);

                    const updateUI = (prefix, data) => {
                        const u = document.getElementById(`${prefix}-upper`);
                        const l = document.getElementById(`${prefix}-lower`);
                        const e = document.getElementById(`${prefix}-extremities`);
                        if (u) u.innerHTML = data.upper;
                        if (l) l.innerHTML = data.lower;
                        if (e) e.innerHTML = data.extremities;
                    };

                    updateUI(`${prefixBase}-standard`, standard);
                    updateUI(`${prefixBase}-weather`, weather);
                };

                processActivity('bike', 'bike');
                processActivity('run', 'run');
            },

            renderZones() {
                const { watts, weight } = Parser.getBiometrics(this.planMd);
                const weightKg = weight * 0.453592;
                const wkgNum = weightKg > 0 ? (watts / weightKg) : 0;
                const cat = CONFIG.CATEGORIES.find(c => wkgNum >= c.threshold) || CONFIG.CATEGORIES[CONFIG.CATEGORIES.length - 1];
                const percent = Math.min(Math.max((wkgNum - CONFIG.WKG_SCALE.min) / (CONFIG.WKG_SCALE.max - CONFIG.WKG_SCALE.min), 0), 1);

                const html = `
                    <div class="gauge-wrapper">
                        <svg viewBox="0 0 300 185" class="gauge-svg">
                            <path d="M 30 150 A 120 120 0 0 1 64.1 66.2" fill="none" stroke="#ef4444" stroke-width="24" />
                            <path d="M 64.1 66.2 A 120 120 0 0 1 98.3 41.8" fill="none" stroke="#f97316" stroke-width="24" />
                            <path d="M 98.3 41.8 A 120 120 0 0 1 182.0 34.4" fill="none" stroke="#22c55e" stroke-width="24" />
                            <path d="M 182.0 34.4 A 120 120 0 0 1 249.2 82.6" fill="none" stroke="#3b82f6" stroke-width="24" />
                            <path d="M 249.2 82.6 A 120 120 0 0 1 270 150" fill="none" stroke="#a855f7" stroke-width="24" />
                            <text x="150" y="135" text-anchor="middle" class="text-4xl font-black fill-white">${wkgNum.toFixed(2)}</text>
                            <text x="150" y="160" text-anchor="middle" font-weight="800" fill="${cat.color}">${cat.label.toUpperCase()}</text>
                            <g class="gauge-needle" style="transform: rotate(${-90 + (percent * 180)}deg)">
                                <path d="M 147 150 L 150 45 L 153 150 Z" fill="white" />
                                <circle cx="150" cy="150" r="6" fill="white" />
                            </g>
                        </svg>
                    </div>
                    <div class="text-center mb-8">
                        <span class="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Cycling FTP</span>
                        <span class="text-2xl font-bold text-white">${watts > 0 ? watts + ' W' : '--'}</span>
                    </div>
                    <div id="zone-grid">${this.parseZoneTables()}</div>
                `;
                document.getElementById('content').innerHTML = html;
            },

            parseZoneTables() {
                const section = Parser.getSection(this.planMd, "Training Parameters") || Parser.getSection(this.planMd, "Zones");
                let current = '', html = '', categories = {};
                if (!section) return `<p class="text-slate-500 text-center col-span-2">No zone data found.</p>`;
                
                section.split('\n').forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('###')) {
                        current = trimmed.replace(/###/g, '').split('(')[0].trim();
                        categories[current] = [];
                    } else if (current && trimmed.includes(':')) {
                        const [label, range] = trimmed.replace(/[\*\-\+]/g, '').split(':');
                        const zMatch = label.toLowerCase().match(/zone (\d)/);
                        const zNum = zMatch ? zMatch[1] : '1';
                        categories[current].push(`<div class="zone-row z-${zNum}"><span class="font-bold">${label.trim()}</span><span class="font-mono text-slate-400">${range ? range.trim() : '--'}</span></div>`);
                    }
                });
                
                const keys = Object.keys(categories);
                keys.forEach(k => html += `<div class="zone-card"><div class="zone-card-title">${k}</div>${categories[k].join('')}</div>`);
                return html;
            },

            toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebar-overlay');
                sidebar.classList.toggle('sidebar-closed');
                sidebar.classList.toggle('sidebar-open');
                overlay.classList.toggle('hidden');
            }
        };

        window.onload = () => App.init();
    </script>
</body>
</html>
