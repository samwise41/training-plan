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
        return {
            watts: ftp ? parseInt(ftp[1]) : 0,
            weight: weight ? parseInt(weight[1]) : 0
        };
    },

    _parseTime(str) {
        if (!str) return 0;
        const isHours = str.toLowerCase().includes('h');
        const numMatch = str.match(/([\d\.]+)/);
        
        if (!numMatch) return 0;
        
        const val = parseFloat(numMatch[1]);
        if (isNaN(val)) return 0;
        
        // Logic to catch small numbers (e.g. "2.5") without "h" unit as hours
        if (isHours || (val < 10 && !str.toLowerCase().includes('m'))) {
            return Math.round(val * 60);
        } else {
            return Math.round(val); // Assume minutes
        }
    },

    _getType(str) {
        if (!str) return 'Other';
        const lower = str.toLowerCase();
        if (lower.match(/bike|cycle|zwift|ride|spin|peloton/)) return 'Bike';
        if (lower.match(/run|jog|treadmill/)) return 'Run';
        if (lower.match(/swim|pool/)) return 'Swim';
        return 'Other';
    },

    parseTrainingLog(md) {
        this.lastDebugInfo = { sectionFound: false, headersFound: {}, rowsParsed: 0, firstRowRaw: "" };

        let sectionName = "Appendix C: Training History Log";
        let section = this.getSection(md, sectionName);
        if (!section) {
             sectionName = "Training History";
             section = this.getSection(md, sectionName);
        }
        
        if (!section) return [];

        this.lastDebugInfo.sectionFound = true;
        const lines = section.split('\n');
        
        // Indices for new column order
        let dateIdx = -1;
        let statusIdx = -1;
        let planWorkoutIdx = -1; 
        let planDurIdx = -1;     
        let actWorkoutIdx = -1;  
        let actDurIdx = -1;      

        let data = [];

        // 1. Find Headers
        for (let line of lines) {
            if (line.includes('|')) {
                const lowLine = line.toLowerCase();
                if (lowLine.includes('date') && lowLine.includes('planned') && lowLine.includes('actual')) {
                    const cleanHeaders = line.split('|').map(h => h.trim().toLowerCase().replace(/\*\*/g, ''));
                    
                    cleanHeaders.forEach((h, index) => {
                        if (h.includes('date')) dateIdx = index;
                        else if (h.includes('status')) statusIdx = index;
                        else if (h.includes('planned workout')) planWorkoutIdx = index;
                        else if (h.includes('planned duration')) planDurIdx = index;
                        else if (h.includes('actual workout')) actWorkoutIdx = index;
                        else if (h.includes('actual duration')) actDurIdx = index;
                    });
                    
                    if (dateIdx !== -1 && planWorkoutIdx !== -1) { 
                        break; 
                    }
                }
            }
        }

        if (dateIdx === -1) return [];

        // 2. Parse Rows
        const now = new Date();
        now.setHours(23, 59, 59, 999); 

        for (let line of lines) {
            if (!line.includes('|') || line.includes('---')) continue;
            
            const cols = line.split('|');
            if (cols.length < 5) continue;

            const cleanText = (str) => (str || "").trim().replace(/\*\*/g, '').replace(/__/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
            
            const rawDate = cols[dateIdx];
            const dateStr = cleanText(rawDate);
            const planStr = planWorkoutIdx > -1 ? cleanText(cols[planWorkoutIdx]) : "";
            const statusStr = statusIdx > -1 ? cleanText(cols[statusIdx]).toLowerCase() : "";
            
            const planDurStr = planDurIdx > -1 ? cleanText(cols[planDurIdx]) : "";
            const actDurStr = actDurIdx > -1 ? cleanText(cols[actDurIdx]) : "";
            const actualWorkoutStr = actWorkoutIdx > -1 ? cleanText(cols[actWorkoutIdx]) : "";

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

            if (date && !isNaN(date.getTime()) && date <= now) {
                const type = this._getType(planStr);
                const actualType = this._getType(actualWorkoutStr);

                data.push({
                    date: date,
                    type: type,
                    actualType: actualType,
                    completed: statusStr.match(/completed|done|yes|x/),
                    plannedDuration: this._parseTime(planDurStr),
                    actualDuration: this._parseTime(actDurStr)
                });
            }
        }
        return data;
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
