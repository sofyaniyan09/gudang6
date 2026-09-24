/**
 * staffPortal.js - Staff Web Portal
 * Alur: Overview → Armada → Kontainer → Barang → Inspeksi + Profil
 */

import { requireStaffAuth, logout } from './auth.js';
import { supabase } from './supabaseClient.js';

let currentUser = null;
let currentProfile = null;
let currentShipRaw = null;
let currentShipClean = null;
let currentContainer = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authData = await requireStaffAuth();
    if (!authData) return;
    currentUser = authData.user;
    currentProfile = authData.profile;
    
    // Admin override for nav bar
    if (currentProfile?.role === 'admin') {
        document.getElementById('nav-btn-scanner')?.classList.add('hidden');
        document.getElementById('nav-btn-users')?.classList.remove('hidden');
        initUserManagementMobile();
    }
    
    setupNavigation();
    setupSearchBars();
    loadOverview();
    loadProfileUI();
    setupBackButtons();
});

function setupSearchBars() {
    const attachSearch = (btnId, barId, inputId, listSelector) => {
        const btn = document.getElementById(btnId);
        const bar = document.getElementById(barId);
        const input = document.getElementById(inputId);
        if (!btn || !bar || !input) return;
        
        btn.addEventListener('click', () => {
            if (bar.classList.contains('hidden')) {
                bar.classList.remove('hidden');
                input.focus();
            } else {
                bar.classList.add('hidden');
                input.value = '';
                input.dispatchEvent(new Event('input'));
            }
        });
        
        input.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const container = document.querySelector(listSelector);
            if (!container) return;
            Array.from(container.children).forEach(item => {
                if (item.textContent.toLowerCase().includes(term)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    };

    attachSearch('btn-search-main', 'search-bar-main', 'input-search-main', '#tab-armada > div');
    attachSearch('btn-search-containers', 'search-bar-containers', 'input-search-containers', '#container-list-content > div');
    attachSearch('btn-search-items', 'search-bar-items', 'input-search-items', '#items-list-content > div');
}

async function fetchAllRows(table, selectColumns, filters = {}) {
    const PAGE_SIZE = 1000;
    let allData = [], from = 0, hasMore = true;
    while (hasMore) {
        let query = supabase.from(table).select(selectColumns).order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
        for (const [k, v] of Object.entries(filters)) query = query.eq(k, v);
        const { data, error } = await query;
        if (error) { console.error(error); break; }
        if (data && data.length > 0) { allData = allData.concat(data); from += PAGE_SIZE; if (data.length < PAGE_SIZE) hasMore = false; } else hasMore = false;
    }
    return allData;
}

function showLoading(el, msg) {
    el.innerHTML = `<div class="flex flex-col items-center justify-center h-40 text-white/50 gap-3"><span class="material-symbols-outlined text-4xl animate-spin">sync</span><p class="text-[13px]">${msg}</p></div>`;
}
function showEmpty(el, icon, msg) {
    el.innerHTML = `<div class="flex flex-col items-center justify-center h-full min-h-[200px] text-white/30 gap-3 py-12"><span class="material-symbols-outlined text-6xl">${icon}</span><p class="text-[13px] text-center max-w-[200px]">${msg}</p></div>`;
}
function openPanel(id) {
    const p = document.getElementById(id); if (!p) return;
    p.classList.remove('hidden');
    // Force reflow so transition fires
    p.getBoundingClientRect();
    p.style.transform = 'translateX(0)';
}
function closePanel(id) {
    const p = document.getElementById(id); if (!p) return;
    p.style.transform = 'translateX(100%)';
    setTimeout(() => p.classList.add('hidden'), 310);
}
function setupBackButtons() {
    document.getElementById('btn-back-containers')?.addEventListener('click', () => closePanel('panel-containers'));
    document.getElementById('btn-back-items')?.addEventListener('click', () => {
        closePanel('panel-items');
        window.bulkSelectedItems.clear();
        window.updateBulkUI();
    });
    document.getElementById('btn-bulk-select')?.addEventListener('click', () => window.toggleSelectAll());
    document.getElementById('btn-back-inspection')?.addEventListener('click', () => closePanel('panel-inspection'));
    
    // Delete Ship Button (Admin Only)
    const btnDeleteShip = document.getElementById('btn-delete-ship');
    if (btnDeleteShip) {
        btnDeleteShip.addEventListener('click', async () => {
            if (currentProfile?.role !== 'admin') return;
            if (!currentShipRaw) return;
            
            const proceed = confirm(`Apakah Anda yakin ingin MENGHAPUS SEMUA DATA untuk kapal "${currentShipClean}"?\n\nTindakan ini tidak dapat dibatalkan!`);
            if (!proceed) return;
            
            const originalHtml = btnDeleteShip.innerHTML;
            btnDeleteShip.innerHTML = '<span class="material-symbols-outlined text-red-500 animate-spin">sync</span>';
            btnDeleteShip.disabled = true;
            
            let hasMoreData = true;
            let loopCount = 0;
            try {
                while (hasMoreData && loopCount < 50) {
                    loopCount++;
                    const { count, error } = await supabase
                        .from('penerimaan_kapal')
                        .delete({ count: 'exact' })
                        .eq('nama_file', currentShipRaw);
                    
                    if (error) throw error;
                    if (count === 0) {
                        hasMoreData = false;
                        break;
                    }
                }
                
                alert(`Data kapal "${currentShipClean}" berhasil dihapus.`);
                closePanel('panel-containers');
                
                // Reload list of ships
                const tid = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
                if (tid === 'tab-armada') loadShips();
                
            } catch (err) {
                alert(`Gagal menghapus data: ${err.message}`);
                console.error(err);
            } finally {
                btnDeleteShip.innerHTML = originalHtml;
                btnDeleteShip.disabled = false;
            }
        });
    }
}
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const appBarTitle = document.getElementById('app-bar-title');
    const btnSearchMain = document.getElementById('btn-search-main');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            const tid = item.getAttribute('data-tab');
            const ttitle = item.getAttribute('data-title');
            document.getElementById(tid)?.classList.add('active');
            if (appBarTitle && ttitle) appBarTitle.textContent = ttitle;
            if (tid === 'tab-armada' && !document.querySelector('.ship-card')) loadShips();
            
            if (btnSearchMain) {
                const btnUpload = document.getElementById('btn-upload-excel');
                if (tid === 'tab-armada') {
                    btnSearchMain.classList.remove('hidden');
                    if (btnUpload && currentProfile?.role === 'admin') btnUpload.classList.remove('hidden');
                } else {
                    btnSearchMain.classList.add('hidden');
                    if (btnUpload) btnUpload.classList.add('hidden');
                    const searchBarMain = document.getElementById('search-bar-main');
                    if (searchBarMain) searchBarMain.classList.add('hidden');
                }
            }
        });
    });
}

