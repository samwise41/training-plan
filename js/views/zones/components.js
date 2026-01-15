export const createPacingChart = (canvasId, records) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Filter/Sort records if needed. 
    // The user listed "1k, 1m, 5k". Let's try to keep the order from the file or a fixed order.
    // Fixed order is safer:
    const order = ['1 km', '1 mi', '5 km', '10 km', 'Half Marathon', 'Marathon'];
    
    // Map records to this order
    const chartData = [];
    const labels = [];
    
    order.forEach(dist => {
        const r = records.find(rec => rec.distance.toLowerCase().includes(dist.toLowerCase().replace('1 km','1k').replace('1 mi','1m'))); 
        // actually, let's just look for exact or partial matches based on file content.
        // I'll see what the file says. simpler to just dump the records in order if the file is ordered.
    });
    
    // Let's assume the file has them.
    // Helper to parse "MM:SS" to seconds
    const parsePace = (paceStr) => {
        const parts = paceStr.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };
    
    // Helper to format seconds to "MM:SS"
    const formatPace = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const dataPoints = records.map(r => parsePace(r.pace));
    const labels = records.map(r => r.distance);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Running Pace (min/km)', // or min/mi depending on user unit
                data: dataPoints,
                borderColor: '#36A2EB',
                tension: 0.1
            }]
        },
        options: {
            scales: {
                y: {
                    ticks: {
                        callback: function(value) { return formatPace(value); }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatPace(context.raw);
                        }
                    }
                }
            }
        }
    });
}
