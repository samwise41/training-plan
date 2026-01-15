export const ZONES_CONFIG = {
    cycling: {
        profilePath: 'strava_data/cycling/my_power_profile.md',
        curvePath: 'strava_data/cycling/power_curve_graph.json', // New Data Source
        zones: [
            { name: 'Z1 - Recovery', range: '< 55%' },
            { name: 'Z2 - Endurance', range: '56-75%' },
            { name: 'Z3 - Tempo', range: '76-90%' },
            { name: 'Z4 - Threshold', range: '91-105%' },
            { name: 'Z5 - VO2 Max', range: '106-120%' },
            { name: 'Z6 - Anaerobic', range: '121-150%' },
            { name: 'Z7 - Neuromuscular', range: '> 150%' }
        ]
    },
    running: {
        profilePath: 'strava_data/running/my_running_prs.md',
        thresholdSource: 'Running Profile Card', // Logic reference
        zones: [
            { name: 'Z1 - Easy', range: '65-78% HR' },
            { name: 'Z2 - Moderate', range: '79-89% HR' },
            { name: 'Z3 - Hard', range: '90-95% HR' },
            { name: 'Z4 - Threshold', range: '96-100% HR' },
            { name: 'Z5 - Max', range: '> 100% HR' }
        ]
    }
};