// ── OVERVIEW ──
async function loadOverview() {
    const el = document.getElementById('tab-overview');
    showLoading(el, 'Memuat Ringkasan...');
    try {
        const data = await fetchAllRows('penerimaan_kapal', 'nama_file, nomor_kontainer, status_inspeksi, tanggal_inspeksi, created_at');
        const cmap = new Map();
        for (const row of data) {
            const file = row.nama_file || 'Tanpa File';
            const kont = row.nomor_kontainer || 'Tanpa Kontainer';
            const key = file + '_' + kont;
            if (!cmap.has(key)) cmap.set(key, { file, kontainer: kont, totalItems: 0, inspectedItems: 0, latestUpdate: null });
            const c = cmap.get(key);
            c.totalItems++;
            const status = row.status_inspeksi || '';
            const cd = row.created_at ? new Date(row.created_at) : null;
            if (cd && (!c.latestUpdate || cd > c.latestUpdate)) c.latestUpdate = cd;
            if (status && status !== 'Menunggu Inspeksi' && status !== '-') {
                c.inspectedItems++;
                const td = row.tanggal_inspeksi ? new Date(row.tanggal_inspeksi.replace(/(Z|\+00:00|\+00)$/i, '')) : null;
                if (td && (!c.latestUpdate || td > c.latestUpdate)) c.latestUpdate = td;
            }
        }
        let total = 0, selesai = 0, onProses = 0, belum = 0;
        const ongoingList = [];
        const today = new Date(); today.setHours(0,0,0,0);
        const daily = Array.from({length:7}, (_, i) => {
            const d = new Date(today); d.setDate(today.getDate()-(6-i));
            const lbl = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
            return { date: d, label: i===6 ? 'Hari Ini' : lbl[d.getDay()===0?6:d.getDay()-1], val: 0 };
        });
        for (const c of cmap.values()) {
            total++;
            if (c.inspectedItems === 0) { belum++; }
            else if (c.inspectedItems === c.totalItems) {
                selesai++;
                if (c.latestUpdate) {
                    const ud = new Date(c.latestUpdate); ud.setHours(0,0,0,0);
                    const diff = Math.round((today-ud)/86400000);
                    if (diff >= 0 && diff < 7) daily[6-diff].val++;
                }
            } else {
                onProses++;
                const pct = Math.round((c.inspectedItems/c.totalItems)*100);
                ongoingList.push({ nama_file: c.file, nomor_kontainer: c.kontainer, inspectedItems: c.inspectedItems, totalItems: c.totalItems, percentage: pct, latestUpdate: c.latestUpdate });
            }
        }
        ongoingList.sort((a,b) => b.percentage - a.percentage);
        const top = ongoingList.slice(0,10);
        const mx = Math.max(...daily.map(d=>d.val),1);
        const bars = daily.map(d => {
            const h = Math.max((d.val/mx)*100,4);
            const bg = d.val > 0 ? 'rgba(170,199,255,0.7)' : 'rgba(255,255,255,0.07)';
            return `<div class="flex flex-col items-center gap-1 flex-1"><span class="text-[10px] text-white/50 font-bold">${d.val>0?d.val:''}</span><div class="w-full flex items-end" style="height:60px"><div class="w-full rounded-t-md" style="height:${h}%;background:${bg}"></div></div><span class="text-[10px] text-white/40">${d.label}</span></div>`;
        }).join('');
        const t = total||1;
        const pS = (selesai/t)*360, pP = (onProses/t)*360;
        const onHTML = top.length === 0
            ? '<p class="text-white/30 text-center py-6 text-[13px]">Belum ada pembaruan kontainer.</p>'
            : top.map(item => {
                const sc = item.nama_file.replace(/\.(xlsx|xls)$/i,'');
                const ds = item.latestUpdate ? new Date(item.latestUpdate).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'2-digit'}) : '';
                return `<div class="glass-card p-4 flex flex-col gap-2 cursor-pointer active:scale-[0.98] transition-transform" onclick="openShip('${item.nama_file.replace(/'/g,"\\'")}','${sc.replace(/'/g,"\\'")}','${item.nomor_kontainer.replace(/'/g,"\\'")}')"><div class="flex items-start justify-between gap-2"><div class="flex-1 min-w-0"><p class="text-white font-bold text-[15px] truncate">${item.nomor_kontainer}</p><p class="text-white/50 text-[11px] truncate mt-0.5">${sc}</p></div><span class="text-orange-400 font-bold text-[13px] shrink-0">${item.percentage}%</span></div><div class="w-full bg-white/10 h-1.5 rounded-full overflow-hidden"><div class="bg-orange-400 h-full rounded-full" style="width:${item.percentage}%"></div></div><div class="flex justify-between text-[10px] text-white/30"><span>${item.inspectedItems}/${item.totalItems} item</span><span>${ds}</span></div></div>`;
            }).join('');
        el.innerHTML = `<div class="flex flex-col gap-5 pb-6">
<div class="glass-card p-5"><p class="text-[11px] font-bold text-white/40 tracking-widest mb-5">STATUS UPDATE</p><div class="flex items-center gap-6"><div class="relative shrink-0" style="width:100px;height:100px"><div style="width:100%;height:100%;border-radius:50%;background:conic-gradient(#4ade80 0deg ${pS}deg,#fb923c ${pS}deg ${pS+pP}deg,#aac7ff ${pS+pP}deg 360deg)"></div><div class="absolute inset-0 flex flex-col items-center justify-center" style="background:radial-gradient(circle,var(--donut-inner) 52%,transparent 53%)"><span class="text-white font-bold text-[20px] leading-tight">${total}</span><span class="text-white/40 text-[8px] tracking-widest">OVERALL</span></div></div><div class="flex flex-col gap-3 flex-1"><div class="flex items-center gap-2"><div class="w-3 h-3 rounded-sm bg-green-400 shrink-0"></div><span class="text-white/60 text-[11px] flex-1">Selesai</span><span class="text-white font-bold text-[13px]">${selesai}</span></div><div class="flex items-center gap-2"><div class="w-3 h-3 rounded-sm bg-orange-400 shrink-0"></div><span class="text-white/60 text-[11px] flex-1">On Proses</span><span class="text-white font-bold text-[13px]">${onProses}</span></div><div class="flex items-center gap-2"><div class="w-3 h-3 rounded-sm bg-[#aac7ff] shrink-0"></div><span class="text-white/60 text-[11px] flex-1">Belum Update</span><span class="text-white font-bold text-[13px]">${belum}</span></div></div></div></div>
<div class="glass-card p-5"><p class="text-[11px] font-bold text-white/40 tracking-widest mb-4">AKTIVITAS 7 HARI TERAKHIR</p><div class="flex items-end gap-1.5" style="height:80px">${bars}</div></div>
<div><p class="text-white font-bold text-[18px] mb-4">Ongoing Container Updates</p><div class="flex flex-col gap-3">${onHTML}</div></div>
</div>`;
    } catch(err) {
        console.error(err);
        el.innerHTML = `<div class="text-red-400 p-4 text-center text-[13px]">Gagal memuat: ${err.message}</div>`;
    }
}

