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
                    const rawDataAOA = window.XLSX ? window.XLSX.utils.sheet_to_json(worksheet, { header: 1 }) : XLSX.utils.sheet_to_json(worksheet, { header: 1 });

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

                // Mapping data ke format database
                const formattedData = rawJsonData.map(row => ({
                    nama_file: file.name,
                    nomor_kontainer: getVal(row, "kontainer", "柜号"),
                    pt: getVal(row, "pt", "公司"),
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
