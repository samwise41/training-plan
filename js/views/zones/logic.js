// js/views/zones/logic.js
import { extractFrontMatter } from './config.js'; 

export const getZonesLogic = (planMd, recordsJson) => {
    // 1. Parse Front Matter for FTP/LTHR
    const frontMatter = {};
    const fmRegex = /^---\n([\s\S]*?)\n---/;
    const match = planMd ? planMd.match(fmRegex) : null;
    
    if (match) {
        match[1].split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const k = parts[0].trim();
                const v = parts.slice(1).join(':').trim().replace(/"/g, '');
                frontMatter[k] = v;
            }
        });
    }

    const ftp = parseInt(frontMatter.ftp || 250);
    const weight = parseInt(frontMatter.weight || 75);
    const lthr = parseInt(frontMatter.lthr || 170); 
    const maxHr = parseInt(frontMatter.max_hr || 190);

    // 2. Parse Records for Pacing Chart
    let runPacing = [];
    
    // --- SAFETY CHECK: Only process if valid object ---
    if (recordsJson && typeof recordsJson === 'object') {
        const targetDists = ['1 km', '1 Mile', '5 km', '10 km', 'Half Marathon', 'Marathon'];
        const idMap = { 1:'1 km', 2:'1 Mile', 3:'5 km', 4:'10 km', 5:'Half Marathon', 6:'Marathon' };
        
        const allRecs = [];
        const findRecs = (obj) => {
            if (!obj || typeof obj !== 'object') return; // <--- PREVENTS CRASH
            if (obj.typeId && obj.value) {
                allRecs.push(obj);
            } else {
                Object.values(obj).forEach(findRecs);
            }
        };
        
        try {
            findRecs(recordsJson);

            runPacing = targetDists.map(distName => {
                const rec = allRecs.find(r => {
                    const name = r.typeKey ? r.typeKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
                    return name === distName || idMap[r.typeId] === distName;
                });

                if (!rec || !rec.value) return null;

                let distKm = 1;
                if (distName === '1 Mile') distKm = 1.609;
                if (distName === '5 km') distKm = 5;
                if (distName === '10 km') distKm = 10;
                if (distName === 'Half Marathon') distKm = 21.0975;
                if (distName === 'Marathon') distKm = 42.195;

                const totalMins = rec.value / 60;
                const paceDec = totalMins / distKm; 
                
                return { label: distName, pace: paceDec };
            }).filter(Boolean);
        } catch (e) {
            console.warn("Error parsing pacing data", e);
        }
    }

    return {
        ftp,
        weight,
        wkg: (ftp / weight).toFixed(2),
        lthr,
        maxHr,
        runPacing
    };
};
