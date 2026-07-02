const fs = require('fs');
let code = fs.readFileSync('src/dashboard.js', 'utf-8');

const oldRenderBar = `function renderBarChart(containerMap) {
    const chartContainer = document.getElementById('daily-completion-chart');
    if (!chartContainer) return;
    
    // Tampilkan semua kontainer yang valid
    const updatedContainers = Object.values(containerMap).filter(c => 
        c.totalItems > 0 && c.latestUpdate
    );

    const today = new Date();
    today.setHours(0,0,0,0);
    
    let buckets = [];
    // 7 Hari Terakhir
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const label = i === 0 ? 'Hari ini' : days[d.getDay()];
        buckets.push({ label, selesai: 0, startOffset: i, endOffset: i });
    }

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
    });

    // Cari nilai tertinggi untuk skala chart (minimal 5 agar garis tidak terlalu di bawah)
    const maxCount = Math.max(...buckets.map(b => b.selesai), 5);
    
    // Build SVG Line Chart
    const w = 400;
    const h = 130;
    const paddingX = 25; 
    const xStep = (w - paddingX * 2) / (buckets.length - 1);
    
    let points = [];
    buckets.forEach((b, i) => {
        const x = paddingX + i * xStep;
        const y = h - (b.selesai / maxCount) * (h - 40); 
        points.push({x, y, label: b.label, val: b.selesai});
    });`;

const newRenderBar = `function renderBarChart(containerMap, allData) {
    const chartContainer = document.getElementById('daily-completion-chart');
    if (!chartContainer) return;

    const today = new Date();
    today.setHours(0,0,0,0);
    
    let buckets = [];
    // 7 Hari Terakhir
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const label = i === 0 ? 'Hari ini' : days[d.getDay()];
        buckets.push({ label, selesai: 0, startOffset: i, endOffset: i });
    }

    // Hitung berdasarkan item (baris data) yang diinspeksi per hari
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
    }

    // Cari nilai tertinggi untuk skala chart (minimal 5 agar garis tidak terlalu di bawah)
    const maxCount = Math.max(...buckets.map(b => b.selesai), 5);
    
    // Build SVG Line Chart
    const w = 400;
    const h = 130;
    const paddingX = 25; 
    const xStep = (w - paddingX * 2) / (buckets.length - 1);
    
    let points = [];
    buckets.forEach((b, i) => {
        const x = paddingX + i * xStep;
        const y = h - (b.selesai / maxCount) * (h - 40); 
        points.push({x, y, label: b.label, val: b.selesai});
    });`;

code = code.replace(oldRenderBar, newRenderBar);
code = code.replace('renderBarChart(containerMap);', 'renderBarChart(containerMap, allData);');

fs.writeFileSync('src/dashboard.js', code);
console.log("Patched successfully");