// ── ARMADA ──
async function loadShips() {
    const el = document.getElementById('tab-armada');
    showLoading(el, 'Memuat Daftar Armada...');
    try {
        const data = await fetchAllRows('penerimaan_kapal', 'nama_file, nomor_kontainer, status_inspeksi');
        if (!data || data.length === 0) { showEmpty(el, 'directions_boat', 'Belum ada data armada kapal.'); return; }
        const smap = new Map();
        for (const row of data) {
            const raw = row.nama_file || ''; const clean = raw.replace(/\.[^.]+$/,''); if (!clean) continue;
            if (!smap.has(raw)) smap.set(raw, { raw, clean, totalItems:0, inspectedItems:0, containers: new Set() });
            const s = smap.get(raw); s.totalItems++;
            const status = row.status_inspeksi || '';
            if (status && status !== 'Menunggu Inspeksi' && status !== '-') s.inspectedItems++;
            if (row.nomor_kontainer) s.containers.add(row.nomor_kontainer);
        }
        let html = '<div class="flex flex-col gap-4 pb-6">';
        for (const s of smap.values()) {
            const pct = s.totalItems > 0 ? Math.round((s.inspectedItems/s.totalItems)*100) : 0;
            const bc = pct===100?'#4ade80':pct>0?'#fb923c':'rgba(255,255,255,0.2)';
            const rawEsc = s.raw.replace(/'/g,"\\'"); const cleanEsc = s.clean.replace(/'/g,"\\'");
            html += `<div class="glass-card ship-card p-4 cursor-pointer active:scale-[0.98] transition-transform" onclick="openShip('${rawEsc}','${cleanEsc}')"><div class="flex items-center gap-4"><div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style="background:rgba(170,199,255,0.12)"><span class="material-symbols-outlined text-[#aac7ff] text-[28px]">directions_boat_filled</span></div><div class="flex-1 min-w-0"><p class="text-white font-extrabold text-[15px] truncate">${s.clean}</p><p class="text-white/50 text-[12px] mt-0.5">${s.containers.size} Kontainer</p><div class="flex items-center gap-2 mt-3"><div class="flex-1 bg-white/10 h-1 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${bc}"></div></div><span class="text-white font-bold text-[12px]">${pct}%</span></div></div><span class="material-symbols-outlined text-[#aac7ff] text-[20px]">chevron_right</span></div></div>`;
        }
        html += '</div>';
        el.innerHTML = html;
    } catch(err) { console.error(err); el.innerHTML = `<div class="text-red-400 p-4 text-center">${err.message}</div>`; }
}

// ── PANEL KONTAINER ──
window.openShip = async function(rawName, cleanName, jumpTo) {
    currentShipRaw = rawName; currentShipClean = cleanName;
    document.getElementById('panel-ship-title').textContent = cleanName;
    document.getElementById('app-bar-title').textContent = cleanName;
    
    const btnDelete = document.getElementById('btn-delete-ship');
    if (btnDelete) {
        if (currentProfile?.role === 'admin') btnDelete.classList.remove('hidden');
        else btnDelete.classList.add('hidden');
    }
    
    openPanel('panel-containers');
    const content = document.getElementById('container-list-content');
    showLoading(content, 'Memuat Kontainer...');
    try {
        const data = await fetchAllRows('penerimaan_kapal', 'nomor_kontainer, status_inspeksi, tanggal_inspeksi', { nama_file: rawName });
        if (!data || data.length === 0) { showEmpty(content, 'inventory_2', 'Tidak ada kontainer.'); return; }
        const cmap = new Map();
        for (const row of data) {
            const cn = row.nomor_kontainer?.trim() || 'Tanpa Kontainer';
            if (!cmap.has(cn)) cmap.set(cn, { name:cn, totalItems:0, completedItems:0, latestDate: new Date(0) });
            const c = cmap.get(cn); c.totalItems++;
            const s = row.status_inspeksi || '';
            if (s==='Sesuai'||s==='Tidak Sesuai'||s==='Tidak Perlu Dicek') c.completedItems++;
            if (row.tanggal_inspeksi) { try { const d=new Date(row.tanggal_inspeksi.replace(/(Z|\+00:00|\+00)$/i,'')); if(d>c.latestDate) c.latestDate=d; } catch(_){} }
        }
        const containers = Array.from(cmap.values()).sort((a,b) => {
            const af=a.totalItems>0&&a.totalItems===a.completedItems, bf=b.totalItems>0&&b.totalItems===b.completedItems;
            if(af&&!bf) return -1; if(!af&&bf) return 1; return b.latestDate-a.latestDate;
        });
        let html = '<div class="flex flex-col gap-3">';
        for (const c of containers) {
            const pct = c.totalItems>0?Math.round((c.completedItems/c.totalItems)*100):0;
            const bc = pct===100?'#4ade80':pct>0?'#33a9ff':'rgba(255,255,255,0.15)';
            const bg = pct===100?'rgba(74,222,128,0.12)':pct>0?'rgba(51,169,255,0.12)':'rgba(170,199,255,0.08)';
            const col = pct===100?'#4ade80':pct>0?'#33a9ff':'#aac7ff';
            const ds = c.latestDate>new Date(0) ? c.latestDate.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+c.latestDate.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : 'Belum diupdate';
            const nameEsc = c.name.replace(/'/g,"\\'");
            html += `<div class="glass-card p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform" onclick="openContainer('${nameEsc}')"><div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style="background:${bg}"><span class="material-symbols-outlined text-[24px]" style="color:${col}">inventory_2</span></div><div class="flex-1 min-w-0"><p class="text-white font-bold text-[15px] truncate">${c.name}</p><p class="text-white/40 text-[11px] mt-0.5">${c.totalItems} Item</p><p class="text-white/30 text-[10px] mt-0.5">Update: ${ds}</p><div class="flex items-center gap-2 mt-2"><div class="flex-1 bg-white/10 rounded-full overflow-hidden" style="height:6px"><div class="h-full rounded-full" style="width:${pct}%;background:${bc}"></div></div><span class="font-bold text-[11px]" style="color:${col}">${pct}%</span></div><p class="text-white/30 text-[10px] mt-1">${c.completedItems}/${c.totalItems} item diinspeksi</p></div><span class="material-symbols-outlined text-white/20 text-[18px]">chevron_right</span></div>`;
        }
        html += '</div>';
        content.innerHTML = html;
        if (jumpTo) setTimeout(() => openContainer(jumpTo), 400);
    } catch(err) { console.error(err); content.innerHTML = `<div class="text-red-400 p-4 text-center">${err.message}</div>`; }
};

// ── PANEL BARANG ──
window.openContainer = async function(containerName) {
    currentContainer = containerName;
    document.getElementById('panel-items-title').textContent = containerName;
    document.getElementById('panel-items-subtitle').textContent = currentShipClean;
    openPanel('panel-items');
    const content = document.getElementById('items-list-content');
    showLoading(content, 'Memuat Data Barang...');
    try {
        let query = supabase.from('penerimaan_kapal')
            .select('id, nama_material, nomor_pembelian, jumlah_data, satuan, nomor_kontrak, penanggung_jawab, status_inspeksi, foto_inspeksi, keterangan, nama_staf, id_staf, nama_file, nomor_kontainer')
            .eq('nama_file', currentShipRaw).order('id', {ascending:true});
        if (containerName === 'Tanpa Kontainer') query = query.or('nomor_kontainer.is.null,nomor_kontainer.eq.,nomor_kontainer.eq. ');
        else query = query.eq('nomor_kontainer', containerName);
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) { showEmpty(content, 'inventory', 'Tidak ada barang ditemukan.'); return; }
        function sc(s) {
            if(s==='Sesuai') return '#6ee7b7'; if(s==='Tidak Sesuai') return '#f87171';
            if(s==='Tidak Perlu Dicek') return '#e0e2ed'; return 'rgba(255,255,255,0.1)';
        }
        function escapeHtml(unsafe) {
            if (!unsafe) return '';
            return unsafe.toString()
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        }
        window.currentItemsData = data;
        let html = '<div class="flex flex-col gap-4 pb-10">';
        data.forEach((item, i) => {
            const status = item.status_inspeksi || 'Menunggu Inspeksi';
            const statusColor = sc(status);
            
            const safeNama = escapeHtml(item.nama_material || 'Tanpa Nama');
            const safeKet = escapeHtml(item.keterangan || '');
            
            // Design matches screenshot: Dark rounded card, full text wrapped, PO/Qty at bottom
            html += `
            <div id="item-card-${i}" class="rounded-[16px] p-4 cursor-pointer active:bg-white/5 transition-colors relative bg-[#1C212D] border border-white/5" 
                 onclick="window.openInspection(${i})">
                 <div id="item-checkbox-${i}" class="absolute top-4 right-4 p-2 -m-2 z-10" onclick="window.toggleSelectItem(event, ${i})">
                     <span class="material-symbols-outlined text-white/20" id="item-check-icon-${i}">check_box_outline_blank</span>
                 </div>
                <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0 pr-8">
                        <div class="text-[15px] text-white/90 font-medium leading-relaxed mb-3 whitespace-pre-wrap">${i+1}. ${safeNama}${safeKet ? '\\n' + safeKet : ''}</div>
                        <div class="flex items-center gap-3">
                            <span class="text-white/40 text-[12px]">PO: ${escapeHtml(item.nomor_pembelian) || '-'} | Qty: ${escapeHtml(item.jumlah_data) || '-'}</span>
                            <div class="w-8 h-1 rounded-full shrink-0" style="background:${statusColor}"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        });
        html += '</div>';
        content.innerHTML = html;
    } catch(err) { console.error(err); content.innerHTML = `<div class="text-red-400 p-4 text-center">${err.message}</div>`; }
};

window.currentItemsData = [];
window.currentInspectionItem = null;
window.existingPhotos = [];
window.newPhotoFiles = [];
window.isBulkMode = false;
window.bulkSelectedItems = new Set();

window.toggleSelectAll = function() {
    const icon = document.getElementById('icon-bulk-select');
    
    if (window.currentItemsData && window.bulkSelectedItems.size === window.currentItemsData.length) {
        // Deselect all
        window.bulkSelectedItems.clear();
        if (icon) icon.textContent = 'check_box_outline_blank';
    } else {
        // Select all
        window.bulkSelectedItems.clear();
        if (window.currentItemsData) {
            window.currentItemsData.forEach((_, i) => window.bulkSelectedItems.add(i));
        }
        if (icon) icon.textContent = 'check_box';
    }
    
    // Update all cards UI
    if (window.currentItemsData) {
        window.currentItemsData.forEach((_, i) => {
            const isSelected = window.bulkSelectedItems.has(i);
            const iconCb = document.getElementById('item-check-icon-' + i);
            if (iconCb) {
                iconCb.textContent = isSelected ? 'check_box' : 'check_box_outline_blank';
                iconCb.className = isSelected ? 'material-symbols-outlined text-[#aac7ff]' : 'material-symbols-outlined text-white/20';
            }
            const card = document.getElementById('item-card-' + i);
            if (card) card.style.border = isSelected ? '1px solid #aac7ff' : '1px solid rgba(255,255,255,0.05)';
        });
    }
    
    window.updateBulkUI();
};

window.toggleSelectItem = function(e, i) {
    e.stopPropagation(); // prevent card click
    
    if (window.bulkSelectedItems.has(i)) {
        window.bulkSelectedItems.delete(i);
    } else {
        window.bulkSelectedItems.add(i);
    }
    
    const isSelected = window.bulkSelectedItems.has(i);
    const iconCb = document.getElementById('item-check-icon-' + i);
    if (iconCb) {
        iconCb.textContent = isSelected ? 'check_box' : 'check_box_outline_blank';
        iconCb.className = isSelected ? 'material-symbols-outlined text-[#aac7ff]' : 'material-symbols-outlined text-white/20';
    }
    const card = document.getElementById('item-card-' + i);
    if (card) card.style.border = isSelected ? '1px solid #aac7ff' : '1px solid rgba(255,255,255,0.05)';
    
    window.updateBulkUI();
};

window.updateBulkUI = function() {
    const el = document.getElementById('bulk-selected-count');
    if (el) el.textContent = `${window.bulkSelectedItems.size} Terpilih`;
    
    const bar = document.getElementById('bulk-action-bar');
    if (bar) {
        if (window.bulkSelectedItems.size > 0) bar.classList.remove('hidden');
        else bar.classList.add('hidden');
    }
    
    const icon = document.getElementById('icon-bulk-select');
    if (icon) {
        if (window.currentItemsData && window.currentItemsData.length > 0 && window.bulkSelectedItems.size === window.currentItemsData.length) {
            icon.textContent = 'check_box';
        } else {
            icon.textContent = 'check_box_outline_blank';
        }
    }
};

window.openInspection = function(index) {
    window.isBulkInspection = false;
    const item = window.currentItemsData[index];
    if (!item) return;
    
    window.currentInspectionItem = item;
    window.currentInspectionIndex = index;
    const status = item.status_inspeksi || '';
    
    document.getElementById('panel-inspection-title').textContent = item.nama_material || 'Detail Barang';
    document.getElementById('panel-inspection-subtitle').textContent = currentContainer;
    
    let photos = [];
    if (item.foto_inspeksi) { try { photos = JSON.parse(item.foto_inspeksi); } catch(_) { photos = [item.foto_inspeksi]; } }
    window.existingPhotos = photos;
    window.newPhotoFiles = [];

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    const safeNama = escapeHtml(item.nama_material || 'Tanpa Nama');
    const safeKet = escapeHtml(item.keterangan || '');

    // Render Detail like Screenshot 3 (Big text card with index on left, qty badge on right)
    let detailHTML = `
<div class="rounded-[20px] p-5 mb-5 bg-[#1C212D] border border-white/5" style="min-height: 200px;">
    <div class="flex items-start gap-4">
        <span class="text-white/70 text-[16px] font-medium pt-1">${index + 1}</span>
        <div class="flex-1 text-[16px] text-white/90 leading-relaxed font-medium whitespace-pre-wrap">${safeNama}${safeKet ? '\\n' + safeKet : ''}</div>
        <div class="shrink-0 bg-[#3B4966] text-[#AAC7FF] px-3 py-1 rounded-[10px] text-[14px] font-bold mt-1">
            ${escapeHtml(item.jumlah_data) || '-'}
        </div>
    </div>
</div>
<div id="inspeksi-photos-preview" class="flex flex-wrap gap-2 mb-32"></div>`;

    // Exact replication of Flutter SpeedDial & Bottom Dropdown
    let formHTML = `
<!-- Full screen backdrop overlay for SpeedDial -->
<div id="speed-dial-overlay" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden transition-opacity opacity-0" onclick="toggleSpeedDial()"></div>

<div class="fixed bottom-0 left-0 w-full p-4 flex items-end justify-between z-50 pointer-events-none" style="max-width: 448px">
    <!-- Status Dropdown (pointer-events-auto) -->
    <div class="flex-1 mr-4 pointer-events-auto mb-2">
        <div class="relative bg-[#1C212D] border border-white/10 rounded-xl">
            <select id="inspeksi-status" class="w-full bg-transparent text-white p-4 pr-10 text-[15px] outline-none cursor-pointer appearance-none">
                <option value="" disabled ${!status ? 'selected' : ''}>${status === 'Tidak Perlu Dicek' ? 'Tidak Perlu Dicek' : 'Pilih Status...'}</option>
                <option value="Sesuai" ${status === 'Sesuai' ? 'selected' : ''}>Sesuai / 合格</option>
                <option value="Tidak Sesuai" ${status === 'Tidak Sesuai' ? 'selected' : ''}>Tidak Sesuai / 不合格</option>
            </select>
            <span class="material-symbols-outlined absolute right-4 top-4 text-white/50 pointer-events-none">expand_more</span>
        </div>
    </div>

    <!-- Speed Dial FAB (pointer-events-auto) -->
    <div class="relative pointer-events-auto flex flex-col items-end justify-end pb-2">
        <!-- Menu Items (hidden by default) -->
        <div id="speed-dial-menu" class="hidden flex-col items-end gap-4 mb-4 transition-all">
            
            <button onclick="setSkipItem()" class="flex items-center gap-4 active:scale-95 transition-transform">
                <span class="bg-[#2A2D36] text-white/80 px-4 py-2 rounded-lg text-[14px] font-medium shadow-md">skip_item</span>
                <div class="w-12 h-12 rounded-full bg-[#FCD34D] text-black flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[24px]">block</span></div>
            </button>

            <label class="flex items-center gap-4 cursor-pointer active:scale-95 transition-transform">
                <span class="bg-[#2A2D36] text-white/80 px-4 py-2 rounded-lg text-[14px] font-medium shadow-md">Buka Kamera</span>
                <div class="w-12 h-12 rounded-full bg-white text-[#84A9FF] flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[24px]">photo_camera</span></div>
                <input type="file" accept="image/*" capture="environment" multiple class="hidden" onchange="handlePhotoSelect(event); window.toggleSpeedDial();">
            </label>

            <label class="flex items-center gap-4 cursor-pointer active:scale-95 transition-transform">
                <span class="bg-[#2A2D36] text-white/80 px-4 py-2 rounded-lg text-[14px] font-medium shadow-md">Pilih dari Galeri</span>
                <div class="w-12 h-12 rounded-full bg-white text-[#84A9FF] flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[24px]">photo_library</span></div>
                <input type="file" id="inspeksi-upload" accept="image/*" multiple class="hidden" onchange="handlePhotoSelect(event); window.toggleSpeedDial();">
            </label>

            <button onclick="submitInspection()" class="flex items-center gap-4 active:scale-95 transition-transform">
                <span class="bg-[#2A2D36] text-white/80 px-4 py-2 rounded-lg text-[14px] font-medium shadow-md">save_upload</span>
                <div class="w-12 h-12 rounded-full bg-[#4ADE80] text-white flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[24px]">cloud_upload</span></div>
            </button>
            
        </div>
        
        <!-- Main FAB -->
        <button onclick="window.toggleSpeedDial()" id="fab-main" class="w-14 h-14 rounded-full bg-[#84A9FF] text-[#001D40] shadow-xl flex items-center justify-center transition-transform active:scale-90 relative z-50">
            <span class="material-symbols-outlined text-[28px] transition-transform duration-300" id="fab-icon">menu</span>
        </button>
    </div>
</div>
`;

    document.getElementById('inspection-content').innerHTML = detailHTML + formHTML;
    renderPhotosPreview();
    openPanel('panel-inspection');
};

window.toggleSpeedDial = function() {
    const menu = document.getElementById('speed-dial-menu');
    const icon = document.getElementById('fab-icon');
    const fab = document.getElementById('fab-main');
    const overlay = document.getElementById('speed-dial-overlay');
    
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        menu.classList.add('flex');
        icon.innerText = 'close';
        icon.style.transform = 'rotate(90deg)';
        fab.style.backgroundColor = '#AAC7FF';
        
        if(overlay) {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        }
    } else {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
        icon.innerText = 'menu';
        icon.style.transform = 'rotate(0deg)';
        fab.style.backgroundColor = '#84A9FF';
        
        if(overlay) {
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    }
};

window.setSkipItem = function() {
    const statusSelect = document.getElementById('inspeksi-status');
    if(statusSelect) {
        statusSelect.innerHTML = '<option value="Tidak Perlu Dicek" selected>Tidak Perlu Dicek</option>';
    }
    submitInspection();
};

window.compressImage = function(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX = 1280;
                if (width > height && width > MAX) {
                    height *= MAX / width;
                    width = MAX;
                } else if (height > MAX) {
                    width *= MAX / height;
                    height = MAX;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.75); // Compress quality
            };
        };
    });
};

window.handlePhotoSelect = async function(event) {
    const files = Array.from(event.target.files);
    
    // Tampilkan loading sementara di UI
    const container = document.getElementById('inspeksi-photos-preview');
    if(container && files.length > 0) container.innerHTML = '<p class="text-white/50 text-[12px] italic animate-pulse">Memproses gambar...</p>';

    for (let file of files) {
        if (file.type.startsWith('image/')) {
            const compressed = await compressImage(file);
            window.newPhotoFiles.push(compressed);
        } else {
            window.newPhotoFiles.push(file);
        }
    }
    renderPhotosPreview();
};

window.removeExistingPhoto = function(index) {
    window.existingPhotos.splice(index, 1);
    renderPhotosPreview();
};

window.removeNewPhoto = function(index) {
    window.newPhotoFiles.splice(index, 1);
    renderPhotosPreview();
};

window.renderPhotosPreview = function() {
    const container = document.getElementById('inspeksi-photos-preview');
    if (!container) return;
    
    let html = '';
    window.existingPhotos.forEach((url, i) => {
        html += `<div class="relative w-20 h-20"><img src="${url}" class="w-full h-full object-cover rounded-lg border border-white/10"><button onclick="removeExistingPhoto(${i})" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[14px]">close</span></button></div>`;
    });
    window.newPhotoFiles.forEach((file, i) => {
        const objectUrl = URL.createObjectURL(file);
        html += `<div class="relative w-20 h-20"><img src="${objectUrl}" class="w-full h-full object-cover rounded-lg border border-[#aac7ff]/50 opacity-80"><button onclick="removeNewPhoto(${i})" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[14px]">close</span></button></div>`;
    });
    
    if(window.existingPhotos.length === 0 && window.newPhotoFiles.length === 0) {
        container.innerHTML = '<p class="text-white/30 text-[12px] italic">Belum ada foto yang ditambahkan.</p>';
    } else {
        container.innerHTML = html;
    }
};

window.submitInspection = async function() {
    const status = document.getElementById('inspeksi-status')?.value;
    if (!status) return alert('Silakan pilih status inspeksi terlebih dahulu.');
    if (status !== 'Tidak Perlu Dicek' && window.existingPhotos.length === 0 && window.newPhotoFiles.length === 0) {
        return alert('Status "Sesuai" atau "Tidak Sesuai" mewajibkan setidaknya 1 foto dokumentasi.');
    }

    const btn = document.getElementById('fab-main'); // Visual feedback on FAB if needed
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[28px]">sync</span>';
        btn.style.opacity = '0.7';
    }

    try {
        let allPhotoUrls = [...window.existingPhotos];
        
        // Upload new photos
        if (window.newPhotoFiles.length > 0) {
            const itemForPhotoName = window.isBulkInspection 
                ? window.currentItemsData[Array.from(window.bulkSelectedItems)[0]] 
                : window.currentInspectionItem;
                
            for (let i = 0; i < window.newPhotoFiles.length; i++) {
                const file = window.newPhotoFiles[i];
                const fileName = `${Date.now()}_${itemForPhotoName.nomor_kontainer}_${i}.jpg`;
                const { error: uploadErr } = await supabase.storage.from('inspeksi_foto').upload(`inspeksi/${fileName}`, file, { cacheControl: '3600', upsert: true });
                if (uploadErr) throw uploadErr;
                const publicUrl = supabase.storage.from('inspeksi_foto').getPublicUrl(`inspeksi/${fileName}`).data.publicUrl;
                allPhotoUrls.push(publicUrl);
            }
        }

        // Update DB
        const currentProfile = window.currentProfile;
        const updatePayload = {
            status_inspeksi: status,
            foto_inspeksi: JSON.stringify(allPhotoUrls),
            tanggal_inspeksi: new Date().toISOString(),
            id_staf: currentProfile?.id_number || '',
            nama_staf: currentProfile?.nama || window.currentUser?.email || ''
        };

        if (window.isBulkInspection) {
            // BULK UPDATE
            const updatePromises = [];
            const selectedIndexes = Array.from(window.bulkSelectedItems);
            
            for (let i = 0; i < selectedIndexes.length; i++) {
                const originalIndex = selectedIndexes[i];
                const item = window.currentItemsData[originalIndex];
                
                const p = supabase.from('penerimaan_kapal').update(updatePayload).eq('id', item.id);
                updatePromises.push(p);

                const updatedItem = { ...item, ...updatePayload };
                setTimeout(() => window.pushToWecom(null, updatedItem, originalIndex), i * 200 + 100); 
            }
            await Promise.all(updatePromises);
            
            window.bulkSelectedItems.clear();
            window.updateBulkUI();
        } else {
            // SINGLE UPDATE
            const { error: dbError } = await supabase.from('penerimaan_kapal').update(updatePayload).eq('id', window.currentInspectionItem.id);
            if (dbError) throw dbError;
            
            // Auto push ke WeCom setelah berhasil simpan (fire and forget)
            const updatedItem = { ...window.currentInspectionItem, ...updatePayload };
            setTimeout(() => pushToWecom(null, updatedItem), 100);
        }

        // Tampilkan pesan sukses & update UI state
        if (btn) {
            btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Berhasil Disimpan!';
            btn.style.background = '#10B981';
            btn.style.color = '#fff';
        }

        setTimeout(() => {
            closePanel('panel-inspection');
            // Refresh list barang di panel sebelumnya
            window.openContainer(currentContainer);
        }, 1500);

    } catch (e) {
        console.error(e);
        alert('Gagal menyimpan inspeksi: ' + e.message);
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
};

window.pushToWecom = async function(btnElement, itemData, specificItemIndex = null) {
    const item = itemData || window.currentInspectionItem;
    if (!item) return;
    
    // Construct WeCom payload exactly like mobile app
    let noKapal = '';
    if (item.nama_file) {
        const cleanFileName = item.nama_file.replace('.xlsx', '').replace('.xls', '');
        const match = cleanFileName.match(/\d+/);
        noKapal = match ? match[0] : cleanFileName;
    }
    
    let wecomStatus = '';
    if (item.status_inspeksi === 'Sesuai') wecomStatus = '[Sesuai / 合格]';
    else if (item.status_inspeksi === 'Tidak Sesuai') wecomStatus = '[Tidak Sesuai / 不合格]';
    else if (item.status_inspeksi === 'Tidak Perlu Dicek') wecomStatus = '[Barang Tidak Perlu Dicek / 物品无需检查]';
    
    const itemNum = typeof specificItemIndex === 'number' ? (specificItemIndex + 1) : (typeof window.currentInspectionIndex === 'number' ? (window.currentInspectionIndex + 1) : '');
    const stafText = item.id_staf ? `${item.nama_staf}/${item.id_staf}` : (item.nama_staf || 'Staf Web');
    const text = `v${noKapal} ${item.nomor_kontainer || currentContainer} ${itemNum} ${wecomStatus}`.replace(/\s+/g, ' ').trim();
    const fullText = `${stafText}\n${text}`;
    
    let photos = [];
    if (item.foto_inspeksi) { try { photos = JSON.parse(item.foto_inspeksi); } catch(_) { photos = [item.foto_inspeksi]; } }

    const payload = {
        text: fullText,
        imageUrls: photos
    };

    try {
        let originalHtml = '';
        if (btnElement) {
            originalHtml = btnElement.innerHTML;
            btnElement.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Mengirim...';
            btnElement.disabled = true;
        }

        const { error } = await supabase.from('wecom_queue').insert({ payload: payload });
        if (error) throw error;
        
        if (btnElement) {
            btnElement.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Antrean Masuk';
            btnElement.style.background = '#10B981';
            btnElement.style.color = '#fff';
            setTimeout(() => { btnElement.innerHTML = originalHtml; btnElement.disabled = false; btnElement.style.background = '#003064'; btnElement.style.color = '#aac7ff'; }, 3000);
        }
    } catch (e) {
        console.error(e);
        alert('Gagal mengirim ke WeCom: ' + e.message);
    }
};

// ── PROFIL ──
function loadProfileUI() {
    const el = document.getElementById('tab-profil');
    const nama = currentProfile?.nama || currentUser?.email || 'Tanpa Nama';
    const idNum = currentProfile?.id_number || '-';
    const role = (currentProfile?.role || 'staf').toUpperCase();
    const avatar = currentUser?.user_metadata?.avatar_url;
    const isLight = document.documentElement.classList.contains('light-theme');
    const themeIcon = isLight ? 'dark_mode' : 'light_mode';
    const themeColor = isLight ? 'text-indigo-400' : 'text-yellow-500';
    const themeText = isLight ? 'Mode Gelap' : 'Mode Terang';

    el.innerHTML = `<div class="flex flex-col gap-5 pb-8">
<div class="flex flex-col items-center gap-3 pt-4 pb-2">
<div class="w-24 h-24 rounded-full border-2 border-white/20 flex items-center justify-center overflow-hidden shrink-0" style="background:rgba(170,199,255,0.1)">${avatar?`<img src="${avatar}" class="w-full h-full object-cover">`:'<span class="material-symbols-outlined text-[50px] text-[#aac7ff]">person</span>'}</div>
<div class="text-center"><p class="text-white font-bold text-[20px]">${nama}</p><p class="text-white/50 text-[13px] mt-1">ID: ${idNum} | ${role}</p></div>
</div>
<div class="glass-card overflow-hidden">
<button class="w-full flex items-center gap-4 p-4 active:bg-white/5 transition-colors" onclick="showChangeNameDialog()"><span class="material-symbols-outlined text-blue-300">person_outline</span><span class="text-white font-semibold text-[14px] flex-1 text-left">Ganti Nama</span><span class="material-symbols-outlined text-white/30">chevron_right</span></button>
<div class="h-px bg-white/5 mx-4"></div>
<button class="w-full flex items-center gap-4 p-4 active:bg-white/5 transition-colors" onclick="showChangePasswordDialog()"><span class="material-symbols-outlined text-blue-300">lock_outline</span><span class="text-white font-semibold text-[14px] flex-1 text-left">Ganti Password</span><span class="material-symbols-outlined text-white/30">chevron_right</span></button>
<div class="h-px bg-white/5 mx-4"></div>
<button class="w-full flex items-center gap-4 p-4 active:bg-white/5 transition-colors" onclick="toggleTheme()"><span class="material-symbols-outlined ${themeColor}" id="theme-icon">${themeIcon}</span><span class="text-white font-semibold text-[14px] flex-1 text-left" id="theme-text">${themeText}</span><span class="material-symbols-outlined text-white/30">chevron_right</span></button>
</div>
<div class="glass-card overflow-hidden"><button class="w-full flex items-center gap-4 p-4 active:bg-white/5 transition-colors" onclick="handleLogout()"><span class="material-symbols-outlined" style="color:#f87171">logout</span><span class="font-bold text-[14px]" style="color:#f87171">Keluar</span></button></div>
</div>`;
}

window.toggleTheme = function() {
    const htmlEl = document.documentElement;
    const isLight = htmlEl.classList.toggle('light-theme');
    
    // Save preference
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    // Update UI if in profile tab
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (icon && text) {
        if (isLight) {
            icon.textContent = 'dark_mode';
            icon.classList.remove('text-yellow-500');
            icon.classList.add('text-indigo-400');
            text.textContent = 'Mode Gelap';
        } else {
            icon.textContent = 'light_mode';
            icon.classList.remove('text-indigo-400');
            icon.classList.add('text-yellow-500');
            text.textContent = 'Mode Terang';
        }
    }
};

// Auto-load saved theme on boot
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.classList.add('light-theme');
    }
});
window.handleLogout = async () => { if(confirm('Apakah Anda yakin ingin keluar?')) await logout(); };
window.showChangeNameDialog = () => {
    const n = prompt('Masukkan nama baru:', currentProfile?.nama||'');
    if (n && n.trim() && n.trim() !== currentProfile?.nama) {
        supabase.from('profiles').upsert({id:currentUser.id,nama:n.trim()}).then(({error}) => {
            if(error){alert('Gagal: '+error.message);return;}
            currentProfile.nama = n.trim(); loadProfileUI(); alert('Nama berhasil diubah!');
        });
    }
};
window.showChangePasswordDialog = () => {
    const p = prompt('Masukkan password baru:');
    if (p && p.trim().length >= 6) {
        supabase.auth.updateUser({password:p.trim()}).then(({error}) => {
            if(error){alert('Gagal: '+error.message);return;}
            alert('Password berhasil diubah!');
        });
    } else if (p !== null) alert('Password harus minimal 6 karakter.');
};

