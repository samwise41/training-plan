export const renderPowerCurve = (containerId, data) => {
    const ctx = document.getElementById(containerId);
    
    // Prune data for performance: keeping high detail for 1s-60s
    const filteredData = data.filter(d => {
        if (d.seconds <= 60) return true;
        if (d.seconds <= 3600) return d.seconds % 60 === 0;
        return d.seconds % 300 === 0;
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: filteredData.map(d => formatTimeLabel(d.seconds)),
            datasets: [
                {
                    label: 'All Time Best',
                    data: filteredData.map(d => d.all_time_watts),
                    borderColor: '#f97316',
                    borderWidth: 3,
                    fill: false
                },
                {
                    label: '6 Week Best',
                    data: filteredData.map(d => d.six_week_watts),
                    borderColor: '#fbbf24',
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: 'rgba(251, 191, 36, 0.1)'
                }
            ]
        },
        options: {
            scales: {
                x: { type: 'logarithmic', title: { display: true, text: 'Duration' } },
                y: { title: { display: true, text: 'Watts' } }
            }
        }
    });
};

function formatTimeLabel(s) {
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s/60) + 'm';
    return Math.floor(s/3600) + 'h';
}
