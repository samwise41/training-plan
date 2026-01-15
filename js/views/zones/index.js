import { getZonesData } from './logic.js';
import { 
    createFtpChart, 
    createWkgChart, 
    createRunningProfileChart, 
    createRunningZonesChart,
    createPacingChart // Import the new component
} from './components.js';

export const renderZonesView = async (container) => {
    const data = await getZonesData();
    
    // Updated Layout:
    // Row 1: Cycling FTP | Cycling W/kg
    // Row 2: Running Pacing (Full Width)
    // Row 3: Running Profile | Running Zones
    
    const html = `
        <div class="zones-dashboard">
            <div class="charts-row">
                <div class="chart-card">
                    <h3>Cycling FTP History</h3>
                    <div class="chart-container">
                        <canvas id="ftpChart"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h3>Watts / Kg</h3>
                    <div class="chart-container">
                        <canvas id="wkgChart"></canvas>
                    </div>
                </div>
            </div>

            <div class="charts-row">
                <div class="chart-card full-width" style="grid-column: 1 / -1; width: 100%;">
                    <h3>Running Pacing over Distances</h3>
                    <div class="chart-container" style="height: 300px;">
                        <canvas id="runningPacingChart"></canvas>
                    </div>
                </div>
            </div>

            <div class="charts-row">
                <div class="chart-card">
                    <h3>Running Profile</h3>
                    <div class="chart-container">
                        <canvas id="runningProfileChart"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h3>Running Heart Rate Zones</h3>
                    <div class="chart-container">
                        <canvas id="runningZonesChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Render existing charts
    createFtpChart('ftpChart', data.cycling);
    createWkgChart('wkgChart', data.cycling);
    createRunningProfileChart('runningProfileChart', data.running);
    createRunningZonesChart('runningZonesChart', data.running);
    
    // Render new chart
    createPacingChart('runningPacingChart', data.records);
};