window.openBulkInspection = function() {
    if (window.bulkSelectedItems.size === 0) return alert('Pilih minimal 1 barang terlebih dahulu.');
    
    window.isBulkInspection = true;
    
    const count = window.bulkSelectedItems.size;
    document.getElementById('panel-inspection-title').textContent = `${count} Barang Terpilih`;
    document.getElementById('panel-inspection-subtitle').textContent = currentContainer;
    
    window.existingPhotos = [];
    window.newPhotoFiles = [];
    
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    let detailHTML = '';
    const selectedIndexes = Array.from(window.bulkSelectedItems);
    
    selectedIndexes.forEach(index => {
        const item = window.currentItemsData[index];
        const safeNama = escapeHtml(item.nama_material || 'Tanpa Nama');
        const safeKet = escapeHtml(item.keterangan || '');
        
        detailHTML += `
<div class="rounded-[20px] p-5 mb-5 bg-[#1C212D] border border-white/5">
    <div class="flex items-start gap-4">
        <span class="text-white/70 text-[16px] font-medium pt-1">${index + 1}</span>
        <div class="flex-1 text-[16px] text-white/90 leading-relaxed font-medium whitespace-pre-wrap">${safeNama}${safeKet ? '\\n' + safeKet : ''}</div>
        <div class="shrink-0 bg-[#3B4966] text-[#AAC7FF] px-3 py-1 rounded-[10px] text-[14px] font-bold mt-1">
            ${escapeHtml(item.jumlah_data) || '-'}
        </div>
    </div>
</div>`;
    });
    
    detailHTML += `<div id="inspeksi-photos-preview" class="flex flex-wrap gap-2 mb-32"></div>`;
    
    let formHTML = `
<!-- Full screen backdrop overlay for SpeedDial -->
<div id="speed-dial-overlay" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden transition-opacity opacity-0" onclick="toggleSpeedDial()"></div>

<div class="fixed bottom-0 left-0 w-full p-4 flex items-end justify-between z-50 pointer-events-none" style="max-width: 448px">
    <!-- Status Dropdown (pointer-events-auto) -->
    <div class="flex-1 mr-4 pointer-events-auto mb-2">
        <div class="relative bg-[#1C212D] border border-white/10 rounded-xl">
            <select id="inspeksi-status" class="w-full bg-transparent text-white p-4 pr-10 text-[15px] outline-none cursor-pointer appearance-none">
                <option value="" disabled selected>Pilih Status...</option>
                <option value="Sesuai">Sesuai / 合格</option>
                <option value="Tidak Sesuai">Tidak Sesuai / 不合格</option>
            </select>
            <span class="material-symbols-outlined absolute right-4 top-4 text-white/50 pointer-events-none">expand_more</span>
        </div>
    </div>

    <!-- Speed Dial FAB (pointer-events-auto) -->
    <div class="relative pointer-events-auto flex flex-col items-end justify-end pb-2">
        <!-- Menu Items (hidden by default) -->
        <div id="speed-dial-menu" class="hidden flex-col items-end gap-4 mb-4 transition-all">
            
            <button onclick="setSkipItem()" class="flex items-center gap-4 active:scale-95 transition-transform">
                <span class="bg-[#2A2D36] text-white/80 px-4 py-2 rounded-lg text-[14px] font-medium shadow-md">skip_item</span>
                <div class="w-12 h-12 rounded-full bg-[#FCD34D] text-black flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[24px]">block</span></div>
            </button>

            <label class="flex items-center gap-4 cursor-pointer active:scale-95 transition-transform">
                <span class="bg-[#2A2D36] text-white/80 px-4 py-2 rounded-lg text-[14px] font-medium shadow-md">Buka Kamera</span>
                <div class="w-12 h-12 rounded-full bg-white text-[#84A9FF] flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[24px]">photo_camera</span></div>
                <input type="file" accept="image/*" capture="environment" multiple class="hidden" onchange="handlePhotoSelect(event); window.toggleSpeedDial();">
            </label>

            <label class="flex items-center gap-4 cursor-pointer active:scale-95 transition-transform">
                <span class="bg-[#2A2D36] text-white/80 px-4 py-2 rounded-lg text-[14px] font-medium shadow-md">Pilih dari Galeri</span>
                <div class="w-12 h-12 rounded-full bg-white text-[#84A9FF] flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[24px]">photo_library</span></div>
                <input type="file" id="inspeksi-upload" accept="image/*" multiple class="hidden" onchange="handlePhotoSelect(event); window.toggleSpeedDial();">
            </label>

            <button onclick="submitInspection()" class="flex items-center gap-4 active:scale-95 transition-transform">
                <span class="bg-[#2A2D36] text-white/80 px-4 py-2 rounded-lg text-[14px] font-medium shadow-md">save_upload</span>
                <div class="w-12 h-12 rounded-full bg-[#4ADE80] text-white flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-[24px]">cloud_upload</span></div>
            </button>
            
        </div>
        
        <!-- Main FAB -->
        <button onclick="window.toggleSpeedDial()" id="fab-main" class="w-14 h-14 rounded-full bg-[#84A9FF] text-[#001D40] shadow-xl flex items-center justify-center transition-transform active:scale-90 relative z-50">
            <span class="material-symbols-outlined text-[28px] transition-transform duration-300" id="fab-icon">menu</span>
        </button>
    </div>
</div>
`;

    document.getElementById('inspection-content').innerHTML = detailHTML + formHTML;
    renderPhotosPreview();
    openPanel('panel-inspection');
};

