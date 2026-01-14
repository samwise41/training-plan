// Inside js/app.js - Update loadData()

async function loadData() {
    try {
        // Fetch Master DB and Health DB
        const [masterRes, healthRes] = await Promise.all([
            fetch('MASTER_TRAINING_DATABASE.md'),
            fetch('garmind_data/garmin_health.md').catch(() => ({ ok: false })) // Soft fail if missing
        ]);

        const masterText = await masterRes.text();
        const healthText = healthRes.ok ? await healthRes.text() : "";

        // Parse Both
        const trainingData = Parser.parseTrainingLog(masterText);
        const healthData = Parser.parseHealthLog(healthText);

        // Combine
        // We add health data to the main array. The charts will filter by "isHealth".
        const allData = [...trainingData, ...healthData];

        // ... (rest of logic: renderDashboard, renderCalendar, etc.) ...
        renderDashboard(allData);
        // ...
        
        // Pass combined data to metrics
        if (window.renderMetrics) {
            document.getElementById('metrics-content').innerHTML = window.renderMetrics(allData);
        }

    } catch (e) {
        console.error("Load Error:", e);
    }
}
