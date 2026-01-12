// js/views/gear/logic.js

export function updateGearUI(gearData) {
    if (!gearData) return;
    
    const tempSelect = document.getElementById('gear-temp');
    if (!tempSelect) return;
    const temp = parseInt(tempSelect.value);
    
    const processActivity = (activity, prefixBase) => {
        const list = gearData[activity] || [];
        const findMatch = (t) => {
            const match = list.find(r => {
                if (r.min === -999) return t < r.max;
                if (r.max === 999) return t >= r.min;
                return t >= r.min && t <= r.max;
            });
            return match || { upper: "—", lower: "—", extremities: "—" };
        };

        const standard = findMatch(temp);
        const weather = findMatch(temp - 10);

        const updateUI = (prefix, data) => {
            const u = document.getElementById(`${prefix}-upper`);
            const l = document.getElementById(`${prefix}-lower`);
            const e = document.getElementById(`${prefix}-extremities`);
            if (u) u.innerHTML = data.upper;
            if (l) l.innerHTML = data.lower;
            if (e) e.innerHTML = data.extremities;
        };

        updateUI(`${prefixBase}-standard`, standard);
        updateUI(`${prefixBase}-weather`, weather);
    };

    processActivity('bike', 'bike');
    processActivity('run', 'run');
}
