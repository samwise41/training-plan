// 2. Parse Rows (Safe Version)
for (let line of lines) {
    if (!line.includes('|') || line.includes('---')) continue;
    const cols = line.split('|');
    if (cols.length < 3) continue; 

    const cleanText = (str) => (str || "").trim().replace(/\*\*/g, '').replace(/__/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
    
    // Helper to safely get column data even if indices are missing
    const getCol = (idx) => {
        if (idx === -1 || idx >= cols.length) return "";
        return cleanText(cols[idx]);
    };

    const dateStr = getCol(dateIdx);
    if (!dateStr || dateStr.toLowerCase().includes('date')) continue;

    // ... (rest of your existing parsing logic) ...

    data.push({
        // ... (rest of your object properties) ...
        trainingEffectLabel: getCol(teLabelIdx) // Now safe even if index is -1
    });
}
