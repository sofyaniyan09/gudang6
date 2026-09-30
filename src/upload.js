import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient.js';


function initUpload() {
    const uploadBtn = document.getElementById('btn-upload-excel');
    const fileInput = document.getElementById('excel-upload');

    if (uploadBtn && fileInput) {
        // Hapus onchange bawaan HTML jika ada (agar tidak bentrok)
        fileInput.removeAttribute('onchange');

        // Prevent attaching multiple event listeners on SPA navigation
        if (uploadBtn.dataset.uploadInitialized) return;
        uploadBtn.dataset.uploadInitialized = 'true';

        uploadBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });

        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;


            // Tampilkan indikator loading
            const originalText = uploadBtn.innerHTML;
            uploadBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">sync</span>`;
            uploadBtn.disabled = true;

            try {
                const data = new Uint8Array(await file.arrayBuffer());
                const workbook = window.XLSX ? window.XLSX.read(data, { type: 'array' }) : XLSX.read(data, { type: 'array' });
                const rawJsonData = [];
                let headerRowIndex = -1;
                
                for (const sheetName of workbook.SheetNames) {
                    const worksheet = workbook.Sheets[sheetName];
                    
                    const xlsx = window.XLSX || XLSX;
                    // Fill merged cells with the value from the top-left cell
                    if (worksheet['!merges']) {
                        worksheet['!merges'].forEach(range => {
                            const topCellRef = xlsx.utils.encode_cell({ r: range.s.r, c: range.s.c });
                            const topCell = worksheet[topCellRef];
                            if (topCell) {
                                for (let r = range.s.r; r <= range.e.r; r++) {
                                    for (let c = range.s.c; c <= range.e.c; c++) {
                                        if (r === range.s.r && c === range.s.c) continue;
                                        const cellRef = xlsx.utils.encode_cell({ r: r, c: c });
                                        worksheet[cellRef] = topCell;
                                    }
                                }
                            }
                        });
                    }

                    const rawDataAOA = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

                    // Cari baris header di sheet ini
                    for (let i = 0; i < rawDataAOA.length; i++) {
                        const row = rawDataAOA[i];
                        if (row && row.some(cell => typeof cell === 'string' && (cell.toLowerCase().includes('kontainer') || cell.includes('柜号')))) {
                            headerRowIndex = i;
                            break;
                        }
                    }

                    if (headerRowIndex !== -1) {
                        const headers = rawDataAOA[headerRowIndex];
                        for (let i = headerRowIndex + 1; i < rawDataAOA.length; i++) {
                            const rowArray = rawDataAOA[i];
                            if (!rowArray || rowArray.length === 0 || rowArray.every(cell => cell == null || cell === '')) continue;

                            const rowObj = {};
                            headers.forEach((header, index) => {
                                if (header) rowObj[String(header).trim()] = rowArray[index];
                            });
                            rawJsonData.push(rowObj);
                        }
                    }
                }

                if (rawJsonData.length === 0) {
                    alert("❌ File Excel kosong atau tabel tidak dikenali. Pastikan ada baris header yang berisi kata 'kontainer' atau '柜号'.");
                    return;
                }

                // Tampilkan semua kolom yang terdeteksi di Excel (termasuk yang tersembunyi)
                const allExcelColumns = Object.keys(rawJsonData[0] || {});

                // Helper: Cari kolom berdasarkan kata kunci (fuzzy matching dengan scoring)
                const getVal = (row, ...keywords) => {
                    let bestMatch = null;
                    let maxMatches = 0;
                    
                    Object.keys(row).forEach(k => {
                        const lowerK = k.toLowerCase();
                        
                        // Mencegah kolom kontainer yang memiliki teks "包装方式" terbaca sebagai satuan kemasan
                        if ((keywords.includes("satuan kemasan") || keywords.includes("包装方式")) && (lowerK.includes("kontainer") || lowerK.includes("柜号"))) return;
                        // Mencegah kolom satuan kemasan terbaca sebagai satuan dasar
                        if (keywords.includes("satuan") && lowerK.includes("kemasan")) return;
                        
                        // Hitung skor kecocokan: makin banyak kata kunci yang cocok, makin relevan
                        let matches = 0;
                        keywords.forEach(word => {
                            if (lowerK.includes(word.toLowerCase())) matches++;
                        });
                        
                        if (matches > maxMatches) {
                            maxMatches = matches;
                            bestMatch = k;
                        }
                    });
                    
                    return bestMatch ? row[bestMatch] : null;
                };

                // Helper: cari nama kolom Excel berdasarkan kata kunci (untuk preview saja)
                const findColName = (keywords) => {
                    const allKeys = Object.keys(rawJsonData[0] || {});
                    for (const kw of keywords) {
                        const found = allKeys.find(k => k.toLowerCase().includes(kw.toLowerCase()) || k.includes(kw));
                        if (found) return found;
                    }
                    return null;
                };

                // Mapping kolom Excel → Database untuk preview
                const columnPreview = [
                    { db: 'nomor_kontainer', excelCol: findColName(['kontainer', '柜号']) || '❌ Tidak ditemukan' },
                    { db: 'pt',              excelCol: findColName(['pt 公', ' pt', 'PT ']) || findColName(['公司']) || '❌ Tidak ditemukan' },
                    { db: 'supplier',        excelCol: findColName(['supplier', 'suplayer', 'supplayer', 'vendor', '供应商']) || '❌ Tidak ditemukan' },
                    { db: 'nama_material',   excelCol: findColName(['material', '物品名称']) || '❌ Tidak ditemukan' },
                    { db: 'jumlah_data',     excelCol: findColName(['jumlah data', '清单数量']) || '❌ Tidak ditemukan' },
                    { db: 'satuan',          excelCol: findColName(['satuan 单', ' satuan', 'satuan']) ? findColName(['satuan 单', ' satuan']) || findColName(['satuan']) : '❌ Tidak ditemukan' },
                ];

                const previewRows = columnPreview.map(c => `<tr><td style="padding:6px 12px;border:1px solid #444;color:#aaa">${c.db}</td><td style="padding:6px 12px;border:1px solid #444;color:${c.excelCol.includes('❌') ? '#ff8a80' : '#69f0ae'}">${c.excelCol}</td></tr>`).join('');
                const allColsHtml = allExcelColumns.map(c => `<span style="background:#333;padding:2px 8px;border-radius:4px;margin:2px;display:inline-block;font-size:11px">${c}</span>`).join('');

                const confirmed = await new Promise(resolve => {
                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
                    overlay.innerHTML = `
                        <div style="background:#1e1e2e;border:1px solid #444;border-radius:16px;padding:24px;max-width:600px;width:100%;color:white;max-height:90vh;overflow-y:auto">
                            <h3 style="margin:0 0 8px;font-size:18px">🔍 Preview Kolom Terdeteksi</h3>
                            <p style="color:#aaa;font-size:13px;margin:0 0 16px">File: <b>${file.name}</b> | ${rawJsonData.length} baris data</p>
                            
                            <p style="font-size:12px;color:#aaa;margin-bottom:6px">Semua kolom di Excel (termasuk tersembunyi):</p>
                            <div style="margin-bottom:16px;line-height:1.8">${allColsHtml}</div>

                            <p style="font-size:12px;color:#aaa;margin-bottom:6px">Pemetaan kolom ke database:</p>
                            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
                                <thead><tr>
                                    <th style="padding:6px 12px;border:1px solid #444;text-align:left;color:#888">Kolom Database</th>
                                    <th style="padding:6px 12px;border:1px solid #444;text-align:left;color:#888">Kolom Excel yang Ditemukan</th>
                                </tr></thead>
                                <tbody>${previewRows}</tbody>
                            </table>

                            <div style="display:flex;gap:10px">
                                <button id="btn-cancel-upload" style="flex:1;padding:10px;border-radius:8px;border:1px solid #555;background:transparent;color:white;cursor:pointer">Batal</button>
                                <button id="btn-confirm-upload" style="flex:1;padding:10px;border-radius:8px;border:none;background:#6c63ff;color:white;font-weight:bold;cursor:pointer">Upload Sekarang ✅</button>
                            </div>
                        </div>`;
                    document.body.appendChild(overlay);
                    document.getElementById('btn-confirm-upload').onclick = () => { overlay.remove(); resolve(true); };
                    document.getElementById('btn-cancel-upload').onclick = () => { overlay.remove(); resolve(false); };
                });

                if (!confirmed) {
                    uploadBtn.innerHTML = originalText;
                    uploadBtn.disabled = false;
                    return;
                }

                // Mapping data ke format database
                const formattedData = rawJsonData.map(row => ({
                    nama_file: file.name,
                    nomor_kontainer: getVal(row, "kontainer", "柜号"),
                    pt: getVal(row, "pt", "公司"),
                    supplier: getVal(row, "suplayer", "supplier", "supplayer", "vendor", "供应商"),
                    pelapor: getVal(row, "pelapor", "申报部门"),
                    nomor_kontrak: getVal(row, "kontrak", "合同"),
                    nomor_pembelian: getVal(row, "pembelian", "订单"),
                    nama_material: getVal(row, "material", "物品名称"),
                    satuan: getVal(row, "satuan", "单位"),
                    jumlah_data: getVal(row, "jumlah data", "清单数量", "jumlah"),
                    satuan_kemasan: getVal(row, "satuan kemasan", "包装方式"),
                    jumlah_kemasan: getVal(row, "jumlah kemasan", "包装件数"),
                    penanggung_jawab: getVal(row, "penanggung jawab", "负责人", "经办人"),
                    tampilan_luar: getVal(row, "tampilan luar", "外观"),
                    tes_kualitas: getVal(row, "kualitas", "质量", "材质"),
                    keterangan: getVal(row, "ket", "备注"),
                    tanggal_cek: getVal(row, "tanggal cek", "验收日期"),
                    hasil_cek: getVal(row, "hasil cek", "验收结论"),
                }));
                const totalRowsParsed = rawJsonData.length;
                
                // Konfirmasi ke user jika data yang terbaca sangat sedikit
                if (formattedData.length < 500) {
                    const proceed = confirm(`INFO SISTEM:\nSistem membaca tabel mulai dari baris ke-${headerRowIndex + 1} ke bawah.\nTotal baris yang terbaca sebagai data valid hanya: ${formattedData.length} baris.\n\nApakah Anda ingin tetap mengunggah data ini?`);
                    if (!proceed) {
                        uploadBtn.innerHTML = originalText;
                        uploadBtn.disabled = false;
                        return;
                    }
                }

                // Kirim ke Supabase dalam batch kecil (500 baris per batch)
                const BATCH_SIZE = 500;
                let totalInserted = 0;

                for (let i = 0; i < formattedData.length; i += BATCH_SIZE) {
                    const batch = formattedData.slice(i, i + BATCH_SIZE);
                    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                    const totalBatches = Math.ceil(formattedData.length / BATCH_SIZE);


                    const { error } = await supabase
                        .from('penerimaan_kapal')
                        .insert(batch);

                    if (error) {
                        throw error;
                    }

                    totalInserted += batch.length;
                }

                alert(`Sukses! ${totalInserted} baris data berhasil disimpan!`);
                window.location.reload();

            } catch (err) {

                // Tampilkan kotak error permanen di layar
                const box = document.createElement('div');
                box.style.cssText = 'position:fixed;top:10%;left:10%;width:80%;background:#ffdad6;color:#93000a;padding:30px;border-radius:10px;z-index:9999;border:2px solid red;box-shadow:0 10px 25px rgba(0,0,0,0.5)';
                box.innerHTML = `
                    <h2 style="font-size:24px;font-weight:bold;margin-bottom:15px">🚨 GAGAL UPLOAD</h2>
                    <p>Pesan error:</p>
                    <textarea style="width:100%;height:100px;font-family:monospace;padding:10px;color:black" readonly>${err.message || JSON.stringify(err)}</textarea>
                    <br><button onclick="this.parentElement.remove()" style="margin-top:15px;background:red;color:white;padding:8px 16px;border-radius:5px">Tutup</button>
                `;
                document.body.appendChild(box);
            } finally {
                uploadBtn.innerHTML = originalText;
                uploadBtn.disabled = false;
            }

            // Reset input
            event.target.value = '';
        });

    }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initUpload); } else { initUpload(); }
document.addEventListener('app:pageLoaded', () => { if (window.location.pathname.endsWith('kelola_kapal.html')) initUpload(); });
