// js/parser.js
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
            return Math.round(val);
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
        // ... (Paste the full parseTrainingLog function from your latest code here) ...
        // For brevity, I am not repeating the full regex logic, but copy it exactly as you have it.
        // Ensure you include the full logic you just tested.
        
        // Quick Placeholder for the logic you have:
        let sectionName = "Appendix C: Training History Log";
        let section = this.getSection(md, sectionName);
        if (!section) {
             sectionName = "Training History";
             section = this.getSection(md, sectionName);
        }
        if (!section) return [];

        const lines = section.split('\n');
        let dateIdx = -1, statusIdx = -1, planWorkoutIdx = -1, planDurIdx = -1, actWorkoutIdx = -1, actDurIdx = -1;
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
                    if (dateIdx !== -1) break; 
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
            
            // Date Parsing Logic
            let date = null;
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
                const planStr = planWorkoutIdx > -1 ? cleanText(cols[planWorkoutIdx]) : "";
                const actStr = actWorkoutIdx > -1 ? cleanText(cols[actWorkoutIdx]) : "";
                const statusStr = statusIdx > -1 ? cleanText(cols[statusIdx]).toLowerCase() : "";
                
                data.push({
                    date: date,
                    type: this._getType(planStr),
                    actualType: this._getType(actStr),
                    completed: statusStr.match(/completed|done|yes|x/),
                    plannedDuration: this._parseTime(planDurIdx > -1 ? cleanText(cols[planDurIdx]) : ""),
                    actualDuration: this._parseTime(actDurIdx > -1 ? cleanText(cols[actDurIdx]) : "")
                });
            }
        }
        return data;
    },

    parseGearMatrix(md) {
        // ... (Copy the parseGearMatrix function from your code) ...
        const results = { bike: [], run: [] };
        // (Existing logic)
        return results;
    }
};
