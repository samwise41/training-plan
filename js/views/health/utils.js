// js/views/health/utils.js

export const parseHealthTable = (mdText) => {
    if (!mdText) return [];
    
    const lines = mdText.split('\n');
    let headers = [];
    let data = [];
    let foundTable = false;

    for (let line of lines) {
        const trimmed = line.trim();
        
        // Detect Header
        if (!foundTable && trimmed.startsWith('|') && trimmed.toLowerCase().includes('date')) {
            headers = trimmed.split('|').map(h => h.trim().toLowerCase()).filter(h => h);
            foundTable = true;
            continue;
        }
        
        // Skip separator
        if (foundTable && trimmed.startsWith('|') && trimmed.includes('---')) continue;

        // Parse Row
        if (foundTable && trimmed.startsWith('|')) {
            const cols = trimmed.split('|').map(c => c.trim()).filter(c => c !== "");
            
            // Map columns to friendly keys based on header index
            let row = {};
            headers.forEach((h, i) => {
                if (i < cols.length) {
                    const val = cols[i];
                    
                    if (h.includes('date')) row.date = val;
                    // Parse Numbers (handle '--' or empty)
                    else {
                        const num = parseFloat(val);
                        // Map common headers to cleaner keys
                        let key = h;
                        if (h.includes('resting hr')) key = 'rhr';
                        else if (h.includes('max hr')) key = 'maxHr';
                        else if (h.includes('sleep hours')) key = 'sleep';
                        else if (h.includes('stress avg')) key = 'stressAvg';
                        else if (h.includes('stress max')) key = 'stressMax';
                        else if (h.includes('body batt max')) key = 'bbMax';
                        else if (h.includes('body batt min')) key = 'bbMin';
                        else if (h.includes('hrv')) key = 'hrv';
                        
                        row[key] = isNaN(num) ? null : num;
                    }
                }
            });

            if (row.date) {
                // Convert Date
                row.dateObj = new Date(row.date);
                if (!isNaN(row.dateObj)) data.push(row);
            }
        }
    }
    
    return data.sort((a,b) => a.dateObj - b.dateObj);
};

export const filterDataByRange = (data, range) => {
    if (!data || data.length === 0) return [];
    const now = new Date();
    const cutoff = new Date();
    
    if (range === '30d') cutoff.setDate(now.getDate() - 30);
    else if (range === '90d') cutoff.setDate(now.getDate() - 90);
    else if (range === '6m') cutoff.setMonth(now.getMonth() - 6);
    else if (range === '1y') cutoff.setFullYear(now.getFullYear() - 1);
    
    return data.filter(d => d.dateObj >= cutoff);
};