// ── MANAJEMEN AKUN (MOBILE ADMIN ONLY) ──
function initUserManagementMobile() {
    loadUsersMobile();
    
    document.getElementById('btn-add-user-mobile')?.addEventListener('click', () => {
        openMobileModal(`
            <h3 class="text-white font-bold text-lg mb-4">Tambah Pengguna Baru</h3>
            <div class="flex flex-col gap-3">
                <input type="text" id="mu-nama" placeholder="Nama Lengkap" class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white outline-none focus:border-white/40">
                <input type="email" id="mu-email" placeholder="Email" class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white outline-none focus:border-white/40">
                <input type="password" id="mu-password" placeholder="Password (Min 6 karakter)" class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white outline-none focus:border-white/40">
                <select id="mu-role" class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white outline-none focus:border-white/40">
                    <option value="staff" class="text-black">Staff</option>
                    <option value="admin" class="text-black">Admin</option>
                </select>
                <div class="flex gap-2 mt-4">
                    <button onclick="closeMobileModal()" class="flex-1 py-3 rounded-xl font-bold text-white/70 active:bg-white/10">Batal</button>
                    <button onclick="submitAddUserMobile(this)" class="flex-1 py-3 rounded-xl font-bold bg-green-500 text-white active:bg-green-600">Simpan</button>
                </div>
            </div>
        `);
    });
}

