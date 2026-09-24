import { supabase } from './supabaseClient.js';
import { requireAuth, logout } from './auth.js';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
let currentFile = null;
let currentCleanFileName = null;
let currentContainer = null;
let allFileData = []; 


function parseLocalDate(dateString) {
    if (!dateString) return null;
    const cleanStr = dateString.replace(/(Z|\+00:00|\+00)$/i, '');
    return new Date(cleanStr);
}

// Helper: Fetch ALL rows from Supabase (bypasses 1000-row default limit)
async function fetchAllRows(table, selectColumns, filters = {}) {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        let query = supabase.from(table)
            .select(selectColumns)
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        
        // Apply filters
        for (const [key, value] of Object.entries(filters)) {
            if (value === null) {
                query = query.not(key, 'is', null);
            } else {
                query = query.eq(key, value);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
            allData = allData.concat(data);
            from += PAGE_SIZE;
            // If we got fewer than PAGE_SIZE, we've reached the end
            if (data.length < PAGE_SIZE) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }

    return allData;
}

// Expose to window for inline onclick handlers
window.openContainer = openContainer;

// Helper for dynamically updating header titles
function updatePageTitle(mode) {
    const globalTitle = document.getElementById('global-header-title');
    const mobileTitle = document.getElementById('mobile-page-title');
    
    let htmlContent = '';
    let textContent = '';
    
    if (mode === 'files') {
        htmlContent = 'Kelola Data Kapal';
        textContent = 'Kelola Data Kapal';
    } else if (mode === 'containers') {
        htmlContent = `<span class="text-primary">${currentCleanFileName}</span>`;
        textContent = currentCleanFileName;
    } else if (mode === 'items') {
        htmlContent = `<span class="text-primary">${currentCleanFileName}</span> <span class="text-on-surface-variant mx-2">/</span> <span>${currentContainer}</span>`;
        textContent = `${currentCleanFileName} / ${currentContainer}`;
    }
    
    if (globalTitle) globalTitle.innerHTML = htmlContent;
    if (mobileTitle) mobileTitle.textContent = textContent;
}

let realtimeShipChannel = null;


function setupRealtime() {
    if (realtimeShipChannel) {
        supabase.removeChannel(realtimeShipChannel);
    }
    realtimeShipChannel = supabase.channel('kelolakapal-updates')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'penerimaan_kapal' },
            (payload) => {
                // Jika elemen utama tidak ada di DOM, berarti user sudah pindah halaman. Abaikan update.
                if (!document.getElementById('ship-table-body') && !document.getElementById('container-table-body')) {
                    return;
                }
                
                if (currentFile) {
                    openFile(currentFile);
                } else {
                    loadFiles();
                }
            }
        )
        .subscribe();
}

