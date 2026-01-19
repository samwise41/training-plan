// js/app.js

(async function initApp() {
    console.log("🚀 Booting App (Phase 1: Ingestor & Standard Schema)...");

    const cacheBuster = Date.now();

    // --- 1. SETUP NAVIGATION ---
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
        
        // Mobile Sidebar
        const toggle = () => {
            const sb = document.getElementById('sidebar');
            const ov = document.getElementById('sidebar-overlay');
            sb.classList.toggle('sidebar-closed'); sb.classList.toggle('sidebar-open');
            ov.classList.toggle('hidden');
        };
        const open = document.getElementById('btn-sidebar-open');
        if(open) open.onclick = toggle;
        const close = document.getElementById('btn-sidebar-close');
        if(close) close.onclick = toggle;
        const overlay = document.getElementById('sidebar-overlay');
        if(overlay) overlay.onclick = toggle;
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

        // --- 3. THE INGESTOR (Standard Schema Enforcer) ---
        processData(jsonArray) {
            if (!Array.isArray(jsonArray)) return [];
            console.log(`📥 Ingesting ${jsonArray.length} records...`);

            return jsonArray.map(item => {
                const num = (v) => (v !== null && v !== undefined && !isNaN(v) && v !== "") ? Number(v) : null;
                const str = (v) => (v || "").toString();

                const dateObj = new Date(`${item.date}T12:00:00`); 
                
                let rawSport = str(item.actualSport || item.activityType?.typeKey || "Other");
                let cleanSport = "Other";
                if (rawSport.match(/Run|Jog/i)) cleanSport = "Run";
                else if (rawSport.match(/Bike|Cycl|Ride|Zwift/i)) cleanSport = "Bike";
                else if (rawSport.match(/Swim|Pool/i)) cleanSport = "Swim";

                const cadBike = num(item.averageBikingCadenceInRevPerMinute);
                const cadRun = num(item.averageRunningCadenceInStepsPerMinute);
                const cleanCadence = cadBike || cadRun || 0;

                return {
                    id: str(item.id),
                    date: dateObj,
                    dateStr: item.date, 
                    title: str(item.actualWorkout || item.activityName || "Workout"),
                    sport: cleanSport, 
                    duration: num(item.actualDuration) || 0, 
                    distance: num(item.distance) || 0,       
                    hr: num(item.averageHR) || 0,
                    power: num(item.avgPower) || num(item.normPower) || 0,
                    speed: num(item.averageSpeed) || 0,
                    cadence: cleanCadence,
                    rpe: num(item.RPE) || 0,
                    tss: num(item.trainingStressScore) || 0,
                    feel: num(item.Feeling) || 0,
                    vo2: num(item.vO2MaxValue) || 0,
                    anaerobic: num(item.anaerobicTrainingEffect) || 0,
                    gct: num(item.avgGroundContactTime) || 0,
                    vert: num(item.avgVerticalOscillation) || 0,
                    status: item.status === 'COMPLETED' ? 'COMPLETED' : 'PLANNED',
                    source: item 
                };
            }).sort((a,b) => b.date - a.date);
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
                    this.allData = this.processData(rawJson);
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
                    // CRITICAL FIX: Removed `this.getStatsBar()`
                    else if (view === 'dashboard' && renderDashboard) {
                        content.innerHTML = renderDashboard(this.planMd, this.allData);
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
                                 <td class="p-2 border-b border-slate-700 text-xs font-bold ${d.sport === 'Run' ? 'text-pink-400' : d.sport === 'Bike' ? 'text-purple-400' : 'text-cyan-400'}">${d.sport}</td>
                                 <td class="p-2 border-b border-slate-700 text-xs">${d.title}</td>
                                 <td class="p-2 border-b border-slate-700 text-xs text-right">${Math.round(d.duration)}m</td>
                                 <td class="p-2 border-b border-slate-700 text-xs text-right">${d.hr > 0 ? Math.round(d.hr) : '-'}</td>
                                 <td class="p-2 border-b border-slate-700 text-xs text-right">${d.power > 0 ? Math.round(d.power) : '-'}</td>
                            </tr>`).join('');
                        content.innerHTML = `<div class="bg-slate-800 p-4 rounded-xl overflow-x-auto"><table class="w-full text-left text-slate-300"><thead><tr><th>Date</th><th>Sport</th><th>Activity</th><th class="text-right">Dur</th><th class="text-right">HR</th><th class="text-right">Pwr</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
        }
    };

    window.App = App;
    App.init();
})();