async function loadUsersMobile() {
    const listEl = document.getElementById('user-list-mobile');
    if (!listEl) return;
    
    listEl.innerHTML = '<div class="text-center text-white/50 py-10"><span class="material-symbols-outlined animate-spin text-3xl">sync</span><p>Memuat Pengguna...</p></div>';
    
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    if (error) {
        listEl.innerHTML = `<div class="text-red-400 text-center py-6">${error.message}</div>`;
        return;
    }
    
    if (!data || data.length === 0) {
        listEl.innerHTML = `<div class="text-white/50 text-center py-6">Belum ada akun.</div>`;
        return;
    }
    
    let html = '';
    for (const u of data) {
        const isAdmin = u.role === 'admin';
        const isSelf = u.id === currentUser.id;
        
        html += `
        <div class="glass-card p-4 flex flex-col gap-3">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="text-white font-bold text-[15px]">${u.nama || 'Tanpa Nama'}</h4>
                    <p class="text-white/50 text-[12px]">${u.email}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-[11px] font-bold ${isAdmin ? 'bg-primary-container text-on-primary-container' : 'bg-white/10 text-white'}">${isAdmin ? 'Admin' : 'Staff'}</span>
            </div>
            ${!isSelf ? `
            <div class="flex gap-2 mt-2">
                <button onclick="window.changeRoleMobile('${u.id}', '${u.nama}', '${u.role}')" class="flex-1 py-2 rounded-xl text-[12px] font-bold bg-blue-500/20 text-blue-400 active:bg-blue-500/30 border border-blue-500/30">Ubah Role</button>
                <button onclick="window.resetPasswordMobile('${u.id}', '${u.nama}')" class="flex-1 py-2 rounded-xl text-[12px] font-bold bg-orange-500/20 text-orange-400 active:bg-orange-500/30 border border-orange-500/30">Reset Pass</button>
                <button onclick="window.deleteUserMobile('${u.id}', '${u.nama}')" class="flex-1 py-2 rounded-xl text-[12px] font-bold bg-red-500/20 text-red-400 active:bg-red-500/30 border border-red-500/30">Hapus</button>
            </div>
            ` : '<div class="mt-2 text-white/30 text-[11px] italic">Ini adalah akun Anda saat ini</div>'}
        </div>
        `;
    }
    
    listEl.innerHTML = html;
}

