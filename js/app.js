// js/app.js

(async function initApp() {
    console.log("🚀 Booting App (Adapter Mode: Active)...");

    const cacheBuster = Date.now();
    
    // --- 1. NAVIGATION SETUP (Priority 1) ---
    // Ensures tabs are clickable immediately, even if data loads slowly.
    function setupEventListeners() {
        const navMap = {
            'nav-dashboard': 'dashboard', 'nav-trends': 'trends', 'nav-logbook': 'logbook',
            'nav-roadmap': 'roadmap', 'nav-gear': 'gear', 'nav-zones': 'zones', 
            'nav-ftp': 'ftp', 'nav-readiness': 'readiness', 'nav-metrics': 'metrics'
        };
        Object.keys(navMap).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onclick = (e) => { e.preventDefault(); App.navigate(navMap[id]); };
        });
        const btnOpen = document.getElementById('btn-sidebar-open');
        const overlay = document.getElementById('sidebar-overlay');
        if (btnOpen) btnOpen.onclick = () => App.toggleSidebar();
        if (overlay) overlay.onclick = () => App.toggleSidebar();
    }

    const safeImport = async (path) => {
        try { return await import(`${path}?t=${cacheBuster}`); } catch (e) { return null; }
    };

    // --- 2. LOAD MODULES ---
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
        planMd: "", gearMd: "", allData: [], 

        // --- 3. THE ADAPTER (HYDRATION) ---
        // This function translates "New Database Format" -> "Legacy Chart Format"
        hydrateData(jsonArray) {
            if (!Array.isArray(jsonArray)) return [];
            
            return jsonArray.map(item => {
                const dateObj = new Date(`${item.date}T12:00:00`); 
                const getNum = (v) => (v !== null && v !== undefined && !isNaN(v)) ? Number(v) : 0;
                
                // Consolidate Cadence fields into one
                const cad = getNum(item.averageBikingCadenceInRevPerMinute) || getNum(item.averageRunningCadenceInStepsPerMinute);

                // --- FIX A: FLATTEN ACTIVITY TYPE ---
                // Prevents "d.activityType.includes is not a function" crash.
                // We extract the string "cycling" from the object, or default to empty string.
                let flatActivityType = "";
                if (item.activityType) {
                    if (typeof item.activityType === 'string') {
                        flatActivityType = item.activityType;
                    } else if (item.activityType.typeKey) {
                        flatActivityType = item.activityType.typeKey; 
                    }
                }

                // --- FIX B: INJECT LEGACY SPORT IDs ---
                // definitions.js filters data by these exact IDs:
                // Run=1, Bike=2, Swim=5. We force them here based on the name.
                let safeActualSport = item.actualSport || "Other";
                let safeSportId = item.sportTypeId; 

                if (safeActualSport.includes('Bike') || safeActualSport.includes('Cycl')) {
                    safeActualSport = 'Bike';
                    safeSportId = 2; // Force ID 2
                } else if (safeActualSport.includes('Run')) {
                    safeActualSport = 'Run';
                    safeSportId = 1; // Force ID 1
                } else if (safeActualSport.includes('Swim')) {
                    safeActualSport = 'Swim';
                    safeSportId = 5; // Force ID 5
                }

                return {
                    ...item, 
                    
                    // Core Identity
                    date: dateObj,
                    id: item.id,
                    dayName: item.Day || item.day || "Unknown",
                    type: safeActualSport, 
                    
                    // --- MAPPED FIELDS FOR LEGACY CHARTS ---
                    actualType: safeActualSport,     // Used by utils.js fallback
                    activityType: flatActivityType,  // Used by charts.js (now a String)
                    sportTypeId: safeSportId,        // Used by definitions.js (Correct ID)
                    
                    // Strings for Heatmap
                    plannedWorkout: item.plannedWorkout || "",
                    actualWorkout: item.actualWorkout || "",
                    
                    // Metric Mapping (New JSON Name -> Old App Name)
                    plannedDuration: getNum(item.plannedDuration),
                    actualDuration: getNum(item.actualDuration),
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
                    trainingEffectLabel: item.trainingEffectLabel,
                    
                    trainingStressScore: getNum(item.trainingStressScore),
                    intensityFactor: getNum(item.intensityFactor),
                    elevationGain: getNum(item.elevationGain),
                    calories: getNum(item.calories),
                    RPE: getNum(item.RPE),
                    Feeling: getNum(item.Feeling),
                    
                    completed: item.status === 'COMPLETED'
                };
            });
        },

        async init() {
            await this.checkSecurity();
            setupEventListeners(); 

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
                document.getElementById('content').innerHTML = `<div class="p-8 text-center text-red-500">System Error: ${e.message}</div>`;
            }
        },

        navigate(view) { window.location.hash = view; },

        renderView(view) {
            const content = document.getElementById('content');
            if(!content) return;
            
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            const navBtn = document.getElementById(`nav-${view}`);
            if(navBtn) navBtn.classList.add('active');
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
                                 <td class="p-2 border-b border-slate-700 text-xs">${d.actualWorkout || d.plannedWorkout}</td>
                                 <td class="p-2 border-b border-slate-700 text-xs text-right">${Math.round(d.actualDuration||d.plannedDuration)}m</td></tr>`).join('');
                        content.innerHTML = `<div class="bg-slate-800 p-4 rounded-xl overflow-x-auto"><table class="w-full text-left text-slate-300"><thead><tr><th>Date</th><th>Type</th><th>Activity</th><th class="text-right">Dur</th></tr></thead><tbody>${rows}</tbody></table></div>`;
                    }
                } catch (e) {
                    console.error("Render Error:", e);
                    content.innerHTML = `<p class="text-red-400">Error: ${e.message}</p>`;
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