async function initKelolaKapal() {
    try {
        // 1. Verifikasi Login
        const currentUser = await requireAuth();
        if (!currentUser) return;
        
        // Mematikan realtime otomatis agar tidak merefresh tabel saat staf bekerja (sesuai permintaan user)
        // setupRealtime();

    // Views
    const viewFiles = document.getElementById('ship-table-body')?.closest('.glass-panel');
    const viewContainers = document.getElementById('view-containers');
    const viewItems = document.getElementById('view-items');

    // Logout event
    document.getElementById('btn-logout')?.addEventListener('click', logout);
    
    
    document.getElementById('btn-back-to-files')?.addEventListener('click', () => {
        if (typeof window.closeImagePreview === 'function') {
            window.closeImagePreview();
        }
        // Jika sedang di dalam halaman detail barang (Items view), kembali ke halaman kontainer
        if (viewItems && !viewItems.classList.contains('hidden')) {
            viewItems.classList.add('hidden');
            if (viewContainers) viewContainers.classList.remove('hidden');
            currentContainer = null;
            
            updatePageTitle('containers');
            return; // Jangan jalankan kode di bawah (yang mengembalikan ke daftar kapal)
        }

        // Jika sedang di halaman kontainer, kembali ke daftar kapal (Files view)
        if (viewContainers) viewContainers.classList.add('hidden');
        if (viewItems) viewItems.classList.add('hidden');
        if (viewFiles) viewFiles.classList.remove('hidden');
        currentFile = null;
        currentCleanFileName = null;
        currentContainer = null;
        
        updatePageTitle('files');

        document.getElementById('btn-back-to-files')?.classList.add('hidden');
        
        // Tampilkan kembali tombol upload excel
        document.getElementById('btn-upload-excel')?.classList.remove('hidden');
    });

    await loadFiles();

    // Cek URL params untuk auto-open file & kontainer
    const urlParams = new URLSearchParams(window.location.search);
    const fileParam = urlParams.get('file');
    const containerParam = urlParams.get('container');

    if (fileParam) {
        await openFile(fileParam);
        if (containerParam) {
            // Tunggu sebentar untuk memastikan DOM update
            setTimeout(() => {
                openContainer(containerParam);
            }, 100);
        }
    }

    // Fitur Search Global dari Appbar (Auto-Minimize & Auto-Expand)
    const appbarSearchInput = document.getElementById('appbar-search-input');
    if (appbarSearchInput) {
        const updateSearchStyle = () => {
            if (document.activeElement === appbarSearchInput || appbarSearchInput.value) {
                appbarSearchInput.classList.remove('w-9', 'bg-transparent', 'border-transparent', 'hover:bg-surface-container-high/50');
                appbarSearchInput.classList.add('w-32', 'sm:w-48', 'lg:w-64', 'bg-surface-container-high', 'border-outline-variant');
                appbarSearchInput.placeholder = 'Cari...';
            } else {
                appbarSearchInput.classList.add('w-9', 'bg-transparent', 'border-transparent', 'hover:bg-surface-container-high/50');
                appbarSearchInput.classList.remove('w-32', 'sm:w-48', 'lg:w-64', 'bg-surface-container-high', 'border-outline-variant');
                appbarSearchInput.placeholder = '';
            }
        };

        // Initialize style
        updateSearchStyle();

        appbarSearchInput.addEventListener('focus', updateSearchStyle);
        appbarSearchInput.addEventListener('blur', updateSearchStyle);
        appbarSearchInput.addEventListener('input', (e) => {
            updateSearchStyle();
            const keyword = e.target.value.toLowerCase();
            
            // Tentukan view mana yang sedang aktif
            const viewFiles = document.getElementById('ship-table-body')?.closest('.glass-panel');
            const viewContainers = document.getElementById('view-containers');
            const viewItems = document.getElementById('view-items');
            
            let activeTableBody = null;
            
            if (viewItems && !viewItems.classList.contains('hidden')) {
                activeTableBody = document.getElementById('table-body');
            } else if (viewContainers && !viewContainers.classList.contains('hidden')) {
                activeTableBody = document.getElementById('container-table-body');
            } else if (viewFiles && !viewFiles.classList.contains('hidden')) {
                activeTableBody = document.getElementById('ship-table-body');
            }
            
            if (activeTableBody) {
                const rows = activeTableBody.querySelectorAll('tr');
                rows.forEach(row => {
                    const textContent = row.textContent.toLowerCase();
                    if (textContent.includes(keyword)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }
        });
    }
    } catch (err) {
        const tableBody = document.getElementById('ship-table-body');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-error">Gagal memuat data: ${err && err.message ? err.message : String(err)}<br>Periksa Console (DevTools) untuk detail.</td></tr>`;
        } else {
            alert('Gagal memuat halaman Kelola Data Kapal. Periksa Console untuk detail.');
        }
    }
}

async function loadFiles() {
    const tableBody = document.getElementById('ship-table-body');
    if(!tableBody) return;

    try {
    
    // Ambil SEMUA nama file dari database - hanya kolom yang dibutuhkan
    const data = await fetchAllRows('penerimaan_kapal', 'nama_file, created_at, nomor_kontainer, status_inspeksi', { nama_file: null });


    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-on-surface-variant">Belum ada data kapal. Silakan Upload Excel Baru.</td></tr>`;
        return;
    }
    // Ekstrak nama file unik dan info lainnya
    const uniqueFilesMap = new Map();
    
    data.forEach(row => {
        if (!uniqueFilesMap.has(row.nama_file)) {
            uniqueFilesMap.set(row.nama_file, {
                nama_file: row.nama_file,
                count: 1,
                date: new Date(row.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
                containers: new Set([row.nomor_kontainer || 'Tanpa Kontainer']),
                inspectedCount: (row.status_inspeksi && row.status_inspeksi !== 'Menunggu Inspeksi' && row.status_inspeksi !== '-') ? 1 : 0
            });
        } else {
            const fileInfo = uniqueFilesMap.get(row.nama_file);
            fileInfo.count++;
            fileInfo.containers.add(row.nomor_kontainer || 'Tanpa Kontainer');
            if (row.status_inspeksi && row.status_inspeksi !== 'Menunggu Inspeksi' && row.status_inspeksi !== '-') {
                fileInfo.inspectedCount++;
            }
        }
    });

    const uniqueFiles = Array.from(uniqueFilesMap.values());

    tableBody.innerHTML = '';
    
    uniqueFiles.forEach((fileInfo, index) => {
        const containerCount = fileInfo.containers.size;
        const progressPercent = fileInfo.count > 0 ? Math.round((fileInfo.inspectedCount / fileInfo.count) * 100) : 0;
        
        let progressHtml = `
            <div class="flex flex-col gap-1.5 w-full max-w-[150px] mx-auto">
                <div class="flex justify-center items-center text-[12px] font-bold">
                    <span class="${progressPercent === 100 ? 'text-green-500' : (progressPercent > 0 ? 'text-orange-500' : 'text-gray-400')}">${progressPercent}%</span>
                </div>
                <div class="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
                    <div class="${progressPercent === 100 ? 'bg-green-500' : 'bg-orange-500'} h-full rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                </div>
            </div>`;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-surface-container-low transition-colors group cursor-pointer";
        tr.innerHTML = `
            <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-sm flex-shrink-0">
                        <span class="material-symbols-outlined text-[20px]">directions_boat</span>
                    </div>
                    <div class="text-left">
                        <p class="font-semibold text-on-surface group-hover:text-primary transition-colors">${fileInfo.nama_file.replace('.xlsx', '').replace('.xls', '')}</p>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4 text-center">
                <div class="flex flex-col items-center gap-1">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">
                        <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        ${fileInfo.count} Baris
                    </span>
                    <span class="text-[11px] text-on-surface-variant font-medium">${containerCount} Kontainer</span>
                </div>
            </td>
            <td class="py-3 px-4 text-center">
                ${progressHtml}
            </td>
            <td class="py-3 px-4 text-center text-on-surface-variant">${fileInfo.date}</td>
            <td class="py-2 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button class="btn-delete p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-full transition-colors" title="Hapus Data">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    <button class="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-full transition-colors" title="Buka Detail">
                        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                </div>
            </td>
        `;
        
        tr.addEventListener('click', () => openFile(fileInfo.nama_file));

        const deleteBtn = tr.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Mencegah baris ikut terklik (openFile)
            if (confirm(`Apakah Anda yakin ingin menghapus SELURUH data kapal "${fileInfo.nama_file}"?\n\nTindakan ini akan menghapus permanen ${fileInfo.count} baris data dari database dan tidak dapat dibatalkan.`)) {
                await deleteFile(fileInfo.nama_file);
            }
        });

        tableBody.appendChild(tr);
    });
    } catch (err) {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-error">Gagal memuat daftar file: ${err && err.message ? err.message : String(err)}</td></tr>`;
    }
}