window.openMobileModal = function(htmlContent) {
    const overlay = document.getElementById('mobile-modal-overlay');
    const content = document.getElementById('mobile-modal-content');
    content.innerHTML = htmlContent;
    overlay.classList.remove('hidden');
    // force reflow
    overlay.getBoundingClientRect();
    overlay.classList.remove('opacity-0');
    content.classList.remove('scale-95');
};

window.closeMobileModal = function() {
    const overlay = document.getElementById('mobile-modal-overlay');
    const content = document.getElementById('mobile-modal-content');
    overlay.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => overlay.classList.add('hidden'), 200);
};

window.submitAddUserMobile = async function(btn) {
    const nama = document.getElementById('mu-nama').value.trim();
    const email = document.getElementById('mu-email').value.trim();
    const password = document.getElementById('mu-password').value;
    const role = document.getElementById('mu-role').value;
    
    if (!nama || !email || !password) return alert('Mohon isi semua field!');
    if (password.length < 6) return alert('Password minimal 6 karakter!');
    
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span>';
    btn.disabled = true;
    
    try {
        const { error } = await supabase.rpc('admin_create_user', {
            email: email,
            password: password,
            raw_app_meta_data: { role: role },
            user_nama: nama
        });
        if (error) throw error;
        alert('Pengguna berhasil ditambahkan!');
        closeMobileModal();
        loadUsersMobile();
    } catch(err) {
        alert('Gagal: ' + err.message);
        btn.innerHTML = origHtml;
        btn.disabled = false;
    }
};

