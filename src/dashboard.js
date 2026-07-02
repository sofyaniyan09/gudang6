import { supabase } from './supabaseClient.js';
import { requireAuth } from './auth.js';

let globalContainerMap = null;
// Ensure a global fallback for accidental references from other scripts
window.allData = window.allData || [];

async function initDashboard() {
    await requireAuth();
    loadOngoingUpdates();
    setupRealtimeSubscription();
}

function parseLocalDate(dateString) {
    if (!dateString) return null;
    const cleanStr = dateString.replace(/(Z|\+00:00|\+00)$/i, '');
    return new Date(cleanStr);
}

let realtimeChannel = null;
function setupRealtimeSubscription() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }
    realtimeChannel = supabase.channel('dashboard-updates')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'penerimaan_kapal' },
            (payload) => {
                loadOngoingUpdates();
            }
        )
        .subscribe();
}

async function loadOngoingUpdates() {
    const listContainer = document.getElementById('ongoing-updates-list');
    if (!listContainer) return;

    let allData = [];

    try {
    let hasMore = true;
    let from = 0;
    const limit = 1000;

    while (hasMore) {
        const { data, error } = await supabase
            .from('penerimaan_kapal')
            .select('nama_file, nomor_kontainer, status_inspeksi, tanggal_inspeksi, created_at')
            .range(from, from + limit - 1);

        if (error) {
            listContainer.innerHTML = `<div class="p-4 text-center text-error">Gagal memuat data: ${error.message || error.code || 'Unknown'}</div>`;
            return;
        }


        if (data && data.length > 0) {
            allData = allData.concat(data);
            from += limit;
            if (data.length < limit) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    } catch (err) {
        listContainer.innerHTML = `<div class="p-4 text-center text-error">Gagal memuat data: ${err && err.message ? err.message : String(err)}</div>`;
        return;
    }

    if (allData.length === 0) {
        listContainer.innerHTML = `<div class="p-8 text-center text-on-surface-variant">Belum ada data kapal.</div>`;
        updateStats([]);
        renderBarChart({});
        renderPieChart({});
        return;
    }


    const containerMap = {};

    allData.forEach(item => {
        const file = item.nama_file || 'Tanpa File';
        const noKontainer = item.nomor_kontainer || 'Tanpa Kontainer';
        const key = `${file}_${noKontainer}`;

        if (!containerMap[key]) {
            containerMap[key] = {
                file: file,
                kontainer: noKontainer,
                totalItems: 0,
                inspectedItems: 0,
                latestUpdate: null
            };
        }

        containerMap[key].totalItems++;
        
        // Fallback ke created_at jika belum ada latestUpdate
        if (item.created_at) {
            const createDate = new Date(item.created_at);
            if (!containerMap[key].latestUpdate || createDate > containerMap[key].latestUpdate) {
                containerMap[key].latestUpdate = createDate;
            }
        }

        if (item.status_inspeksi && item.status_inspeksi !== 'Menunggu Inspeksi' && item.status_inspeksi !== '-') {
            containerMap[key].inspectedItems++;
            if (item.tanggal_inspeksi) {
                const itemDate = parseLocalDate(item.tanggal_inspeksi);
                if (!containerMap[key].latestUpdate || itemDate > containerMap[key].latestUpdate) {
                    containerMap[key].latestUpdate = itemDate;
                }
            }
        }
    });

    globalContainerMap = containerMap;
    
    updateStats(allData);
    renderBarChart(containerMap);
    renderPieChart(containerMap);

    const ongoingContainers = Object.values(containerMap)
        .filter(c => c.inspectedItems > 0 && c.inspectedItems < c.totalItems)
        .sort((a, b) => {
            const progA = a.inspectedItems / a.totalItems;
            const progB = b.inspectedItems / b.totalItems;
            return progB - progA; 
        });

    if (ongoingContainers.length === 0) {
        listContainer.innerHTML = `<div class="p-8 text-center text-on-surface-variant">Tidak ada kontainer yang sedang di-update.</div>`;
        return;
    }

    listContainer.innerHTML = '';
    ongoingContainers.forEach(c => {
        const percentage = Math.round((c.inspectedItems / c.totalItems) * 100);
        let statusBadge = '';
        if (percentage === 100) {
            statusBadge = `<span class="px-3 py-1 bg-green-500/10 text-green-500 font-label-sm text-label-sm rounded-full flex items-center gap-1.5 border border-green-500/20"><span class="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_4px_#22c55e]"></span> Selesai</span>`;
        } else {
            statusBadge = `<span class="px-3 py-1 bg-orange-500/10 text-orange-500 font-label-sm text-label-sm rounded-full flex items-center gap-1.5 border border-orange-500/20"><span class="w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_4px_#f97316]"></span> Updating</span>`;
        }

        let timeStr = '';
        if (c.latestUpdate) {
            timeStr = c.latestUpdate.toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric', 
                hour: '2-digit', minute: '2-digit'
            });
        }

        const itemHtml = `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between p-4 px-6 border-b border-white/5 hover:bg-surface-container-lowest/50 transition-colors cursor-pointer group gap-6" onclick="window.location.href='kelola_kapal.html?file=${encodeURIComponent(c.file)}&container=${encodeURIComponent(c.kontainer)}'">
                <div class="flex items-center gap-4 shrink-0 w-full md:w-[280px]">
                    <div class="w-10 h-10 rounded-full bg-surface-container-highest/50 text-on-surface flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-[18px]">${percentage === 100 ? 'inventory_2' : 'package_2'}</span>
                    </div>
                    <div class="min-w-0">
                        <h4 class="text-sm font-semibold text-on-surface truncate">${c.kontainer}</h4>
                        <p class="text-xs text-on-surface-variant truncate mt-0.5">${c.file}</p>
                        ${timeStr ? `<p class="text-[10px] text-on-surface-variant flex items-center gap-1 mt-1"><span class="material-symbols-outlined text-[12px]">schedule</span>Terakhir update: ${timeStr}</p>` : ''}
                    </div>
                </div>
                <div class="flex-1 w-full max-w-md mt-2 md:mt-0">
                    <div class="flex justify-between mb-1.5 items-end">
                        <span class="text-xs text-on-surface-variant">Progress (${c.inspectedItems}/${c.totalItems} barang)</span>
                        <span class="text-xs font-bold text-on-surface">${percentage}%</span>
                    </div>
                    <div class="w-full bg-surface-container-highest/30 rounded-full h-1 overflow-hidden">
                        <div class="${percentage === 100 ? 'bg-green-500' : 'bg-primary'} h-1 rounded-full transition-all duration-1000" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <div class="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0">
                    ${statusBadge}
                    <button class="text-secondary text-sm hover:text-primary transition-colors">Details</button>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
}

// Removed setupChartToggle as the chart is now strictly weekly

function renderBarChart(containerMap) {
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

    // Tampilkan semua kontainer yang valid
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
    });

    // Cari nilai tertinggi untuk skala chart (minimal 5 agar garis tidak terlalu di bawah)
    const maxCount = Math.max(...buckets.map(b => b.selesai), 5);
    
    // Build SVG Line Chart
    const w = 400;
    const h = 260; // Ditinggikan lagi untuk mengisi ruang kosong
    const paddingX = 25; 
    const xStep = (w - paddingX * 2) / (buckets.length - 1);
    
    let points = [];
    buckets.forEach((b, i) => {
        const x = paddingX + i * xStep;
        // Gunakan h - 20 agar puncak chart bisa lebih dekat dengan tepi atas (mengurangi ruang kosong)
        const y = h - (b.selesai / maxCount) * (h - 20); 
        points.push({x, y, label: b.label, val: b.selesai});
    });
    
    const pathD = "M " + points.map(p => `${p.x} ${p.y}`).join(" L ");
    const areaPathD = pathD + ` L ${points[points.length-1].x} ${h} L ${points[0].x} ${h} Z`;
    
    const circles = points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#10131b" stroke="#10b981" stroke-width="2.5" class="cursor-pointer transition-all duration-300 hover:r-6 hover:fill-[#10b981]">
            <title>${p.label}: ${p.val} Kontainer Diupdate</title>
        </circle>
    `).join('');
    
    // Value labels above the dots (font diperbesar menjadi 18)
    const valueLabelsSVG = points.map(p => `
        <text x="${p.x}" y="${p.y - 14}" fill="#f3f4f6" font-size="18" font-weight="700" text-anchor="middle" class="font-sans drop-shadow-md tracking-wide">${p.val}</text>
    `).join('');

    // X-Axis labels inside SVG for perfect alignment (font diperbesar menjadi 14)
    const labelsSVG = points.map(p => `
        <text x="${p.x}" y="${h + 22}" fill="#9ca3af" font-size="14" font-weight="500" text-anchor="middle" class="font-sans tracking-wide">${p.label}</text>
    `).join('');

    // HTML Structure
    const html = `
    <div class="w-full relative bg-surface-container-lowest/20 rounded-2xl p-4 shadow-lg border border-white/5 flex flex-col justify-center min-h-[280px] h-full">
        <div class="relative w-full mt-1 flex-grow flex items-center">
            <!-- SVG drawing -->
            <svg viewBox="0 0 ${w} ${h + 25}" class="w-full h-full overflow-visible drop-shadow-md z-10 relative">
                <defs>
                    <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
                        <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
                    </linearGradient>
                </defs>
                <path d="${areaPathD}" fill="url(#chart-gradient)" stroke="none" />
                <path d="${pathD}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round" />
                ${circles}
                ${valueLabelsSVG}
                ${labelsSVG}
            </svg>
        </div>
            
            <!-- Bottom Thick Border/Indicator -->
            <div class="absolute -bottom-2 left-[15px] right-[15px] h-[3px] bg-[#10b981]/40 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.2)] z-0"></div>
        </div>
    </div>
    `;

    chartContainer.innerHTML = html;
    chartContainer.className = "w-full max-w-[450px] mx-auto mt-2"; // Update classes for a clean layout
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

document.addEventListener('app:pageLoaded', (e) => {
    if (window.location.pathname.endsWith('dashboard.html') || window.location.pathname.endsWith('staff_dashboard.html') || window.location.pathname === '/') {
        initDashboard();
    }
});

function renderPieChart(containerMap) {
    const wrapper = document.getElementById('pie-chart-wrapper');
    if (!wrapper) return;

    let selesai = 0, onProses = 0, belumDiupdate = 0;
    const containers = Object.values(containerMap);
    const total = containers.length;

    containers.forEach(c => {
        if (c.inspectedItems === 0) belumDiupdate++;
        else if (c.inspectedItems === c.totalItems) selesai++;
        else onProses++;
    });

    if (total === 0) {
        wrapper.innerHTML = `<div class="text-xs text-on-surface-variant">Belum ada data kontainer.</div>`;
        return;
    }

    const data = [
        { label: "Selesai", val: selesai, color: "#22c55e" },
        { label: "On Proses", val: onProses, color: "#f97316" },
        { label: "Belum Diupdate", val: belumDiupdate, color: "#3e90ff" }
    ];

    let currentAngle = -Math.PI / 2; // Start at 12 o'clock
    data.forEach(d => {
        d.startAngle = currentAngle;
        const sliceAngle = (d.val / total) * (Math.PI * 2);
        d.endAngle = currentAngle + sliceAngle;
        d.midAngle = currentAngle + sliceAngle / 2;
        currentAngle += sliceAngle;
        d.pct = Math.round((d.val / total) * 100);
    });

    const cx = 170, cy = 105;
    const R = 95, r = 55; 

    const getDonutPath = (startA, endA) => {
        if (endA - startA >= Math.PI * 2 - 0.001) {
            return `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx} ${cy + R} A ${R} ${R} 0 1 1 ${cx} ${cy - R} Z 
                    M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`;
        }
        const x1 = cx + R * Math.cos(startA), y1 = cy + R * Math.sin(startA);
        const x2 = cx + R * Math.cos(endA),   y2 = cy + R * Math.sin(endA);
        const x3 = cx + r * Math.cos(endA),   y3 = cy + r * Math.sin(endA);
        const x4 = cx + r * Math.cos(startA), y4 = cy + r * Math.sin(startA);
        const largeArc = endA - startA <= Math.PI ? "0" : "1";
        
        return `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    };

    let svg = `
    <style>
        .donut-slice { transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s ease; transform-origin: ${cx}px ${cy}px; cursor: pointer; }
        .donut-slice:hover { transform: scale(1.05); filter: drop-shadow(0 12px 20px rgba(0,0,0,0.5)); z-index: 10; }
    </style>
    <svg viewBox="0 0 340 220" class="w-full" style="max-height: 250px; overflow:visible;">`;
    
    // Group for slices
    svg += `<g id="donut-slices-group">`;
    data.forEach(d => {
        if (d.val === 0) return;
        svg += `<path class="donut-slice" d="${getDonutPath(d.startAngle, d.endAngle)}" fill="${d.color}" />`;
    });
    svg += `</g>`;

    // Group for slice percentage text (drawn on top of slices, pointer-events none so hover works on path)
    svg += `<g pointer-events="none">`;
    const textRadius = (R + r) / 2;
    data.forEach(d => {
        if (d.val === 0 || d.pct < 5) return; // Hide text if slice is too small
        const textX = cx + textRadius * Math.cos(d.midAngle);
        const textY = cy + textRadius * Math.sin(d.midAngle);
        // Tampilkan angka aktual alih-alih persentase
        svg += `<text x="${textX}" y="${textY + 5}" fill="#ffffff" font-size="18" font-weight="600" text-anchor="middle" class="font-sans drop-shadow-md">${d.val}</text>`;
    });
    svg += `</g>`;

    // Center Text
    svg += `
        <g pointer-events="none">
            <text x="${cx}" y="${cy - 2}" fill="#ffffff" font-size="36" font-weight="bold" text-anchor="middle" class="font-sans drop-shadow-md">${total}</text>
            <text x="${cx}" y="${cy + 20}" fill="#9ca3af" font-size="14" font-weight="700" text-anchor="middle" class="font-sans tracking-widest drop-shadow-md">OVERALL</text>
        </g>
    `;

    svg += `</svg>`;

    // Build the legend in HTML with inline styles to guarantee it looks correct without JIT compilation
    let html = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">`;
    html += svg; // The SVG Chart
    
    html += `<div style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 16px; width: 100%;">`;
    
    data.forEach(d => {
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 160px; padding: 2px 0;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="width: 14px; height: 14px; border-radius: 4px; background-color: ${d.color}; flex-shrink: 0;"></span>
                    <span style="color: #c0c6d6; font-size: 15px; font-weight: 500; letter-spacing: 0.025em; font-family: sans-serif;">${d.label}</span>
                </div>
                <span style="color: #e0e2ed; font-size: 15px; font-weight: bold; font-family: sans-serif;">${d.val}</span>
            </div>
        `;
    });

    html += `</div></div>`;

    wrapper.innerHTML = html;

    // Attach event listeners to bring hovered slice to front to prevent clipping
    const slicesGroup = wrapper.querySelector('#donut-slices-group');
    const slices = wrapper.querySelectorAll('.donut-slice');
    slices.forEach(slice => {
        slice.addEventListener('mouseenter', function() {
            slicesGroup.appendChild(this);
        });
    });
}

async function updateStats(allData = []) {
    // 1. Total Ships = unique 'nama_file'
    const uniqueFiles = new Set(allData.map(item => item.nama_file).filter(Boolean));
    const totalShipsEl = document.getElementById('total-ships-count');
    if (totalShipsEl) {
        totalShipsEl.textContent = uniqueFiles.size;
    }

    // 2. Active Users = count of 'profiles' table
    const activeUsersEl = document.getElementById('active-users-count');
    if (activeUsersEl) {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
            
        if (!error && count !== null) {
            activeUsersEl.textContent = count;
        } else {
            activeUsersEl.textContent = '-';
        }
    }
}
