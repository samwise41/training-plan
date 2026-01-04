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
        // REMOVED: const now = new Date(); ... (No longer needed for filtering)

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

            // MODIFIED: Removed "&& date <= now" to allow future planned workouts
            if (date && !isNaN(date.getTime())) {
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