async function deleteFile(fileName) {
    const tableBody = document.getElementById('ship-table-body');
    tableBody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-on-surface-variant"><span class="material-symbols-outlined animate-spin text-3xl text-primary mb-2 block">sync</span> Menghapus data besar (Tunggu sebentar)...</td></tr>`;

    let hasMoreData = true;
    let loopCount = 0;

    // Tambah limit loop hingga 50 (50.000 baris) agar bisa menghapus file raksasa
    while (hasMoreData && loopCount < 50) {
        loopCount++;
        // Hapus batch data dan minta Supabase mengembalikan jumlah yang terhapus
        const { data, error, count, status, statusText } = await supabase
            .from('penerimaan_kapal')
            .delete({ count: 'exact' })
            .eq('nama_file', fileName);

        if (error) {
            alert(`Gagal Hapus (Error Supabase):\nCode: ${error.code}\nMessage: ${error.message}\nDetails: ${error.details}\nHint: ${error.hint}`);
            break;
        }


        // Jika tidak ada lagi baris yang bisa dihapus oleh perintah delete, paksa berhenti
        if (count === 0) {
            alert(`PERHATIAN: Sistem mencoba menghapus data, tetapi database Supabase menolaknya secara diam-diam (0 baris terhapus).\n\nKemungkinan besar tabel 'penerimaan_kapal' di Supabase Anda TIDAK MEMILIKI "Primary Key" (Kolom ID). Database tidak mengizinkan penghapusan jika tidak ada Primary Key.`);
            hasMoreData = false;
            break;
        }

        // Cek apakah masih ada sisa baris
        const { data: checkData } = await supabase
            .from('penerimaan_kapal')
            .select('nama_file')
            .eq('nama_file', fileName)
            .limit(1);

        if (!checkData || checkData.length === 0) {
            hasMoreData = false; 
        }
    }

    // Refresh tabel
    await loadFiles();
}

