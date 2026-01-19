// js/parser.js

export const Parser = {
    // 1. Extract a specific section from the Markdown (e.g., "Weekly Schedule")
    getSection(md, headerTitle) {
        if (!md) return null;
        // Regex looks for "## Title" and captures everything until the next "##" or end of file
        const regex = new RegExp(`##\\s*${headerTitle}\\s*\\n([\\s\\S]*?)(?=##|$)`, 'i');
        const match = md.match(regex);
        return match ? match[1].trim() : null;
    },

    // 2. Parse a Markdown Table into an Array of Objects
    _parseTableBlock(tableStr) {
        if (!tableStr) return [];
        const lines = tableStr.trim().split('\n');
        
        // Find the header line (starts with |)
        const headerIndex = lines.findIndex(l => l.trim().startsWith('|'));
        if (headerIndex === -1) return [];

        // Parse Headers (clean whitespace)
        const headers = lines[headerIndex]
            .split('|')
            .map(h => h.trim())
            .filter(h => h); // Remove empty strings from ends

        // Map headers to cleaner keys (Date, Activity, Duration, etc.)
        const keyMap = headers.map(h => {
            const low = h.toLowerCase();
            if (low.includes('date')) return 'date';
            if (low.includes('activity') || low.includes('workout')) return 'planName';
            if (low.includes('duration') || low.includes('time')) return 'plannedDuration';
            if (low.includes('type') || low.includes('sport')) return 'type';
            if (low.includes('notes') || low.includes('description')) return 'notes';
            return low; // fallback
        });

        const results = [];

        // Iterate over data rows (skip header and separator |---|)
        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line.startsWith('|') || line.includes('---')) continue;

            const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            
            // Allow for trailing pipes mismatch by slicing
            // (Sometimes splitting '|' creates empty first/last elements)
            
            // Robust Cell Extraction
            const rawCells = line.split('|');
            // Remove first and last empty elements if they exist
            if (rawCells[0] === '') rawCells.shift();
            if (rawCells[rawCells.length-1] === '') rawCells.pop();

            const entry = {};
            let hasData = false;

            keyMap.forEach((key, k) => {
                const val = rawCells[k] ? rawCells[k].trim() : '';
                
                if (key === 'date') {
                    const d = new Date(val);
                    if (!isNaN(d)) {
                        entry.date = d;
                        hasData = true;
                    }
                } else if (key === 'plannedDuration') {
                    // Parse "1h 30m" or just numbers
                    entry[key] = this._parseDuration(val);
                } else {
                    entry[key] = val;
                }
            });

            if (hasData && entry.date) {
                // Default Type detection if missing
                if (!entry.type && entry.planName) {
                    const n = entry.planName.toUpperCase();
                    if (n.includes('RUN')) entry.type = 'Run';
                    else if (n.includes('BIKE') || n.includes('RIDE')) entry.type = 'Bike';
                    else if (n.includes('SWIM')) entry.type = 'Swim';
                    else if (n.includes('REST')) entry.type = 'Rest';
                    else entry.type = 'Other';
                }
                results.push(entry);
            }
        }
        
        return results;
    },

    // Helper: "1h 30m" -> 90
    _parseDuration(str) {
        if (!str) return 0;
        let total = 0;
        const h = str.match(/(\d+)\s*h/);
        const m = str.match(/(\d+)\s*m/);
        if (h) total += parseInt(h[1]) * 60;
        if (m) total += parseInt(m[1]);
        if (!h && !m && !isNaN(parseInt(str))) total = parseInt(str);
        return total;
    }
};
