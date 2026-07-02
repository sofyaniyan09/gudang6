const fs = require('fs');
let code = fs.readFileSync('src/dashboard.js', 'utf-8');

const oldLogic = `    // Hitung berdasarkan item (baris data) yang diinspeksi per hari
    if (allData) {
        allData.forEach(item => {
            if (item.status_inspeksi && item.status_inspeksi !== 'Menunggu Inspeksi' && item.status_inspeksi !== '-') {
                const dateStr = item.tanggal_inspeksi ? item.tanggal_inspeksi : item.created_at;
                if (!dateStr) return;
                const d = new Date(dateStr);
                d.setHours(0,0,0,0);
                const diffTime = today.getTime() - d.getTime();
                let diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
                if (diffDays < 0) diffDays = 0;
                
                const bucket = buckets.find(b => diffDays >= b.endOffset && diffDays <= b.startOffset);
                if (bucket) {
                    bucket.selesai++;
                }
            }
        });
    }`;

const newLogic = `    // Tampilkan semua kontainer yang valid
    const updatedContainers = Object.values(containerMap).filter(c => 
        c.totalItems > 0 && c.latestUpdate
    );

    updatedContainers.forEach(c => {
        const d = new Date(c.latestUpdate);
        d.setHours(0,0,0,0);
        const diffTime = today.getTime() - d.getTime();
        let diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
        if (diffDays < 0) diffDays = 0; // Catch timezone/future dates into today's bucket
        
        const bucket = buckets.find(b => diffDays >= b.endOffset && diffDays <= b.startOffset);
        // Count ONLY if the container is fully inspected (100% completed)
        if (bucket && c.inspectedItems > 0 && c.inspectedItems === c.totalItems) {
            bucket.selesai++;
        }
    });`;

code = code.replace(oldLogic, newLogic);
code = code.replace('renderBarChart(containerMap, allData);', 'renderBarChart(containerMap);');
code = code.replace('function renderBarChart(containerMap, allData) {', 'function renderBarChart(containerMap) {');

fs.writeFileSync('src/dashboard.js', code);
console.log("Patched dashboard.js back to container mode");
