import { supabase } from './supabaseClient.js';

window.getSamplingStandard = function(itemName, qty) {
    if (!qty || isNaN(qty)) return { pct: 0, count: 0, category: 'Tidak Diketahui' };
    const q = parseInt(qty);
    if (q <= 0) return { pct: 0, count: 0, category: 'Tidak Diketahui' };

    const name = (itemName || '').toLowerCase();
    
    // Group C: Pemadam, Pompa, Valve
    const isGroupC = name.includes('pemadam') || name.includes('apar') || name.includes('pompa') || name.includes('pump') || name.includes('valve') || name.includes('katup');
    
    // Group B: APD, Oli, Sparepart, Perkakas, Las
    const isGroupB = name.includes('apd') || name.includes('oli') || name.includes('pelumas') || name.includes('sparepart') || name.includes('suku cadang') || name.includes('perkakas') || name.includes('las') || name.includes('welding') || name.includes('sarung tangan') || name.includes('sarung') || name.includes('safety') || name.includes('sepatu') || name.includes('helm') || name.includes('kacamata') || name.includes('masker') || name.includes('earplug');
    
    // Group D: Elektronik, Bahan Kimia, Cat, Lab, Air
    const isGroupD = name.includes('elektronik') || name.includes('kimia') || name.includes('chemical') || name.includes('cat') || name.includes('paint') || name.includes('lab') || name.includes('air') || name.includes('water');
    
    let pct = 1;
    let catStr = 'Jenis Lainnya (Umum)';
    
    if (isGroupC) {
        catStr = 'Pompa, Valve & Pemadam';
        if (q <= 10) pct = 100;
        else if (q <= 50) pct = 30;
        else if (q <= 100) pct = 25;
        else if (q <= 500) pct = 20;
        else if (q <= 1000) pct = 15;
        else if (q <= 5000) pct = 12;
        else if (q <= 10000) pct = 8;
        else pct = 3;
    } else if (isGroupB) {
        catStr = 'APD, Oli, Sparepart & Perkakas';
        if (q <= 10) pct = 100;
        else if (q <= 50) pct = 30;
        else if (q <= 100) pct = 25;
        else if (q <= 500) pct = 20;
        else if (q <= 1000) pct = 15;
        else if (q <= 5000) pct = 10;
        else if (q <= 10000) pct = 5;
        else pct = 2; 
    } else if (isGroupD) {
        catStr = 'Kimia, Elektronik & Khusus';
        if (q <= 10) pct = 100;
        else if (q <= 50) pct = 30;
        else if (q <= 100) pct = 25;
        else if (q <= 500) pct = 20;
        else if (q <= 1000) pct = 12;
        else if (q <= 5000) pct = 8;
        else if (q <= 10000) pct = 3;
        else pct = 1;
    } else {
        // Default Group A
        if (q <= 10) pct = 100;
        else if (q <= 50) pct = 30;
        else if (q <= 100) pct = 20;
        else if (q <= 500) pct = 10;
        else if (q <= 1000) pct = 8;
        else if (q <= 5000) pct = 5;
        else if (q <= 10000) pct = 3;
        else pct = 1;
    }

    if (q > 10000 && (name.includes('perkakas') || name.includes('las') || name.includes('welding'))) {
        pct = 1;
    }

    let count = Math.ceil((q * pct) / 100);
    return { pct, count, category: catStr };
};

document.addEventListener('DOMContentLoaded', async () => {
    loadSamplingData();
});

window.renderSamplingDashboard = loadSamplingData;

