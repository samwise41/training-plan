// js/app.js

(async function initApp() {
    console.log("🚀 Booting App (Fixed Navigation Priority)...");

    const cacheBuster = Date.now();
    
    // --- 1. SETUP NAVIGATION IMMEDIATELY ---
    // We do this first so tabs work even if data fails later
    function setupEventListeners() {
        const navMap = {
            'nav-dashboard': 'dashboard', 
            'nav-trends': 'trends', 
            'nav-logbook': 'logbook',
            'nav-roadmap': 'roadmap', 
            'nav-gear': 'gear', 
            'nav-zones': 'zones', 
            'nav-ftp': 'ftp', 
            'nav-readiness': 'readiness', 
            'nav-metrics': 'metrics'
        };
        
        Object.keys(navMap).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = (e) => {
                    e.preventDefault();
                    App.navigate(navMap[id]);
                };
            }
        });

        // Mobile Sidebar
        const btnOpen = document.getElementById('btn-sidebar-open');
        const btnClose = document.getElementById('btn-sidebar-close');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (btnOpen) btnOpen.onclick = () => App.toggleSidebar();
        if (btnClose) btnClose.onclick = () => App.toggleSidebar();
        if (overlay) overlay.onclick = () => App.toggleSidebar();
    }

    // --- 2. SAFE IMPORT HELPER ---
    const safeImport = async (path) => {
        try { return await import(`${path}?t=${cacheBuster}`); } 
        catch (e) { console.error(`⚠️ Failed to load ${path}`, e); return null; }
    };

    // --- 3. LOAD MODULES ---
    const trendsMod = await safeImport('./views/trends/index.js');
    const gearMod = await safeImport('./views/gear/index.js');
    const zonesMod = await safeImport('./views/zones/index.js');
    const ftpMod = await safeImport('./views/ftp/index.js'); 
    const roadmapMod = await safeImport('./views/roadmap/index.js');
    const dashMod = await safeImport('./views/dashboard/index.js');
    const readinessMod = await safeImport('./views/readiness/index.js');
    const metricsMod = await safeImport('./views/metrics/index.js');
    const parserMod = await safeImport('./parser.js');

    const { renderTrends, updateDurationAnalysis } = trendsMod || {};
    const { renderGear, updateGearResult } = gearMod || {};
    const { renderZones } = zonesMod || {};
    const { renderFTP } = ftpMod || {}; 
    const { renderRoadmap } = roadmapMod || {};
    const { renderDashboard } = dashMod || {};
    const { renderReadiness, renderReadinessChart } = readinessMod || {};
    const { renderMetrics } = metricsMod || {};
    const Parser = parserMod?.Parser;

    const CONFIG = {
        PLAN_FILE: "endurance_plan.md",
        GEAR_FILE: "js/views/gear/Gear.md",
        DATA_FILE: "data/training_log.json", 
        AUTH_FILE: "auth_config.json"
    };

    const App = {
        planMd: "",
        gearMd: "",
        allData: [], 

        // --- 4. HYDRATION (Safe & Strict) ---
        hydrateData(jsonArray) {
            if (!Array.isArray(jsonArray)) return [];
            
            return jsonArray.map(item => {
                const dateObj = new Date(`${item.date}T12:00:00`); 
                const getNum = (v) => (v !== null && v !== undefined && !isNaN(v)) ? Number(v) : 0;
                
                // Consolidate Cadence
                const cad = getNum(item.averageBikingCadenceInRevPerMinute) || getNum(item.averageRunningCadenceInStepsPerMinute);

                return {
                    ...item, // PRESERVE ALL ORIGINAL KEYS (plannedWorkout, actualWorkout, etc.)
                    
                    // Core
                    date: dateObj,
                    id: item.id,
                    dayName: item.Day || item.day || "Unknown",
                    type: item.actualSport || item.plannedSport || 'Other',
                    
                    // Chart Metrics (Mapped Safely)
                    avgHR: getNum(item.averageHR),
                    maxHR: getNum(item.maxHR),
                    avgPower: getNum(item.avgPower),
                    normPower: getNum(item.normPower),
                    avgSpeed: getNum(item.averageSpeed),
                    avgCadence: cad,
                    
                    avgGroundContactTime: getNum(item.avgGroundContactTime),
                    avgVerticalOscillation: getNum(item.avgVerticalOscillation),
                    vO2MaxValue: getNum(item.vO2MaxValue),
                    anaerobicTrainingEffect: getNum(item.anaerobicTrainingEffect),
                    
                    trainingStressScore: getNum(item.trainingStressScore),
                    intensityFactor: getNum(item.intensityFactor),
                    elevationGain: getNum(item.elevationGain),
                    calories: getNum(item.calories),
                    
                    RPE: getNum(item.RPE),
                    Feeling: getNum(item.Feeling),
                    
                    plannedDuration: getNum(item.plannedDuration),
                    actualDuration: getNum(item.actualDuration),
                    
                    completed: item.status === 'COMPLETED'
                };
            });
        },

        async init() {
            await this.checkSecurity();
            setupEventListeners(); // <-- Tabs enabled immediately

            const startView = window.location.hash.substring(1) || 'dashboard';
            
            try {
                const [planRes, gearRes, historyRes] = await Promise.all([
                    fetch(`./${CONFIG.PLAN_FILE}?t=${cacheBuster}`),
                    fetch(`./${CONFIG.GEAR_FILE}?t=${cacheBuster}`),
                    fetch(`./${CONFIG.DATA_FILE}?t=${cacheBuster}`) 
                ]);
                
                if (planRes.ok) this.planMd = await planRes.text();
                if (gearRes.ok) this.gearMd = await gearRes.text();
                
                if (historyRes.ok) {
                    const rawJson = await historyRes.json();
                    this.allData = this.hydrateData(rawJson).sort((a,b) => b.date - a.date);
                }
                
                this.renderView(startView);
                window.addEventListener('hashchange', () => this.renderView(window.location.hash.substring(1)));
                this.fetchWeather();

            } catch (e) {
                console.error("Init Error:", e);
                // Even if data fails, try to render the dashboard shell
                document.getElementById('content').innerHTML = `<div class="p-8 text-center text-red-500">Error loading data: ${e.message}</div>`;
            }
        },

        navigate(view) { 
            window.location.hash = view; 
        },

        renderView(view) {
            const content = document.getElementById('content');
            if(!content) return;
            
            // Highlight Tab
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            const navBtn = document.getElementById(`nav-${view}`);
            if(navBtn) navBtn.classList.add('active');

            // Header Title
            const titleEl = document.getElementById('header-title-dynamic');
            if(titleEl) titleEl.innerText = view.charAt(0).toUpperCase() + view.slice(1);

            content.classList.add('opacity-0');
            
            setTimeout(() => {
                try {
                    if (view === 'metrics' && renderMetrics) content.innerHTML = renderMetrics(this.allData);
                    else if (view === 'trends' && renderTrends) {
                        const res = renderTrends(this.allData);
                        content.innerHTML = res.html;
                        if(updateDurationAnalysis) updateDurationAnalysis(this.allData);
                    }
                    else if (view === 'dashboard' && renderDashboard) {
                        content.innerHTML = this.getStatsBar() + renderDashboard(this.planMd, this.allData);
                        this.updateStats();
                    }
                    else if (view === 'gear' && renderGear) {
                        const res = renderGear(this.gearMd, this.currentTemp, this.hourlyWeather);
                        content.innerHTML = res.html;
                        if(updateGearResult) updateGearResult(res.gearData);
                    }
                    else if (view === 'readiness' && renderReadiness) {
                        content.innerHTML = renderReadiness(this.allData, this.planMd);
                        if(renderReadinessChart) renderReadinessChart(this.allData);
                    }
                    else if (view === 'roadmap' && renderRoadmap) content.innerHTML = renderRoadmap(this.planMd);
                    else if (view === 'zones' && renderZones) content.innerHTML = renderZones(this.planMd);
                    else if (view === 'ftp' && renderFTP) content.innerHTML = renderFTP(this.planMd);
                    else if (view === 'logbook') {
                        let rows = this.allData.map(d => 
                            `<tr><td class="p-2 border-b border-slate-700 text-xs">${d.date.toLocaleDateString()}</td>
                                <td class="p-2 border-b border-slate-700 text-xs font-bold">${d.type}</td>
                                <td class="p-2 border-b border-slate-700 text-xs text-slate-300">${d.actualWorkout || d.plannedWorkout}</td>
                                <td class="p-2 border-b border-slate-700 text-xs text-right">${Math.round(d.actualDuration||d.plannedDuration)}m</td></tr>`).join('');
                        content.innerHTML = `<div class="bg-slate-800 p-4 rounded-xl overflow-x-auto"><table class="w-full text-left text-slate-300"><thead><tr><th>Date</th><th>Type</th><th>Activity</th><th class="text-right">Dur</th></tr></thead><tbody>${rows}</tbody></table></div>`;
                    }
                } catch (e) {
                    console.error("Render Error:", e);
                    content.innerHTML = `<p class="text-red-400">Error loading view: ${e.message}</p>`;
                }
                content.classList.remove('opacity-0');
                if (window.innerWidth < 1024) this.toggleSidebar(false);
            }, 150);
        },

        async checkSecurity() {
            if (document.cookie.includes('dashboard_access=true')) {
                const curtain = document.getElementById('security-curtain');
                if(curtain) curtain.classList.add('hidden');
            }
        },
        
        async fetchWeather() { /* ... */ },
        
        toggleSidebar(forceOpen) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (forceOpen === false) {
                sidebar.classList.remove('sidebar-open'); sidebar.classList.add('sidebar-closed');
                overlay.classList.add('hidden');
            } else {
                sidebar.classList.toggle('sidebar-closed'); sidebar.classList.toggle('sidebar-open');
                overlay.classList.toggle('hidden');
            }
        },
        
        getStatsBar() {
            return `<div id="stats-bar" class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div class="bg-slate-800 border border-slate-700 p-4 rounded-xl flex flex-col justify-center shadow-lg">
                    <p class="text-[10px] font-bold text-slate-500 uppercase">Phase</p>
                    <div class="flex flex-col"><span class="text-lg font-bold text-blue-500" id="stat-phase">--</span><span class="text-sm text-white" id="stat-week">--</span></div>
                </div>
                <div class="bg-slate-800 border border-slate-700 p-4 rounded-xl"><div id="stat-event"><p class="text-lg font-bold text-white" id="stat-event-name">--</p><span id="stat-event-date" class="text-slate-400 text-xs">--</span></div></div>
            </div>`;
        },
        
        updateStats() {
            if(!this.planMd) return;
            const statusMatch = this.planMd.match(/\*\*Status:\*\*\s*(.*?)\s+-\s+(.*)/i);
            if(statusMatch) {
                document.getElementById('stat-phase').innerText = statusMatch[1].trim();
                document.getElementById('stat-week').innerText = statusMatch[2].trim();
            }
        }
    };

    window.App = App;
    App.init();
})();
