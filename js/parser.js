// js/parser.js
export const Parser = {
    // Finds a specific header like "## Weekly Schedule"
    getSection(md, headerTitle) {
        if (!md) return null;
        const regex = new RegExp(`##\\s*${headerTitle}\\s*\\n([\\s\\S]*?)(?=##|$)`, 'i');
        const match = md.match(regex);
        return match ? match[1].trim() : null;
    },

    // Turns the Markdown table into an array of workout objects
    _parseTableBlock(tableStr) {
        if (!tableStr) return [];
        const lines = tableStr.trim().split('\n');
        
        // Find header row
        const headerIndex = lines.findIndex(l => l.trim().startsWith('|'));
        if (headerIndex === -1) return [];

        const headers = lines[headerIndex].split('|').map(h => h.trim().toLowerCase()).filter(h => h);
        
        // Map column names to keys
        const keyMap = headers.map(h => {
            if (h.includes('date')) return 'date';
            if (h.includes('activity') || h.includes('workout')) return 'planName';
            if (h.includes('duration') || h.includes('time')) return 'plannedDuration';
            if (h.includes('type') || h.includes('sport')) return 'type';
            if (h.includes('notes')) return 'notes';
            return 'unknown';
        });

        const results = [];

        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line.startsWith('|') || line.includes('---')) continue;

            const cells = line.split('|').map(c => c.trim());
            // Remove empty start/end created by split
            if (cells[0] === '') cells.shift(); 
            if (cells[cells.length-1] === '') cells.pop();

            const entry = {};
            keyMap.forEach((key, idx) => {
                if (key === 'date') entry.date = new Date(cells[idx]);
                else if (key === 'plannedDuration') entry.plannedDuration = parseInt(cells[idx]) || 0;
                else entry[key] = cells[idx];
            });

            if (entry.date && !isNaN(entry.date)) {
                // Infer type if missing
                if (!entry.type && entry.planName) {
                    const n = entry.planName.toUpperCase();
                    if (n.includes('RUN')) entry.type = 'Run';
                    else if (n.includes('BIKE')) entry.type = 'Bike';
                    else if (n.includes('SWIM')) entry.type = 'Swim';
                    else entry.type = 'Other';
                }
                results.push(entry);
            }
        }
        return results;
    }
};
