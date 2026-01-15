// Inside js/views/zones/logic.js

// Add this helper
const parseRecords = (markdown) => {
    // Find Running section
    const runningSection = markdown.split('## Running')[1].split('##')[0];
    const lines = runningSection.trim().split('\n');
    const records = [];
    
    // Skip header and separator (index 0 and 1 usually)
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('|')) continue;
        
        const cols = line.split('|').map(c => c.trim()).filter(c => c);
        // Assuming | Distance | Time | Pace | ...
        if (cols.length >= 3) {
            records.push({
                distance: cols[0],
                time: cols[1],
                pace: cols[2]
            });
        }
    }
    return records;
};

// Update getData to include records
export const getZonesData = async () => {
    // ... existing calls ...
    const recordsRes = await fetch('garmind_data/garmin_records.md');
    const recordsText = await recordsRes.text();
    const records = parseRecords(recordsText);
    
    return { ...existingData, records };
}
