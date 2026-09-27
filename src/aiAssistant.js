import { supabase } from './supabaseClient.js';

// Helper to fetch all rows (same as in kelolaKapal.js)
async function fetchAllData() {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('penerimaan_kapal')
            .select('nama_file, nomor_kontainer, pt, pelapor, nomor_kontrak, nomor_pembelian, nama_material, satuan, jumlah_data, penanggung_jawab, tanggal_cek, hasil_cek, status_inspeksi')
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        
        if (error) {
            console.error(error);
            break;
        }

        if (data && data.length > 0) {
            allData = allData.concat(data);
            from += PAGE_SIZE;
            if (data.length < PAGE_SIZE) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    return allData;
}

export function initAIAssistant() {
    // Inject the CSS
    const style = document.createElement('style');
    style.innerHTML = `
        #ai-fab {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 56px;
            height: 56px;
            border-radius: 28px;
            background: linear-gradient(135deg, #a78bfa, #3b82f6);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            z-index: 9999;
            transition: transform 0.2s;
        }
        #ai-fab:active { transform: scale(0.95); }
        #ai-fab:hover { transform: scale(1.05); }

        #ai-chat-panel {
            position: fixed;
            bottom: 0;
            right: 0;
            width: 100%;
            height: 100%;
            max-width: 450px;
            max-height: 800px;
            background-color: #1a1d26;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            transform: translateY(100%);
            transition: transform 0.3s ease-in-out;
            border-top-left-radius: 24px;
            border-top-right-radius: 24px;
            box-shadow: -4px 0 24px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
        }
        @media (min-width: 768px) {
            #ai-chat-panel {
                bottom: 20px;
                right: 20px;
                height: 600px;
                border-radius: 24px;
                transform: translateY(150%);
            }
        }
        #ai-chat-panel.open {
            transform: translateY(0);
        }

        .ai-header {
            padding: 16px 20px;
            background: linear-gradient(135deg, #2e1065, #1e3a8a);
            border-top-left-radius: inherit;
            border-top-right-radius: inherit;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .ai-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .ai-msg {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.5;
            word-wrap: break-word;
        }
        .ai-msg.user {
            background-color: #3b82f6;
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }
        .ai-msg.bot {
            background-color: #2d3748;
            color: #e2e8f0;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
        }
        .ai-input-area {
            padding: 16px;
            background-color: #1a1d26;
            border-top: 1px solid rgba(255,255,255,0.1);
            display: flex;
            gap: 12px;
            border-bottom-left-radius: inherit;
            border-bottom-right-radius: inherit;
            padding-bottom: max(env(safe-area-inset-bottom), 16px);
        }
        .ai-input-area input {
            flex: 1;
            background-color: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: white;
            border-radius: 20px;
            padding: 10px 16px;
            outline: none;
        }
        .ai-input-area input:focus {
            border-color: #3b82f6;
        }
        .ai-input-area button {
            background-color: #3b82f6;
            color: white;
            border: none;
            width: 42px;
            height: 42px;
            border-radius: 21px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
        .ai-input-area button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Basic Markdown Table Styles */
        .ai-msg.bot table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 8px;
            font-size: 12px;
        }
        .ai-msg.bot th, .ai-msg.bot td {
            border: 1px solid rgba(255,255,255,0.2);
            padding: 6px;
            text-align: left;
        }
        .ai-msg.bot th {
            background-color: rgba(255,255,255,0.1);
        }
    `;
    document.head.appendChild(style);

    // Inject HTML
    const html = `
        <div id="ai-fab">
            <span class="material-symbols-outlined">smart_toy</span>
        </div>
        <div id="ai-chat-panel">
            <div class="ai-header">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-white">smart_toy</span>
                    <h3 class="text-white font-bold text-[16px] m-0">Gudang AI</h3>
                </div>
                <button id="ai-close-btn" class="text-white/70 hover:text-white transition-colors bg-transparent border-none">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="ai-messages" id="ai-messages">
                <div class="ai-msg bot">Halo! Saya Gudang AI. Saya bisa membantu Anda menganalisis ribuan data barang lintas kapal dan supplier. <br><br>Cobalah bertanya:<br><b>"Berapa jumlah sarung tangan las dari semua supplier?"</b></div>
            </div>
            <div class="ai-input-area">
                <input type="text" id="ai-input" placeholder="Tanya sesuatu tentang data..." autocomplete="off">
                <button id="ai-send-btn">
                    <span class="material-symbols-outlined text-[20px]">send</span>
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    const fab = document.getElementById('ai-fab');
    const panel = document.getElementById('ai-chat-panel');
    const closeBtn = document.getElementById('ai-close-btn');
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const messages = document.getElementById('ai-messages');

    fab.addEventListener('click', () => {
        panel.classList.add('open');
        checkApiKey();
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('open');
    });

    function checkApiKey() {
        if (!localStorage.getItem('GEMINI_API_KEY')) {
            const key = prompt("Untuk mengaktifkan AI, silakan masukkan API Key Gemini Anda:");
            if (key) {
                localStorage.setItem('GEMINI_API_KEY', key);
            } else {
                appendMessage('bot', '⚠️ Anda belum memasukkan API Key. Fitur AI Chatbot tidak dapat digunakan.');
            }
        }
    }

    function appendMessage(sender, text) {
        const div = document.createElement('div');
        div.className = `ai-msg ${sender}`;
        
        if (sender === 'bot') {
            // Very simple markdown table to HTML converter
            let htmlText = text.replace(/\n/g, '<br>');
            htmlText = htmlText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            
            // Convert markdown tables
            if (htmlText.includes('|')) {
                const lines = text.split('<br>');
                let inTable = false;
                let tableHtml = '';
                let finalHtml = '';

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('|') && line.endsWith('|')) {
                        if (!inTable) {
                            inTable = true;
                            tableHtml = '<table>';
                        }
                        // Check if separator line
                        if (line.replace(/[\s|:\-]/g, '').length === 0) continue;
                        
                        const cells = line.split('|').slice(1, -1).map(c => c.trim());
                        tableHtml += '<tr>';
                        const tag = (i > 0 && lines[i-1].replace(/[\s|:\-]/g, '').length === 0) ? 'td' : (tableHtml === '<table>' ? 'th' : 'td');
                        
                        cells.forEach(cell => {
                            tableHtml += `<${tag}>${cell.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</${tag}>`;
                        });
                        tableHtml += '</tr>';
                    } else {
                        if (inTable) {
                            inTable = false;
                            finalHtml += tableHtml + '</table>';
                            tableHtml = '';
                        }
                        finalHtml += line.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') + '<br>';
                    }
                }
                if (inTable) finalHtml += tableHtml + '</table>';
                htmlText = finalHtml;
            }

            div.innerHTML = htmlText;
        } else {
            div.textContent = text;
        }
        
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    async function handleSend() {
        const text = input.value.trim();
        if (!text) return;
        
        let apiKey = localStorage.getItem('GEMINI_API_KEY');
        if (!apiKey) {
            checkApiKey();
            apiKey = localStorage.getItem('GEMINI_API_KEY');
            if (!apiKey) return;
        }

        appendMessage('user', text);
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;

        const loadingId = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-msg bot';
        loadingDiv.id = loadingId;
        loadingDiv.innerHTML = '<span class="material-symbols-outlined animate-spin inline-block align-middle mr-2">sync</span> Mengumpulkan ribuan data dari database...';
        messages.appendChild(loadingDiv);
        messages.scrollTop = messages.scrollHeight;

        try {
            // 1. Fetch data from Supabase
            const data = await fetchAllData();
            
            document.getElementById(loadingId).innerHTML = '<span class="material-symbols-outlined animate-spin inline-block align-middle mr-2">sync</span> AI sedang menganalisis ' + data.length + ' baris data...';
            
            // 2. Prepare Prompt
            // To prevent massive token sizes if data > 100k rows, we can just send it as JSON string
            const dataStr = JSON.stringify(data);
            const systemPrompt = `Kamu adalah asisten AI yang ahli menganalisis data logistik gudang (Gudang 6).
Tugasmu adalah menjawab pertanyaan pengguna secara spesifik berdasarkan data JSON yang dilampirkan.
- Jika pengguna meminta pencarian data spesifik lintas kapal/supplier (seperti sarung tangan), cari semua entri yang relevan, KELOMPOKKAN per PT/Supplier, Kapal (nama_file), dan Nomor Kontainer jika diperlukan.
- SELALU gunakan format Markdown Table yang rapi untuk menyajikan data hasil pencarian/agregasi.
- Jika pengguna bertanya sesuatu yang tidak ada di data, katakan tidak ditemukan.
- JANGAN menyebutkan data JSON secara mentah, berikan jawaban analisis akhir.

Data ini memiliki kolom: nama_file (Kapal), nomor_kontainer, pt (Supplier), pelapor, nomor_kontrak, nomor_pembelian, nama_material, satuan, jumlah_data, penanggung_jawab, tanggal_cek, hasil_cek, status_inspeksi.

[DATA MENTAH GUDANG:]
${dataStr}
`;

            // 3. Call Gemini API
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [
                            { text: systemPrompt },
                            { text: "Pertanyaan Pengguna: " + text }
                        ]
                    }]
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Gagal menghubungi Gemini API');
            }

            const result = await response.json();
            let botAnswer = "Maaf, tidak ada respon.";
            if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
                 botAnswer = result.candidates[0].content.parts[0].text;
            }
            
            document.getElementById(loadingId).remove();
            appendMessage('bot', botAnswer);

        } catch (error) {
            console.error(error);
            document.getElementById(loadingId).remove();
            appendMessage('bot', '❌ Maaf, terjadi kesalahan: ' + error.message);
            if (error.message.includes('API_KEY')) {
                 localStorage.removeItem('GEMINI_API_KEY');
                 appendMessage('bot', '⚠️ Sepertinya API Key tidak valid. Kunci telah dihapus. Silakan klik tombol kirim lagi untuk memasukkan kunci yang benar.');
            }
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    }

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
}
