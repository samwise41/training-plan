// ... existing code ...

export const createPacingChart = (canvasId, records) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !records || records.length === 0) return;

    // Helper: "4:00" -> 240 seconds
    const parsePaceToSeconds = (paceStr) => {
        if (!paceStr) return 0;
        const parts = paceStr.split(':');
        if (parts.length === 2) {
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        return 0;
    };

    // Helper: 240 seconds -> "4:00"
    const formatSecondsToPace = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const labels = records.map(r => r.distance);
    const data = records.map(r => parsePaceToSeconds(r.pace));

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pace (min/km)',
                data: data,
                borderColor: '#36A2EB', // Blue to differentiate or match theme
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Pace (min)'
                    },
                    ticks: {
                        // Use callback to format seconds back to MM:SS
                        callback: function(value) {
                            return formatSecondsToPace(value);
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Distance'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Pace: ${formatSecondsToPace(context.raw)}`;
                        }
                    }
                },
                legend: {
                    display: false
                }
            }
        }
    });
};
