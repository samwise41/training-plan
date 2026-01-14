// Add to METRIC_FORMULAS
const METRIC_FORMULAS = {
    'subjective_bike': '(Avg Power / RPE)',
    'subjective_run': '(Avg Speed / RPE)',
    'subjective_swim': '(Avg Speed / RPE)',
    // ... others ...
};

// Update the extractor function
const calculateSubjectiveEfficiency = (allData, sportType) => {
    return allData
        .map(d => {
            const rpe = parseFloat(d.RPE);
            if (!rpe || rpe === 0) return null;

            // BIKE LOGIC
            if (sportType === 'bike') {
                const isBike = d.sportTypeId == '2' || (d.activityType && d.activityType.includes('cycl'));
                const pwr = parseFloat(d.avgPower);
                if (isBike && pwr > 0) {
                    return {
                        date: new Date(d.Date),
                        val: pwr / rpe,
                        name: d['Actual Workout'],
                        breakdown: `${Math.round(pwr)}W / ${rpe} RPE`
                    };
                }
            }
            
            // RUN LOGIC
            if (sportType === 'run') {
                const isRun = d.sportTypeId == '1' || (d.activityType && d.activityType.includes('run'));
                const spd = parseFloat(d.avgSpeed); // m/s
                if (isRun && spd > 0) {
                    return {
                        date: new Date(d.Date),
                        val: spd / rpe,
                        name: d['Actual Workout'],
                        breakdown: `${spd.toFixed(1)}m/s / ${rpe} RPE`
                    };
                }
            }

            // SWIM LOGIC
            if (sportType === 'swim') {
                const isSwim = d.sportTypeId == '5' || (d.activityType && d.activityType.includes('swim'));
                const spd = parseFloat(d.avgSpeed);
                if (isSwim && spd > 0) {
                    return {
                        date: new Date(d.Date),
                        val: spd / rpe,
                        name: d['Actual Workout'],
                        breakdown: `${spd.toFixed(1)}m/s / ${rpe} RPE`
                    };
                }
            }

            return null;
        })
        .filter(Boolean)
        .sort((a, b) => a.date - b.date);
};

// In updateCharts(), update the render calls:
const render = (id, key) => {
    // ... setup ...
    let full;
    if (key === 'subjective_bike') full = calculateSubjectiveEfficiency(allData, 'bike');
    else if (key === 'subjective_run') full = calculateSubjectiveEfficiency(allData, 'run');
    else if (key === 'subjective_swim') full = calculateSubjectiveEfficiency(allData, 'swim');
    else full = extractMetricData(allData, key).sort((a,b) => a.date - b.date);
    // ... render ...
};
