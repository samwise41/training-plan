import { parseMarkdownTable } from '../../utils.js'; // Assuming this exists, otherwise use local parser below

// Local parser if generic one isn't suitable or available
const parseRecords = (text) => {
    const lines = text.split('\n');
    let inRunning = false;
    const records = [];

    lines.forEach(line => {
        if (line.includes('## Running')) {
            inRunning = true;
            return;
        }
        if (line.startsWith('##') && inRunning) {
            inRunning = false;
            return;
        }
        
        // Parse table rows
        if (inRunning && line.trim().startsWith('|') && !line.includes('---') && !line.includes('Distance')) {
            const cols = line.split('|').map(c => c.trim()).filter(c => c);
            // Expected format: | Distance | Time | Pace | ...
            if (cols.length >= 3) {
                records.push({
                    distance: cols[0],
                    time: cols[1],
                    pace: cols[2]
                });
            }
        }
    });
    return records;
};

export const getZonesData = async () => {
    try {
        const [cyclingRes, runningRes, recordsRes] = await Promise.all([
            fetch('garmind_data/garmin_cycling.md'),
            fetch('garmind_data/garmin_running.md'),
            fetch('garmind_data/garmin_records.md')
        ]);

        const cyclingText = await cyclingRes.text();
        const runningText = await runningRes.text();
        const recordsText = await recordsRes.text();

        // Use existing parsers for cycling/running if they exist in the file, 
        // otherwise assume parseMarkdownTable or similar logic is present.
        // Preserving existing logic structure:
        
        return {
            cycling: parseMarkdownTable ? parseMarkdownTable(cyclingText) : {}, 
            running: parseMarkdownTable ? parseMarkdownTable(runningText) : {},
            records: parseRecords(recordsText)
        };
    } catch (error) {
        console.error('Error fetching zones data:', error);
        return { cycling: [], running: [], records: [] };
    }
};
