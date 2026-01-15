// js/views/zones/logic.js
import { extractFrontMatter } from './config.js'; // Ensure you have this helper or regex

export const getZonesLogic = (planMd, recordsJson) => {
    // 1. Parse Front Matter for FTP/LTHR
    const frontMatter = {};
    const fmRegex = /^---\n([\s\S]*?)\n---/;
    const match = planMd.match(fmRegex);
    if (match) {
        match[1].split('\n').forEach(line => {
            const [k, v] = line.split(':');
            if (k && v) frontMatter[k.trim()] = v.trim().replace(/"/g, '');
        });
    }

    const ftp = parseInt(frontMatter.ftp || 250);
    const weight = parseInt(frontMatter.weight || 75);
    const lthr = parseInt(frontMatter.lthr || 170); // Run LTHR
    const maxHr = parseInt(frontMatter.max_hr || 190);

    // 2. Parse Records for Pacing Chart
    let runPacing = [];
    if (recordsJson) {
        // We look for specific distances
        const targetDists = ['1 km', '1 Mile', '5 km', '10 km', 'Half Marathon', 'Marathon'];
        
        // Flatten the records
        const allRecs = [];
        const findRecs = (obj) => {
            if (obj.typeId && obj.value) allRecs.push(obj);
            else if (typeof obj === 'object') Object.values(obj).forEach(findRecs);
        };
        findRecs(recordsJson);

        // Map IDs to Names (Reuse map from python script logic effectively)
        const idMap = { 1:'1 km', 2:'1 Mile', 3:'5 km', 4:'10 km', 5:'Half Marathon', 6:'Marathon' };

        runPacing = targetDists.map(distName => {
            // Find record matching name or ID
            const rec = allRecs.find(r => {
                const name = r.typeKey ? r.typeKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
                return name === distName || idMap[r.typeId] === distName;
            });

            if (!rec || !rec.value) return null;

            // Calculate Pace (min/km)
            // Value is seconds. 
            // Distance needs to be known in km.
            let distKm = 0;
            if (distName === '1 km') distKm = 1;
            if (distName === '1 Mile') distKm = 1.609;
            if (distName === '5 km') distKm = 5;
            if (distName === '10 km') distKm = 10;
            if (distName === 'Half Marathon') distKm = 21.0975;
            if (distName === 'Marathon') distKm = 42.195;

            const totalMins = rec.value / 60;
            const paceDec = totalMins / distKm; // min per km
            
            return {
                label: distName,
                pace: paceDec // decimal minutes
            };
        }).filter(Boolean);
    }

    return {
        ftp,
        weight,
        wkg: (ftp / weight).toFixed(2),
        lthr,
        maxHr,
        runPacing // Pass this to components
    };
};