async function openFile(fileName) {
    try {
        currentFile = fileName;
        currentCleanFileName = fileName.replace('.xlsx', '').replace('.xls', '');
        
        updatePageTitle('containers');
        
        // Transisi UI
        const viewFiles = document.getElementById('ship-table-body')?.closest('.glass-panel');
        viewFiles?.classList.add('hidden');
        
        const viewContainers = document.getElementById('view-containers');
        viewContainers?.classList.remove('hidden');
        
        document.getElementById('btn-back-to-files')?.classList.remove('hidden');
        
        const viewItems = document.getElementById('view-items');
        viewItems?.classList.add('hidden');
        
        // Sembunyikan tombol upload excel di sub-halaman
        document.getElementById('btn-upload-excel')?.classList.add('hidden');
        
        const containerTableBody = document.getElementById('container-table-body');
        if (!containerTableBody) return; // Exit silently if DOM is gone
        containerTableBody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-on-surface-variant"><span class="material-symbols-outlined animate-spin text-primary text-4xl block mb-2">sync</span> Memuat kontainer...</td></tr>`;

    // FASE 1: Ambil HANYA kolom ringan untuk daftar kontainer (sangat cepat)
    const lightData = await fetchAllRows(
        'penerimaan_kapal', 
        'nomor_kontainer, status_inspeksi, tanggal_inspeksi', 
        { nama_file: fileName }
    );


    // Kelompokkan per kontainer
    const containerSummary = new Map();
    lightData.forEach(row => {
        const cid = row.nomor_kontainer || 'Tanpa Kontainer';
        if (!containerSummary.has(cid)) {
            containerSummary.set(cid, { total: 0, inspected: 0, latest_date: null });
        }
        const s = containerSummary.get(cid);
        s.total++;
        if (row.status_inspeksi && row.status_inspeksi !== 'Menunggu Inspeksi' && row.status_inspeksi !== '-') {
            s.inspected++;
            if (row.tanggal_inspeksi) {
                const rowDate = parseLocalDate(row.tanggal_inspeksi);
                if (!s.latest_date || rowDate > s.latest_date) {
                    s.latest_date = rowDate;
                }
            }
        }
    });

    let uniqueContainers = Array.from(containerSummary.keys());

    // Sort containers: 100% completed at the top, ordered by latest date
    uniqueContainers.sort((a, b) => {
        const infoA = containerSummary.get(a);
        const infoB = containerSummary.get(b);
        const progA = infoA.total > 0 ? (infoA.inspected / infoA.total) : 0;
        const progB = infoB.total > 0 ? (infoB.inspected / infoB.total) : 0;

        const isA100 = progA === 1;
        const isB100 = progB === 1;

        if (isA100 && !isB100) return -1;
        if (!isA100 && isB100) return 1;
        if (isA100 && isB100) {
            const dateA = infoA.latest_date ? infoA.latest_date.getTime() : 0;
            const dateB = infoB.latest_date ? infoB.latest_date.getTime() : 0;
            return dateB - dateA; // Descending (latest first)
        }
        return 0; // Default order for others
    });

    // Variabel untuk menghitung statistik Bento Grid
    let totalSelesai = 0;
    let totalProses = 0;
    let totalSisa = 0;

    containerTableBody.innerHTML = '';
    uniqueContainers.forEach(containerId => {
        const info = containerSummary.get(containerId);
        const itemCount = info.total;
        const inspectedCount = info.inspected;
        const progressPercent = itemCount > 0 ? Math.round((inspectedCount / itemCount) * 100) : 0;
        
        let dateStr = '';
        if (progressPercent > 0 && info.latest_date) {
            dateStr = new Date(info.latest_date).toLocaleString('id-ID', {
                                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        }
        
        let statusBadge = '';
        let progressHtml = '';
        
        if (progressPercent === 100) {
            totalSelesai++;
            statusBadge = `<div class="flex flex-col items-center"><span class="status-badge bg-green-500/20 text-green-400 border border-green-500/30">Selesai (100%)</span><span class="text-[10px] text-on-surface-variant mt-1.5">${dateStr}</span></div>`;
        } else if (progressPercent > 0) {
            totalProses++;
            statusBadge = `<div class="flex flex-col items-center"><span class="status-badge bg-orange-500/20 text-orange-400 border border-orange-500/30">On Proses (${progressPercent}%)</span><span class="text-[10px] text-on-surface-variant mt-1.5">${dateStr}</span></div>`;
        } else {
            totalSisa++;
            statusBadge = `<div class="flex flex-col items-center"><span class="status-badge bg-gray-500/20 text-gray-400 border border-gray-500/30">Belum Diupdate</span></div>`;
        }

        progressHtml = `
            <div class="flex flex-col gap-1.5">
                <div class="flex justify-between items-center text-[11px] font-bold"><span class="text-primary">${progressPercent}%</span></div>
                <div class="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
                    <div class="bg-primary h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,122,255,0.4)]" style="width: ${progressPercent}%"></div>
                </div>
            </div>`;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-surface-container-low/50 transition-colors group cursor-pointer";
        tr.setAttribute('data-progress', progressPercent.toString());
        
        tr.innerHTML = `
            <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span class="material-symbols-outlined text-primary">inventory_2</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-body-md font-bold">${containerId}</span>
                        <span class="text-[11px] text-on-surface-variant">${itemCount} Item</span>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3 text-center">
                ${statusBadge}
            </td>
            <td class="px-4 py-3">
                ${progressHtml}
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex justify-center gap-2">
                    <button class="p-2 text-outline hover:text-primary transition-colors" title="Download Data Kontainer" onclick="event.stopPropagation(); window.downloadContainerRow(event, '${containerId}');">
                        <span class="material-symbols-outlined">download</span>
                    </button>
                    <button class="p-2 text-outline hover:text-primary transition-colors" title="Detail Kontainer" onclick="event.stopPropagation(); window.openContainer('${containerId}');">
                        <span class="material-symbols-outlined">more_vert</span>
                    </button>
                </div>
            </td>
        `;
        tr.addEventListener('click', () => openContainer(containerId));
        containerTableBody.appendChild(tr);
    });

    // Update Stats Summary di HTML
    const elTotal = document.getElementById('stat-total');
    const elSelesai = document.getElementById('stat-selesai');
    const elProses = document.getElementById('stat-proses');
    const elSisa = document.getElementById('stat-sisa');
    
    if (elTotal) elTotal.textContent = uniqueContainers.length;
    if (elSelesai) elSelesai.textContent = totalSelesai;
    if (elProses) elProses.textContent = totalProses;
    if (elSisa) elSisa.textContent = totalSisa;
    } catch (err) {
        alert('Terjadi kesalahan saat membuka file: ' + err.message);
    }
}

window.downloadContainerRow = async function(event, containerId) {
    const btn = event.currentTarget;
    const originalHtml = btn.innerHTML;
    try {
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">sync</span>`;
        btn.disabled = true;

        const containerData = await fetchAllRows(
            'penerimaan_kapal',
            '*',
            { nama_file: currentFile, nomor_kontainer: containerId }
        );
        
        if (containerData.length === 0) {
            alert('Tidak ada data.');
        } else {
            await exportToExcel(containerId, containerData, btn);
        }
    } catch(e) {
        alert('Gagal mendownload: ' + e.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

async function openContainer(containerId) {
    currentContainer = containerId;
    const itemTitleEl = document.getElementById('item-title');
    if (itemTitleEl) itemTitleEl.textContent = `Detail Kontainer: ${containerId}`;
    
    updatePageTitle('items');
    
    // Transisi UI
    document.getElementById('view-containers').classList.add('hidden');
    document.getElementById('view-items').classList.remove('hidden');
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return; // Add the DOM safeguard here too!
    tableBody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-on-surface-variant"><span class="material-symbols-outlined animate-spin text-primary text-4xl block mb-2">sync</span> Memuat data kontainer...</td></tr>`;

    // FASE 2: Ambil data lengkap (select *) HANYA untuk kontainer yang dibuka
    const containerData = await fetchAllRows(
        'penerimaan_kapal',
        '*',
        { nama_file: currentFile, nomor_kontainer: containerId }
    );

    // Simpan ke allFileData agar export masih bisa dipakai
    allFileData = containerData;

    if (containerData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-on-surface-variant">Tidak ada barang di kontainer ini.</td></tr>`;
        return;
    }

    const btnExport = document.getElementById('btn-export-excel');
    if (btnExport) {
        btnExport.classList.remove('hidden'); // Tampilkan tombol download
        // Hapus listener lama dengan clone node untuk menghindari multiple triggers
        const newBtnExport = btnExport.cloneNode(true);
        btnExport.parentNode.replaceChild(newBtnExport, btnExport);
        newBtnExport.addEventListener('click', () => {
            exportToExcel(containerId, containerData);
        });
    }

    const inspectionPanel = document.getElementById('inspection-panel');
    if (inspectionPanel) {
        inspectionPanel.innerHTML = '';
    }

    try {
        tableBody.innerHTML = '';
        containerData.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-surface-container transition-colors";
            
            const safe = (val) => val ? val : '-';
            
            // Prioritaskan status_inspeksi dari HP staff, jika tidak ada gunakan hasil_cek dari Excel
            let finalHasilCek = row.status_inspeksi ? row.status_inspeksi : safe(row.hasil_cek);

            let badgeColor = 'bg-surface-container text-on-surface-variant';
            const cek = String(finalHasilCek).toLowerCase();
            
            if (cek.includes('sesuai') && !cek.includes('tidak sesuai')) {
                badgeColor = 'bg-green-100 text-green-800 border border-green-200';
            } else if (cek.includes('tidak sesuai')) {
                badgeColor = 'bg-red-100 text-red-800 border border-red-200';
            } else if (cek.includes('tidak perlu dicek') || cek === 'tidak perlu dicek') {
                badgeColor = 'bg-white text-on-surface-variant border border-outline-variant';
            } else if (cek === 'menunggu inspeksi' || cek.includes('menunggu inspeksi')) {
                finalHasilCek = '-';
                badgeColor = 'bg-transparent text-on-surface-variant';
            } else if (cek.includes('合格') || cek.includes('lulus') || cek.includes('normal')) {
                badgeColor = 'bg-green-100 text-green-800 border border-green-200';
            } else if (cek !== '-' && cek !== 'null' && cek !== '') {
                badgeColor = 'bg-red-100 text-red-800 border border-red-200';
            }

            // Foto Thumbnail
            let fotoHtml = '<span class="text-on-surface-variant text-xs">-</span>';
            if (row.foto_inspeksi) {
                try {
                    const parsed = JSON.parse(row.foto_inspeksi);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const encodedUrls = encodeURIComponent(JSON.stringify(parsed)).replace(/'/g, "%27");
                        fotoHtml = `<div class="flex flex-wrap gap-1 justify-center max-w-[120px] mx-auto">`;
                        parsed.forEach((url, i) => {
                            fotoHtml += `<img src="${url}" onclick="window.openImagePreview('${encodedUrls}', ${i})" class="cursor-pointer h-10 w-10 object-cover rounded shadow-sm hover:scale-110 transition-transform">`;
                        });
                        fotoHtml += `</div>`;
                    }
                } catch (e) {
                    const encodedUrls = encodeURIComponent(JSON.stringify([row.foto_inspeksi])).replace(/'/g, "%27");
                    fotoHtml = `<img src="${row.foto_inspeksi}" onclick="window.openImagePreview('${encodedUrls}', 0)" class="cursor-pointer h-10 w-10 object-cover rounded shadow-sm hover:scale-110 transition-transform">`;
                }
            }

            // Tanggal Update Staff
            let tglInspeksi = '-';
            if (row.tanggal_inspeksi) {
                tglInspeksi = parseLocalDate(row.tanggal_inspeksi).toLocaleString('id-ID', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
            }
            if (finalHasilCek === 'Tidak Perlu Dicek') {
                tglInspeksi = 'Tidak Perlu Dicek';
            }

            // Staf Pemeriksa (dari mobile app)
            let pemeriksaStr = '-';
            if (row.status_inspeksi === 'Menunggu Inspeksi') {
                pemeriksaStr = '-';
            } else if (row.nama_staf && row.id_staf) {
                pemeriksaStr = `${row.nama_staf} - ${row.id_staf}`;
            } else if (row.nama_staf) {
                pemeriksaStr = row.nama_staf;
            } else if (row.pelapor) {
                // Fallback sementara jika belum ada data staf dari app
                pemeriksaStr = row.pelapor; 
            }
            
            tr.innerHTML = `
                <td class="px-4 py-3 border-r border-outline-variant/50 text-center font-bold">${index + 1}</td>
                <td class="px-4 py-3 border-r border-outline-variant/50 font-medium text-primary whitespace-normal leading-snug text-center">${safe(row.nama_material)}</td>
                <td class="px-4 py-3 border-r border-outline-variant/50 text-center font-bold whitespace-nowrap">${safe(row.jumlah_data)}</td>
                <td class="px-4 py-3 border-r border-outline-variant/50 text-xs whitespace-nowrap text-center">${tglInspeksi}</td>
                <td class="px-4 py-3 border-r border-outline-variant/50 text-center"><span class="inline-block px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap ${badgeColor}">${finalHasilCek}</span></td>
                <td class="px-4 py-3 border-r border-outline-variant/50 text-xs whitespace-nowrap text-center text-primary font-medium">${pemeriksaStr}</td>
                <td class="px-4 py-3 text-center flex justify-center">${fotoHtml}</td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        alert("Error during table render: " + err.message);
    }
}

// Fitur Export to Excel dengan Foto (Menggunakan ExcelJS)
async function exportToExcel(containerId, containerData, buttonElement = null) {
    const btn = buttonElement || document.getElementById('btn-export-excel');
    const originalText = btn ? btn.innerHTML : '';
    
    try {
        if (btn) {
            btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">sync</span> Memproses Excel...`;
            btn.disabled = true;
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Detail Kontainer');

        // Definisi Kolom (Sama persis dengan header HTML yang baru)
        // Cari maksimal jumlah foto dalam satu baris
        let maxPhotos = 0;
        const parsedPhotosList = [];
        for (const row of containerData) {
            let urls = [];
            if (row.foto_inspeksi) {
                try {
                    const parsed = JSON.parse(row.foto_inspeksi);
                    if (Array.isArray(parsed)) urls = parsed;
                } catch (e) {
                    urls = [row.foto_inspeksi];
                }
            }
            parsedPhotosList.push(urls);
            if (urls.length > maxPhotos) {
                maxPhotos = urls.length;
            }
        }
        if (maxPhotos === 0) maxPhotos = 1;

        // Definisi Kolom (Bilingual)
        const columns = [
            { header: 'No.\n序号', key: 'no', width: 8 },
            { header: 'Nomor kontainer\n集装箱号', key: 'nomor_kontainer', width: 20 },
            { header: 'PT\n公司', key: 'pt', width: 15 },
            { header: 'Pelapor dan departemen pelapor\n申报部门及申报人', key: 'pelapor', width: 25 },
            { header: 'Nomor kontrak\n合同号', key: 'nomor_kontrak', width: 20 },
            { header: 'Nomor pembelian\n订单号', key: 'nomor_pembelian', width: 20 },
            { header: 'Nama material\n物资名称', key: 'nama_material', width: 45 },
            { header: 'Satuan\n单位', key: 'satuan', width: 12 },
            { header: 'Jumlah data\n账面数量', key: 'jumlah_data', width: 15 },
            { header: 'Satuan kemasan\n包装方式', key: 'satuan_kemasan', width: 15 },
            { header: 'Jumlah kemasan\n包装件数', key: 'jumlah_kemasan', width: 15 },
            { header: 'Penanggung jawab\n负责人', key: 'penanggung_jawab', width: 18 },
            { header: 'tampilan luar apakah kondisi normal?\n外观是否正常', key: 'tampilan_luar', width: 20 },
            { header: 'Tes kualitas apakah sesuai\n检验是否合格', key: 'tes_kualitas', width: 20 },
            { header: 'KET\n备注', key: 'keterangan', width: 25 },
            { header: 'tanggal cek barang\n验收日期', key: 'tanggal_cek', width: 20 },
            { header: 'hasil cek barang\n验收情况', key: 'hasil_cek', width: 20 }
        ];

        for (let i = 1; i <= maxPhotos; i++) {
            columns.push({ header: `Foto Barang Yang Dicek ${i}\n验收照片 ${i}`, key: `foto_${i}`, width: 15 });
        }
        sheet.columns = columns;

        // Format Header Row
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        sheet.getRow(1).height = 40;

        // Tambahkan Judul Nama Kapal di Paling Atas
        sheet.spliceRows(1, 0, []); 
        sheet.mergeCells(1, 1, 1, 17 + maxPhotos);
        const titleCell = sheet.getCell('A1');
        let cleanFileName = currentFile.replace(/\.xlsx?$/i, '');
        cleanFileName = cleanFileName.replace(/船编辑清单/gi, '船照片登记表');
        titleCell.value = `${cleanFileName}\n${containerId}`;
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        sheet.getRow(1).height = 50;

        // Karena ditambah 1 baris, Header sekarang ada di baris 2
        sheet.getRow(2).font = { bold: true };
        sheet.getRow(2).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        sheet.getRow(2).height = 65; // Diperbesar agar teks terlihat semua
        
        // Add borders and background color to header row
        sheet.getRow(2).eachCell({ includeEmpty: false }, (cell) => {
            cell.border = {
                top: { style: 'medium' },
                left: { style: 'medium' },
                bottom: { style: 'medium' },
                right: { style: 'medium' }
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFC9E0F8' } // Cornflower Blue, Accent 5, Lighter 60% (approx)
            };
        });

        // Proses setiap baris
        for (let i = 0; i < containerData.length; i++) {
            const row = containerData[i];
            let hasilCek = row.status_inspeksi ? row.status_inspeksi : (row.hasil_cek || '-');
            
            // Format dwibahasa untuk Excel
            const cekLower = String(hasilCek).toLowerCase();
            if (cekLower === 'menunggu inspeksi' || cekLower.includes('menunggu inspeksi')) {
                hasilCek = '-';
            } else if (cekLower.includes('sesuai') && !cekLower.includes('tidak sesuai')) {
                hasilCek = 'Sesuai\n合格';
            } else if (cekLower.includes('tidak sesuai')) {
                hasilCek = 'Tidak Sesuai\n不合格';
            } else if (cekLower.includes('tidak perlu dicek') || cekLower === 'tidak perlu dicek') {
                hasilCek = 'Tidak Perlu Dicek\n不用检查';
            }
            
            // Format waktu (hanya tanggal, tanpa jam)
            let tglInspeksi = '-';
            if (row.tanggal_inspeksi) {
                tglInspeksi = parseLocalDate(row.tanggal_inspeksi).toLocaleString('id-ID', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric'
                });
            }

            const excelRow = sheet.addRow({
                no: i + 1,
                nomor_kontainer: row.nomor_kontainer || '-',
                pt: row.pt || '-',
                pelapor: row.pelapor || '-',
                nomor_kontrak: row.nomor_kontrak || '-',
                nomor_pembelian: row.nomor_pembelian || '-',
                nama_material: row.nama_material || '-',
                satuan: row.satuan || '-',
                jumlah_data: row.jumlah_data || '-',
                satuan_kemasan: row.satuan_kemasan || '-',
                jumlah_kemasan: row.jumlah_kemasan || '-',
                penanggung_jawab: row.penanggung_jawab || '-',
                tampilan_luar: hasilCek,
                tes_kualitas: hasilCek,
                keterangan: row.keterangan || '-',
                tanggal_cek: tglInspeksi,
                hasil_cek: hasilCek,
            });

            // Set default alignment and borders untuk semua cell, termasuk kolom foto yang kosong teksnya
            for (let c = 1; c <= 17 + maxPhotos; c++) {
                const cell = excelRow.getCell(c);
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'medium' },
                    left: { style: 'medium' },
                    bottom: { style: 'medium' },
                    right: { style: 'medium' }
                };
            }
            
            // Proses Foto
            const photoUrls = parsedPhotosList[i];

            if (photoUrls.length > 0) {
                // Sesuaikan tinggi baris agar foto muat presisi (width kolom 15 = ~110px, height 70 = ~93px)
                excelRow.height = 70; 
                
                // Mulai download foto-foto dan letakkan di kolom masing-masing
                for (let j = 0; j < photoUrls.length; j++) {
                    const url = photoUrls[j];
                    try {
                        const response = await fetch(url);
                        if (!response.ok) continue;
                        
                        const arrayBuffer = await response.arrayBuffer();
                        const extension = url.toLowerCase().includes('.png') ? 'png' : 'jpeg';
                        
                        const imageId = workbook.addImage({
                            buffer: arrayBuffer,
                            extension: extension,
                        });

                        // Tambahkan gambar ke cell kolom ke-(17 + j) (karena 17 kolom awal)
                        // Koordinat tl diset mepet cell dengan offset sangat tipis karena ukuran kolom sudah dipaskan
                        sheet.addImage(imageId, {
                            tl: { col: 17 + j + 0.05, row: excelRow.number - 1 + 0.05 },
                            ext: { width: 85, height: 85 },
                            editAs: 'oneCell' 
                        });
                    } catch (err) {
                    }
                }
            }
        }

        // Tulis ke buffer dan simpan file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Buat nama file aman
        const safeContainerId = containerId.replace(/[^a-z0-9]/gi, '_');
        saveAs(blob, `Laporan_Kontainer_${safeContainerId}.xlsx`);

    } catch (error) {
        alert("Terjadi kesalahan saat memproses excel: " + error.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initKelolaKapal); } else { initKelolaKapal(); }

document.addEventListener('app:pageLoaded', (e) => { if (window.location.pathname.endsWith('kelola_kapal.html')) initKelolaKapal(); });

// --- Image Preview Functions ---
let currentPreviewUrls = [];
let currentPreviewIndex = 0;

function updatePreviewUI() {
    const img = document.getElementById('preview-image');
    const counter = document.getElementById('image-counter');
    const btnPrev = document.getElementById('btn-prev-image');
    const btnNext = document.getElementById('btn-next-image');

    if (!img) return;

    img.src = currentPreviewUrls[currentPreviewIndex];

    if (currentPreviewUrls.length > 1) {
        counter.textContent = `${currentPreviewIndex + 1} / ${currentPreviewUrls.length}`;
        counter.classList.remove('hidden');
        
        btnPrev.classList.remove('hidden');
        btnPrev.classList.add('flex');
        
        btnNext.classList.remove('hidden');
        btnNext.classList.add('flex');
    } else {
        counter.classList.add('hidden');
        
        btnPrev.classList.remove('flex');
        btnPrev.classList.add('hidden');
        
        btnNext.classList.remove('flex');
        btnNext.classList.add('hidden');
    }
}

function injectImagePreviewModal() {
    if (!document.getElementById('image-preview-modal')) {
        const modalHTML = `
<!-- Image Preview Modal -->
<div id="image-preview-modal" onclick="if(event.target.id === 'image-preview-modal') window.closeImagePreview()" class="hidden fixed inset-0 flex items-center justify-center transition-opacity" style="z-index: 999999; background-color: rgba(0, 0, 0, 0.9); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); cursor: pointer;">
    <!-- Close Button -->
    <button onclick="window.closeImagePreview()" class="fixed flex items-center justify-center transition-all group shadow-sm border border-black/20 rounded-full" style="z-index: 9999999; top: 24px; left: 24px; width: 32px; height: 32px; background-color: #ff5f56; cursor: pointer;" title="Tutup">
        <span class="material-symbols-outlined text-black/60 text-[18px] group-hover:text-black transition-colors">close</span>
    </button>
    <!-- Prev Button -->
    <button id="btn-prev-image" onclick="window.prevImagePreview()" class="fixed text-white hover:bg-white/30 rounded-full transition-colors hidden items-center justify-center cursor-pointer" style="z-index: 9999999; top: 50%; left: 24px; transform: translateY(-50%); background-color: rgba(255, 255, 255, 0.1); width: 48px; height: 48px; border: 1px solid rgba(255, 255, 255, 0.2);">
        <span class="material-symbols-outlined text-[32px]">chevron_left</span>
    </button>
    <!-- Next Button -->
    <button id="btn-next-image" onclick="window.nextImagePreview()" class="fixed text-white hover:bg-white/30 rounded-full transition-colors hidden items-center justify-center cursor-pointer" style="z-index: 9999999; top: 50%; right: 24px; transform: translateY(-50%); background-color: rgba(255, 255, 255, 0.1); width: 48px; height: 48px; border: 1px solid rgba(255, 255, 255, 0.2);">
        <span class="material-symbols-outlined text-[32px]">chevron_right</span>
    </button>
    <!-- Image Container -->
    <div class="relative w-full max-w-6xl h-full flex justify-center items-center p-4 sm:p-12 pointer-events-none">
        <img id="preview-image" src="" onclick="event.stopPropagation()" class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-transform transform scale-95 pointer-events-auto cursor-default" alt="Preview Foto">
    </div>
    <!-- Image Counter -->
    <div id="image-counter" class="fixed bottom-6 left-1/2 -translate-x-1/2 text-white bg-white/10 px-5 py-2 rounded-full text-sm font-semibold tracking-wide hidden" style="z-index: 9999999;">
        1 / 1
    </div>
</div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
}

window.openImagePreview = function(encodedUrls, index) {
    try {
        currentPreviewUrls = JSON.parse(decodeURIComponent(encodedUrls));
        currentPreviewIndex = index;
    } catch (e) {
        currentPreviewUrls = [decodeURIComponent(encodedUrls)];
        currentPreviewIndex = 0;
    }

    injectImagePreviewModal(); // Ensure modal exists in body

    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-image');
    
    if (modal && img) {
        updatePreviewUI();
        modal.classList.remove('hidden');
        setTimeout(() => {
            img.classList.remove('scale-95');
            img.classList.add('scale-100');
            modal.classList.add('opacity-100');
        }, 10);
    }
};

window.nextImagePreview = function() {
    if (currentPreviewUrls.length > 1) {
        currentPreviewIndex = (currentPreviewIndex + 1) % currentPreviewUrls.length;
        updatePreviewUI();
    }
};

window.prevImagePreview = function() {
    if (currentPreviewUrls.length > 1) {
        currentPreviewIndex = (currentPreviewIndex - 1 + currentPreviewUrls.length) % currentPreviewUrls.length;
        updatePreviewUI();
    }
};

window.closeImagePreview = function() {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-image');
    if (modal && img) {
        img.classList.remove('scale-100');
        img.classList.add('scale-95');
        modal.classList.remove('opacity-100');
        setTimeout(() => {
            modal.classList.add('hidden');
            img.src = '';
            currentPreviewUrls = [];
        }, 200);
    }
};