async function loadSamplingData() {
    const tbody = document.getElementById('sampling-table-body');
    const headerCount = document.getElementById('sampling-count');
    
    // Clear selection
    window.bulkSamplingSelected = new Set();
    window.updateBulkSamplingUI();
    
    try {
        // Fetch items with status 'Perlu Sampling' or those that have sampling results
        let countQuery = supabase.from('penerimaan_kapal')
            .select('*', { count: 'exact', head: true })
            .or('status_inspeksi.eq.Perlu Sampling,keterangan.ilike.%HASIL SAMPLING:%');
            
        const { count, error: countErr } = await countQuery;
        if (countErr) throw countErr;
        
        if (count === 0) {
            headerCount.textContent = '0 Barang Perlu Sampling';
            tbody.innerHTML = `<tr>
                <td colspan="10" class="py-12 text-center text-on-surface-variant">
                    <span class="material-symbols-outlined text-[48px] mb-2 opacity-50">science</span>
                    <p>Tidak ada barang yang menunggu sampling.</p>
                </td>
            </tr>`;
            return;
        }

        const PAGE_SIZE = 1000;
        const promises = [];
        
        for (let from = 0; from < count; from += PAGE_SIZE) {
            promises.push(
                supabase.from('penerimaan_kapal')
                .select('id, nama_file, nomor_kontainer, supplier, nama_material, keterangan, jumlah_data, satuan, jumlah_kemasan, satuan_kemasan, tanggal_inspeksi, status_inspeksi, foto_inspeksi')
                .or('status_inspeksi.eq.Perlu Sampling,keterangan.ilike.%HASIL SAMPLING:%')
                .order('nama_file', { ascending: true })
                .order('nomor_kontainer', { ascending: true })
                .order('id', { ascending: true })
                .range(from, from + PAGE_SIZE - 1)
            );
        }
        
        const results = await Promise.all(promises);
        let items = [];
        for (const res of results) {
            if (res.error) throw res.error;
            if (res.data) items = items.concat(res.data);
        }
        
        // Render to table
        window.currentItemsData = items;
        headerCount.textContent = `${items.length} Barang Perlu Sampling`;
        
        // Pre-calculate rowspans for Kemasan
        const rowspans = new Array(items.length).fill(1);
        for (let i = 0; i < items.length; i++) {
            if (rowspans[i] === 0) continue;
            const currentKemasanKey = `${items[i].jumlah_kemasan || ''}-${items[i].satuan_kemasan || ''}-${items[i].nomor_kontainer || ''}`;
            let span = 1;
            if (currentKemasanKey !== '--' && items[i].jumlah_kemasan) {
                for (let j = i + 1; j < items.length; j++) {
                    const nextKemasanKey = `${items[j].jumlah_kemasan || ''}-${items[j].satuan_kemasan || ''}-${items[j].nomor_kontainer || ''}`;
                    if (currentKemasanKey === nextKemasanKey) {
                        span++;
                        rowspans[j] = 0;
                    } else {
                        break;
                    }
                }
            }
            rowspans[i] = span;
        }

        // Pre-calculate rowspans for QTY (grouped by nama_material)
        const qtyRowspans = new Array(items.length).fill(1);
        const qtyTotals = new Array(items.length).fill(0);
        
        for (let i = 0; i < items.length; i++) {
            if (qtyRowspans[i] === 0) continue;
            const currentMaterial = items[i].nama_material ? items[i].nama_material.trim().toLowerCase() : '';
            let span = 1;
            let totalQty = parseFloat(items[i].jumlah_data) || 0;
            
            if (currentMaterial) {
                for (let j = i + 1; j < items.length; j++) {
                    const nextMaterial = items[j].nama_material ? items[j].nama_material.trim().toLowerCase() : '';
                    if (currentMaterial === nextMaterial) {
                        span++;
                        totalQty += parseFloat(items[j].jumlah_data) || 0;
                        qtyRowspans[j] = 0;
                    } else {
                        break;
                    }
                }
            }
            qtyRowspans[i] = span;
            qtyTotals[i] = totalQty;
        }


        let html = '';
        items.forEach((item, index) => {
            let shipNum = '';
            if (item.nama_file) {
                const match = item.nama_file.match(/\d+/);
                if (match) shipNum = match[0];
            }
            const cont = item.nomor_kontainer || 'Tanpa Kontainer';
            const combinedShipCont = shipNum ? `V${shipNum} (${cont})` : cont;
            
            
            const supplier = item.supplier || '-';
            
            // Parse existing jumlah rusak dari keterangan jika ada
            let rusakStr = '-';
            let rawRusak = 0;
            let hasResult = false;
            let cleanKet = item.keterangan || '';
            if (cleanKet.includes('HASIL SAMPLING:')) {
                const m = cleanKet.match(/HASIL SAMPLING:\s*(\d+)/);
                if (m) {
                    rawRusak = parseInt(m[1]);
                    rusakStr = `<span class="text-red-400 font-bold">${rawRusak} Rusak</span>`;
                    hasResult = true;
                }
                // Sembunyikan tulisan HASIL SAMPLING dari keterangan agar tidak dobel
                cleanKet = cleanKet.replace(/HASIL SAMPLING:\s*\d+/g, '').trim();
            }
            
            // Format Tanggal Sampling
            let tglStr = '-';
            if (item.tanggal_inspeksi && rusakStr !== '-') {
                const d = new Date(item.tanggal_inspeksi);
                tglStr = d.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'}) + '<br><span class="text-on-surface-variant text-[11px]">' + d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) + '</span>';
            } else if (item.status_inspeksi === 'Perlu Sampling' && item.tanggal_inspeksi) {
                 const d = new Date(item.tanggal_inspeksi);
                 tglStr = '<span class="text-[11px] text-on-surface-variant">Diminta:<br>' + d.toLocaleDateString('id-ID', {day:'2-digit', month:'short'}) + '</span>';
            }
            
            const safeNama = escapeHtml(item.nama_material || 'Tanpa Nama');
            const safeKet = escapeHtml(cleanKet);
            const fullNama = safeNama + (safeKet ? '<br><span class="text-on-surface-variant text-[11px]">' + safeKet + '</span>' : '');
            
            const qtyText = escapeHtml(item.jumlah_data) || '-';
            const unitText = escapeHtml(item.satuan) || 'PCS';
            const kemasanText = escapeHtml(item.jumlah_kemasan) || '-';
            const kemasanUnit = escapeHtml(item.satuan_kemasan) || '';
            
            const samp = window.getSamplingStandard(item.nama_material, item.jumlah_data);
            
            let photoStr = '-';
            if (item.foto_inspeksi) {
                try {
                    const photos = JSON.parse(item.foto_inspeksi);
                    if (photos.length > 0) {
                        photoStr = `<a href="${photos[0]}" target="_blank"><img src="${photos[0]}" class="w-12 h-12 object-cover rounded-md mx-auto border border-surface-variant cursor-pointer hover:scale-105 transition-transform" title="Klik untuk lihat foto"></a>`;
                    }
                } catch(e) {
                    if(item.foto_inspeksi.includes('http')) {
                        photoStr = `<a href="${item.foto_inspeksi}" target="_blank"><img src="${item.foto_inspeksi}" class="w-12 h-12 object-cover rounded-md mx-auto border border-surface-variant cursor-pointer hover:scale-105 transition-transform" title="Klik untuk lihat foto"></a>`;
                    }
                }
            }
            
            html += `
            <tr class="hover:bg-surface-container transition-colors group border-b border-surface-variant cursor-pointer" onclick="window.toggleSamplingItem('${item.id}', event)">
                <td class="py-3 px-4 text-center">
                    <input type="checkbox" id="sampling-checkbox-${item.id}" value="${item.id}" class="sampling-row-checkbox w-4 h-4 rounded border-surface-variant bg-[#10131B] checked:bg-[#aac7ff] cursor-pointer" onclick="event.stopPropagation(); window.toggleSamplingItem('${item.id}', event)">
                </td>
                <td class="py-3 px-4 text-center text-on-surface-variant font-medium whitespace-nowrap">${index + 1}</td>
                <td class="py-3 px-4">
                    <div class="font-bold text-primary whitespace-nowrap mb-1">${combinedShipCont}</div>
                    <div class="text-on-surface-variant text-[12px] truncate max-w-[250px]" title="${supplier}"><span class="material-symbols-outlined text-[14px] align-middle">storefront</span> ${supplier}</div>
                </td>
                <td class="py-3 px-4 font-medium whitespace-pre-wrap">${fullNama}</td>
                ${qtyRowspans[index] > 0 ? `
                <td class="py-3 px-4 text-center border-l border-surface-variant align-middle" rowspan="${qtyRowspans[index]}">
                    <div class="flex flex-col items-center gap-1">
                        <div class="font-medium whitespace-nowrap mb-1">${qtyTotals[index]} ${unitText}</div>
                        <span class="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md inline-block w-fit">
                            ${window.getSamplingStandard(item.nama_material, qtyTotals[index]).pct}%
                        </span>
                        <span class="text-on-surface-variant text-[11px]">${window.getSamplingStandard(item.nama_material, qtyTotals[index]).count} ${window.getSamplingStandard(item.nama_material, qtyTotals[index]).pct > 0 && unitText.toLowerCase() === 'pcs' ? 'PCS' : unitText}</span>
                    </div>
                </td>
                ` : ''}
                ${rowspans[index] > 0 ? `
                <td class="py-3 px-4 text-center border-l border-surface-variant align-middle" rowspan="${rowspans[index]}">
                    <div class="font-bold text-[#4ADE80] whitespace-nowrap">${kemasanText} ${kemasanUnit}</div>
                </td>
                ` : ''}
                <td class="py-3 px-4 text-center text-on-surface-variant">${rusakStr}</td>
                <td class="py-3 px-4 text-center">${photoStr}</td>
                <td class="py-3 px-4 text-center text-on-surface-variant leading-tight">${tglStr}</td>
                <td class="py-3 px-4 text-center">
                    ${hasResult ? `
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="window.openEditSamplingModal('${item.id}', ${rawRusak})" class="text-[#aac7ff] hover:text-[#84a9ff] transition-colors p-1" title="Edit Sampling">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button onclick="window.deleteSamplingResult('${item.id}')" class="text-red-400 hover:text-red-500 transition-colors p-1" title="Hapus Hasil">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                    ` : '-'}
                </td>
            </tr>`;
        });
        
        tbody.innerHTML = html;
        window.updateBulkSamplingUI();
        
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="10" class="py-6 text-center text-red-400">Gagal memuat data: ${err.message}</td></tr>`;
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.openEditSamplingModal = function(id, currentRusak) {
    window.currentEditSamplingId = id;
    document.getElementById('edit-sampling-rusak').value = currentRusak;
    document.getElementById('modal-edit-sampling').classList.remove('hidden');
    
    document.getElementById('btn-save-edit-sampling').onclick = async function() {
        const val = document.getElementById('edit-sampling-rusak').value;
        if (val === '') return;
        
        const rusakInt = parseInt(val);
        const item = window.currentItemsData.find(r => String(r.id) === String(id));
        if (!item) return;

        const btn = document.getElementById('btn-save-edit-sampling');
        const origText = btn.innerHTML;
        btn.innerHTML = 'Menyimpan...';
        btn.disabled = true;

        try {
            let cleanKet = item.keterangan || '';
            cleanKet = cleanKet.replace(/HASIL SAMPLING:\s*\d+/g, '').trim();
            const newKet = `HASIL SAMPLING: ${rusakInt}` + (cleanKet ? `\n${cleanKet}` : '');
            const newStatus = rusakInt > 0 ? 'Tidak Sesuai' : 'Sesuai';

            const { error } = await supabase.from('penerimaan_kapal')
                .update({ keterangan: newKet, status_inspeksi: newStatus })
                .eq('id', item.id);
            
            if (error) throw error;
            
            window.closeEditSamplingModal();
            loadSamplingData();
        } catch(e) {
            console.error(e);
            alert('Gagal mengedit hasil sampling: ' + e.message);
        } finally {
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    };
};

window.closeEditSamplingModal = function() {
    window.currentEditSamplingId = null;
    document.getElementById('modal-edit-sampling').classList.add('hidden');
};

window.deleteSamplingResult = async function(id) {
    if (!confirm('Keluarkan barang ini dari halaman sampling? Data barang tetap aman di Data Inventory.')) return;
    
    const item = window.currentItemsData.find(r => String(r.id) === String(id));
    if (!item) return;
    
    try {
        let cleanKet = item.keterangan || '';
        cleanKet = cleanKet.replace(/HASIL SAMPLING:\s*\d+/g, '').trim();

        const { error } = await supabase.from('penerimaan_kapal')
            .update({ 
                keterangan: cleanKet, 
                status_inspeksi: null,
                foto_inspeksi: null,
                tanggal_inspeksi: null
            })
            .eq('id', item.id);
            
        if (error) throw error;
        
        loadSamplingData();
    } catch(e) {
        console.error(e);
        alert('Gagal menghapus barang: ' + e.message);
    }
};

window.toggleSamplingItem = function(id, event) {
    if (event && event.target.tagName !== 'INPUT') {
        const cb = document.getElementById(`sampling-checkbox-${id}`);
        if (cb) {
            cb.checked = !cb.checked;
            if (cb.checked) {
                window.bulkSamplingSelected.add(String(id));
            } else {
                window.bulkSamplingSelected.delete(String(id));
            }
        }
    } else {
        const cb = document.getElementById(`sampling-checkbox-${id}`);
        if (cb && cb.checked) {
            window.bulkSamplingSelected.add(String(id));
        } else {
            window.bulkSamplingSelected.delete(String(id));
        }
    }
    window.updateBulkSamplingUI();
};

window.toggleAllSampling = function(cb) {
    const checkboxes = document.querySelectorAll('.sampling-row-checkbox');
    checkboxes.forEach(c => {
        c.checked = cb.checked;
        if (cb.checked) {
            window.bulkSamplingSelected.add(String(c.value));
        } else {
            window.bulkSamplingSelected.delete(String(c.value));
        }
    });
    window.updateBulkSamplingUI();
};

window.updateBulkSamplingUI = function() {
    const btn = document.getElementById('btn-bulk-delete');
    const countSpan = document.getElementById('bulk-delete-count');
    const allCb = document.getElementById('checkbox-all-sampling');
    
    if (btn && countSpan) {
        if (window.bulkSamplingSelected.size > 0) {
            countSpan.textContent = window.bulkSamplingSelected.size;
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }
    
    if (allCb) {
        const checkboxes = document.querySelectorAll('.sampling-row-checkbox');
        if (checkboxes.length > 0) {
            allCb.checked = window.bulkSamplingSelected.size === checkboxes.length;
        } else {
            allCb.checked = false;
        }
    }
};

window.bulkDeleteSampling = async function() {
    if (!window.bulkSamplingSelected || window.bulkSamplingSelected.size === 0) return;
    if (!confirm(`Keluarkan ${window.bulkSamplingSelected.size} barang terpilih dari halaman sampling? Data barang tetap aman di Data Inventory.`)) return;
    
    const btn = document.getElementById('btn-bulk-delete');
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[16px]">sync</span> Menghapus...';
    btn.disabled = true;
    
    try {
        const promises = [];
        for (const id of window.bulkSamplingSelected) {
            const item = window.currentItemsData.find(r => String(r.id) === String(id));
            if (!item) continue;
            
            let cleanKet = item.keterangan || '';
            cleanKet = cleanKet.replace(/HASIL SAMPLING:\s*\d+/g, '').trim();

            promises.push(
                supabase.from('penerimaan_kapal')
                    .update({ 
                        keterangan: cleanKet, 
                        status_inspeksi: null,
                        foto_inspeksi: null,
                        tanggal_inspeksi: null
                    })
                    .eq('id', item.id)
            );
        }
        
        const results = await Promise.all(promises);
        for (const res of results) {
            if (res.error) throw res.error;
        }
        
        window.bulkSamplingSelected.clear();
        loadSamplingData();
    } catch(e) {
        console.error(e);
        alert('Gagal menghapus barang masal: ' + e.message);
    } finally {
        if (btn) {
            btn.innerHTML = origHtml;
            btn.disabled = false;
        }
    }
};
