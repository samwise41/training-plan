export const Parser = {
    lastDebugInfo: {}, 

    getSection(md, title) {
        if (!md) return "";
        const lines = md.split('\n');
        let capturing = false, section = [];
        for (let line of lines) {
            const trimmed = line.trim();
            const isHeader = trimmed.startsWith('#');
            if (isHeader) {
                if (trimmed.toLowerCase().includes(title.toLowerCase())) {
                    capturing = true;
                    continue;
                }
                if (capturing && !trimmed.startsWith('###')) {
                    break;
                }
            }
            if (capturing) section.push(line);
        }
        return section.join('\n').trim();
    },

    getBiometrics(md) {
        const profileSection = this.getSection(md, "Profile") || this.getSection(md, "Biometrics");
        
        const ftp = profileSection.match(/Cycling FTP[^0-9]*(\d{1,3})/i);
        const weight = profileSection.match(/Weight[^0-9]*(\d{1,3})/i);
        const lthr = profileSection.match(/Lactate Threshold HR[^0-9]*(\d{2,3})/i);
        const runFtp = profileSection.match(/Functional Threshold Pace.*?(\d{1,2}:\d{2})/i);
        const fiveK = profileSection.match(/5K Prediction.*?(\d{1,2}:\d{2})/i);

        return {
            watts: ftp ? parseInt(ftp[1]) : 0,
            weight: weight ? parseInt(weight[1]) : 0,
            lthr: lthr ? parseInt(lthr[1]) : 0,
            runFtp: runFtp ? runFtp[1] : "--",
            fiveK: fiveK ? fiveK[1] : "--"
        };
    },

    _parseTime(str) {
        if (!str) return 0;
        const isHours = str.toLowerCase().includes('h');
        const numMatch = str.match(/([\d\.]+)/);
        
        if (!numMatch) return 0;
        
        const val = parseFloat(numMatch[1]);
        if (isNaN(val)) return 0;
        
        if (isHours || (val < 10 && !str.toLowerCase().includes('m'))) {
            return Math.round(val * 60);
        } else {
            return Math.round(val);
        }
    },

    _getType(str) {
        if (!str) return 'Other';
        const lower = str.toLowerCase();
        if (lower.match(/bike|cycle|zwift|ride|spin|peloton/)) return 'Bike';
        if (lower.match(/run|jog|treadmill/)) return 'Run';
        if (lower.match(/swim|pool/)) return 'Swim';
        if (lower.match(/strength|lift|gym|core/)) return 'Strength';
        return 'Other';
    },

    // Refactored: Internal helper to parse a specific raw text block
    _parseTableBlock(sectionText) {
        if (!sectionText) return [];
        
        const lines = sectionText.split('\n');
        
        // Indices
        let dateIdx = -1;
        let statusIdx = -1;
        let planWorkoutIdx = -1; 
        let planDurIdx = -1;     
        let actWorkoutIdx = -1;  
        let actDurIdx = -1;
        let notesIdx = -1; // NEW: Capture Notes

        let data = [];

        // 1. Find Headers
        for (let line of lines) {
            if (line.includes('|')) {
                const lowLine = line.toLowerCase();
                if (lowLine.includes('date') && lowLine.includes('planned')) {
                    const cleanHeaders = line.split('|').map(h => h.trim().toLowerCase().replace(/\*\*/g, ''));
                    
                    cleanHeaders.forEach((h, index) => {
                        if (h.includes('date')) dateIdx = index;
                        else if (h.includes('status')) statusIdx = index;
                        else if (h.includes('planned workout')) planWorkoutIdx = index;
                        else if (h.includes('planned duration')) planDurIdx = index;
                        else if (h.includes('actual workout')) actWorkoutIdx = index;
                        else if (h.includes('actual duration')) actDurIdx = index;
                        else if (h.includes('notes') || h.includes('target')) notesIdx = index; // NEW
                    });
                    
                    if (dateIdx !== -1 && planWorkoutIdx !== -1) { 
                        break; 
                    }
                }
            }
        }

        if (dateIdx === -1) return [];

        // 2. Parse Rows
        for (let line of lines) {
            if (!line.includes('|') || line.includes('---')) continue;
            
            const cols = line.split('|');
            if (cols.length < 3) continue; 

            const cleanText = (str) => (str || "").trim().replace(/\*\*/g, '').replace(/__/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
            
            // Safe column access
            const getCol = (idx) => (idx > -1 && idx < cols.length) ? cleanText(cols[idx]) : "";

            const dateStr = getCol(dateIdx);
            
            // Skip header repeaters or empty dates
            if (!dateStr || dateStr.toLowerCase().includes('date')) continue;

            const planStr = getCol(planWorkoutIdx);
            const statusStr = getCol(statusIdx).toLowerCase();
            const planDurStr = getCol(planDurIdx);
            const actDurStr = getCol(actDurIdx);
            const actualWorkoutStr = getCol(actWorkoutIdx);
            const notesStr = getCol(notesIdx); // NEW

            let date = null;
            // Force Noon to avoid UTC shift
            const ymdMatch = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (ymdMatch) {
                const year = parseInt(ymdMatch[1]);
                const month = parseInt(ymdMatch[2]) - 1;
                const day = parseInt(ymdMatch[3]);
                date = new Date(year, month, day, 12, 0, 0); 
            } else {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) { date = d; date.setHours(12, 0, 0, 0); }
            }

            if (date && !isNaN(date.getTime())) {
                const type = this._getType(planStr);
                const actualType = this._getType(actualWorkoutStr);

                data.push({
                    date: date,
                    dayName: date.toLocaleDateString('en-US', { weekday: 'long' }), // Helper for UI
                    type: type,
                    planName: planStr,
                    actualName: actualWorkoutStr,
                    actualType: actualType,
                    completed: statusStr.match(/completed|done|yes|x/),
                    plannedDuration: this._parseTime(planDurStr),
                    actualDuration: this._parseTime(actDurStr),
                    notes: notesStr // NEW
                });
            }
        }
        return data;
    },

    parseTrainingLog(md) {
        this.lastDebugInfo = { sectionFound: false, headersFound: {}, rowsParsed: 0, firstRowRaw: "" };
        
        let historySection = this.getSection(md, "Appendix C: Training History Log") || this.getSection(md, "Training History");
        const scheduleSection = this.getSection(md, "Weekly Schedule");

        const historyData = this._parseTableBlock(historySection);
        const scheduleData = this._parseTableBlock(scheduleSection);

        const merged = [...historyData, ...scheduleData];

        this.lastDebugInfo.rowsParsed = merged.length;
        return merged;
    },

    parseGearMatrix(md) {
        const results = { bike: [], run: [] };
        const lines = md.split('\n');
        let currentType = null;
        let inTable = false;

        for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                const low = trimmed.toLowerCase();
                if (low.includes('cycling') || low.includes('bike')) currentType = 'bike';
                else if (low.includes('running') || low.includes('run')) currentType = 'run';
                else currentType = null;
                inTable = false;
                continue;
            }

            if (currentType && trimmed.startsWith('|')) {
                if (trimmed.includes('---') || trimmed.toLowerCase().includes('range') || trimmed.toLowerCase().includes('temp')) {
                    inTable = true;
                    continue;
                }
                if (inTable) {
                    const parts = trimmed.split('|').map(p => p.trim());
                    if (trimmed.startsWith('|')) parts.shift();
                    if (trimmed.endsWith('|')) parts.pop();

                    if (parts.length >= 2) {
                        const rangeStr = parts[0];
                        let min = -999, max = 999;
                        const numMatch = rangeStr.match(/\d+/g);
                        if (!numMatch) continue;
                        const lowRangeStr = rangeStr.toLowerCase();
                        
                        if (lowRangeStr.match(/below|under|<|less/)) {
                            min = -999; max = parseInt(numMatch[0]);
                        } else if (lowRangeStr.match(/above|over|up|\+|more/)) {
                            min = parseInt(numMatch[0]); max = 999;
                        } else if (numMatch.length >= 2) {
                            min = parseInt(numMatch[0]); max = parseInt(numMatch[1]);
                        } else {
                            min = parseInt(numMatch[0]); max = parseInt(numMatch[0]);
                        }
                        results[currentType].push({ min, max, upper: parts[1] || "—", lower: parts[2] || "—", extremities: parts[3] || "—" });
                    }
                }
            } else if (inTable && trimmed !== "") {
                inTable = false;
            }
        }
        return results;
    }
};