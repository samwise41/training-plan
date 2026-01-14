// js/views/metrics/charts.js
// ... (Keep existing imports and calculateSubjectiveEfficiency/buildMetricChart logic from previous response) ...
// Just update the updateCharts function at the bottom:

export const updateCharts = (allData, timeRange) => {
    if (!allData || allData.length === 0) return;
    
    const cutoff = new Date();
    if (timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (timeRange === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
    else if (timeRange === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);
    
    const render = (id, key) => {
        const el = document.getElementById(id);
        if (el) {
            let full;
            // Handle Custom Split Metrics
            if (key === 'subjective_bike') full = calculateSubjectiveEfficiency(allData, 'bike');
            else if (key === 'subjective_run') full = calculateSubjectiveEfficiency(allData, 'run');
            else if (key === 'subjective_swim') full = calculateSubjectiveEfficiency(allData, 'swim');
            else full = extractMetricData(allData, key).sort((a,b) => a.date - b.date);
            
            const display = full.filter(d => d.date >= cutoff);
            el.innerHTML = buildMetricChart(display, full, key);
        }
    };

    // 1. GENERAL
    render('metric-chart-vo2max', 'vo2max');
    render('metric-chart-tss', 'tss');
    render('metric-chart-anaerobic', 'anaerobic');

    // 2. BIKE
    render('metric-chart-subjective_bike', 'subjective_bike');
    render('metric-chart-endurance', 'endurance');
    render('metric-chart-strength', 'strength');

    // 3. RUN
    render('metric-chart-subjective_run', 'subjective_run');
    render('metric-chart-run', 'run');
    render('metric-chart-mechanical', 'mechanical');
    render('metric-chart-gct', 'gct');
    render('metric-chart-vert', 'vert');

    // 4. SWIM
    render('metric-chart-subjective_swim', 'subjective_swim');
    render('metric-chart-swim', 'swim');

    ['30d', '90d', '6m', '1y'].forEach(range => {
        const btn = document.getElementById(`btn-metric-${range}`);
        if(btn) {
            btn.className = timeRange === range ? 
                "bg-emerald-500 text-white font-bold px-3 py-1 rounded text-[10px] transition-all shadow-lg" : 
                "bg-slate-800 text-slate-400 hover:text-white px-3 py-1 rounded text-[10px] transition-all hover:bg-slate-700";
        }
    });
};