window.deleteUserMobile = async function(uid, nama) {
    if (!confirm(`Yakin ingin MENGHAPUS pengguna ${nama}?`)) return;
    try {
        const { error } = await supabase.rpc('admin_delete_user', { uid: uid });
        if (error) throw error;
        alert('Pengguna terhapus!');
        loadUsersMobile();
    } catch(err) {
        alert('Gagal menghapus: ' + err.message);
    }
};

window.resetPasswordMobile = function(uid, nama) {
    openMobileModal(`
        <h3 class="text-white font-bold text-lg mb-4">Reset Password</h3>
        <p class="text-white/70 text-sm mb-4">Masukkan password baru untuk <b>${nama}</b>:</p>
        <input type="password" id="mu-new-pass" placeholder="Password Baru (Min 6)" class="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white outline-none focus:border-white/40 mb-4">
        <div class="flex gap-2">
            <button onclick="closeMobileModal()" class="flex-1 py-3 rounded-xl font-bold text-white/70 active:bg-white/10">Batal</button>
            <button onclick="submitResetPassMobile('${uid}', this)" class="flex-1 py-3 rounded-xl font-bold bg-orange-500 text-white active:bg-orange-600">Reset</button>
        </div>
    `);
};

window.submitResetPassMobile = async function(uid, btn) {
    const pass = document.getElementById('mu-new-pass').value;
    if (pass.length < 6) return alert('Minimal 6 karakter');
    
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span>';
    btn.disabled = true;
    
    try {
        const { error } = await supabase.rpc('admin_reset_password', {
            uid: uid,
            new_password: pass
        });
        if (error) throw error;
        alert('Password berhasil direset!');
        closeMobileModal();
    } catch(err) {
        alert('Gagal reset: ' + err.message);
        btn.innerHTML = origHtml;
        btn.disabled = false;
    }
};

window.changeRoleMobile = async function(uid, nama, currentRole) {
    const newRole = currentRole === 'admin' ? 'staf' : 'admin';
    if (!confirm(`Yakin ingin mengubah role ${nama} menjadi ${newRole.toUpperCase()}?`)) return;
    
    try {
        const { error } = await supabase.rpc('admin_change_role', { uid: uid, new_role: newRole });
        if (error) throw error;
        alert(`Role ${nama} berhasil diubah menjadi ${newRole.toUpperCase()}!`);
        loadUsersMobile();
    } catch(err) {
        alert('Gagal mengubah role: ' + err.message);
    }
};
