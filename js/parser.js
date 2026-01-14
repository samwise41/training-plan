// js/parser.js

// ... (existing code) ...

    _parseTableBlock(sectionText) {
        if (!sectionText) return [];
        const lines = sectionText.split('\n');
        
        // Header Indices
        let dateIdx = -1, statusIdx = -1, planWorkoutIdx = -1, planDurIdx = -1;
        let actWorkoutIdx = -1, actDurIdx = -1, notesIdx = -1;
        let rawDurIdx = -1;

        let hrIdx = -1, powerIdx = -1, speedIdx = -1, tssIdx = -1, activityIdIdx = -1, cadenceIdx = -1; 
        let teLabelIdx = -1;
        
        // Metrics Indices
        let vo2Idx = -1, gctIdx = -1, vertIdx = -1, anaerobicIdx = -1, normPowerIdx = -1, elevIdx = -1;
        
        // --- NEW: Subjective Indices ---
        let rpeIdx = -1, feelIdx = -1;

        let data = [];

        for (let line of lines) {
            if (line.includes('|')) {
                const lowLine = line.toLowerCase();
                if (lowLine.includes('date')) {
                    const cleanHeaders = line.split('|').map(h => h.trim().toLowerCase().replace(/\*\*/g, ''));
                    cleanHeaders.forEach((h, index) => {
                        // Standard Columns
                        if (h.includes('date')) dateIdx = index;
                        else if (h.includes('status')) statusIdx = index;
                        // ... (keep existing mappings) ...
                        else if (h.includes('elevationgain')) elevIdx = index;
                        
                        // --- NEW: Map Subjective Columns ---
                        else if (h === 'rpe') rpeIdx = index;
                        else if (h === 'feeling') feelIdx = index;
                    });
                    if (dateIdx !== -1) break; 
                }
            }
        }

        if (dateIdx === -1) return [];

        for (let line of lines) {
            if (!line.includes('|') || line.includes('---')) continue;
            const cols = line.split('|');
            if (cols.length < 3) continue; 

            // ... (keep existing helper functions) ...
            
            // ... (keep existing parsing logic) ...
            const normPower = parseFloat(getCol(normPowerIdx)) || 0; 
            const elevationGain = parseFloat(getCol(elevIdx)) || 0;

            // --- NEW: Extract RPE and Feeling ---
            const rpe = getCol(rpeIdx);       // Keep as string initially to check existence
            const feeling = getCol(feelIdx);

            // ... (keep date parsing logic) ...

            if (date && !isNaN(date.getTime())) {
                // ... (keep type detection logic) ...

                data.push({
                    // ... (keep existing fields) ...
                    trainingStressScore: tss,
                    elevationGain,
                    
                    // --- NEW: Add to Data Object ---
                    RPE: rpe,        // Store as string or parse if needed
                    Feeling: feeling
                });
            }
        }
        return data;
    },

// ... (rest of file) ...
