import { supabase } from './supabaseClient.js';

// Cache data so we don't query the DB on every single chat message
let cachedAllData = null;

// Helper to fetch all rows (same as in kelolaKapal.js)
async function fetchAllData() {
    if (window.getGlobalData) {
        return await window.getGlobalData();
    }

    if (cachedAllData) return cachedAllData;

    // Fallback parallel fetch if globalData is not available
    let countQuery = supabase.from('penerimaan_kapal').select('*', { count: 'exact', head: true });
    const { count, error: countErr } = await countQuery;
    if (countErr || !count) return [];

    const PAGE_SIZE = 1000;
    const promises = [];

    for (let from = 0; from < count; from += PAGE_SIZE) {
        promises.push(
            supabase.from('penerimaan_kapal')
                .select('nama_file, nomor_kontainer, pt, supplier, nama_material, satuan, jumlah_data')
                .order('id', { ascending: true })
                .range(from, from + PAGE_SIZE - 1)
        );
    }

    const results = await Promise.all(promises);
    let allData = [];
    for (const res of results) {
        if (res.data) allData = allData.concat(res.data);
    }

    cachedAllData = allData;
    return allData;
}

export function initAIAssistant() {
    // Only render for Super Admin (id_number === '0000')
    const isSuperAdmin = () => {
        try {
            const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
            return profile.id_number === '0000' || profile.role === 'superadmin';
        } catch { return false; }
    };

    // Inject the CSS
    const style = document.createElement('style');
    style.id = 'ai-assistant-style';
    style.innerHTML = `
        /* Body adjustment when panel is open */
        body { transition: padding-right 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
        body.ai-panel-open { padding-right: 420px; }
        @media (max-width: 480px) { body.ai-panel-open { padding-right: 0; } }


        /* Side Panel */
        #ai-chat-panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 420px;
            max-width: 100vw;
            height: 100dvh;
            background: #0f0f1a;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            transform: translateX(100%);
            transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            border-left: 1px solid rgba(255,255,255,0.08);
            box-shadow: -8px 0 40px rgba(0,0,0,0.6);
        }
        #ai-chat-panel.open {
            transform: translateX(0);
        }
        @media (max-width: 480px) {
            #ai-chat-panel { width: 100vw; }
        }

        /* Header */
        .ai-header {
            padding: calc(env(safe-area-inset-top, 0px) + 16px) 20px 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            background: #0f0f1a;
            flex-shrink: 0;
        }
        .ai-header-title {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .ai-gemini-icon {
            width: 28px;
            height: 28px;
            background: conic-gradient(from 225deg, #4285F4, #9B72CB, #D96570, #D96570, #9B72CB, #4285F4);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Messages */
        .ai-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .ai-msg {
            max-width: 88%;
            padding: 12px 16px;
            border-radius: 18px;
            font-size: 14px;
            line-height: 1.6;
            word-wrap: break-word;
            animation: fadeInUp 0.2s ease;
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .ai-msg.user {
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }
        .ai-msg.bot {
            background: #1e1e30;
            color: #e2e8f0;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            border: 1px solid rgba(255,255,255,0.06);
        }

        /* Input Area */
        .ai-input-area {
            padding: 16px;
            background: #0f0f1a;
            border-top: 1px solid rgba(255,255,255,0.08);
            display: flex;
            gap: 10px;
            align-items: center;
            flex-shrink: 0;
            padding-bottom: max(env(safe-area-inset-bottom), 16px);
        }
        .ai-input-area input {
            flex: 1;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            color: white;
            border-radius: 24px;
            padding: 12px 18px;
            outline: none;
            font-size: 14px;
            transition: border-color 0.2s;
        }
        .ai-input-area input:focus { border-color: #6366f1; }
        .ai-input-area input::placeholder { color: rgba(255,255,255,0.3); }
        .ai-input-area button {
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            color: white;
            border: none;
            width: 44px;
            height: 44px;
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;
            transition: opacity 0.2s;
        }
        .ai-input-area button:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Table Styles */
        .ai-table-wrap { overflow-x: auto; margin: 8px 0; }
        .ai-msg.bot table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .ai-msg.bot th, .ai-msg.bot td {
            border: 1px solid rgba(255,255,255,0.15);
            padding: 6px 10px;
            text-align: left;
        }
        .ai-msg.bot th {
            background: rgba(99,102,241,0.3);
            font-weight: 600;
        }
        .ai-msg.bot tr:nth-child(even) td { background: rgba(255,255,255,0.03); }
        .ai-msg.bot p { margin: 4px 0; }
        .ai-msg.bot h2, .ai-msg.bot h3, .ai-msg.bot h4 { margin: 8px 0 4px; font-size: 14px; }
        .ai-msg.bot code { background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 12px; }

        /* Floating Action Button (FAB) */
        #btn-ai-fab {
            display: none;
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            color: white;
            border: none;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
            cursor: pointer;
            z-index: 9998;
            align-items: center;
            justify-content: center;
            transition: opacity 0.2s, transform 0.2s;
        }
        #btn-ai-fab:hover { transform: scale(1.05); }
        #btn-ai-fab.visible { display: flex; }
        
        /* Pulse Animation for FAB */
        @keyframes pulseFab {
            0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
            100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        #btn-ai-fab.visible { animation: pulseFab 2s infinite; }

        @keyframes pulse-red {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
    `;
    if (!document.getElementById('ai-assistant-style')) {
        document.head.appendChild(style);
    }

    // Prevent duplicate injections
    if (document.getElementById('ai-chat-panel')) {
        // Re-check super admin and show/hide button
        setupAIButton();
        return;
    }

    // Inject Side Panel HTML
    const html = `
        <div id="ai-chat-panel">
            <div class="ai-header">
                <div class="ai-header-title">
                    <div class="ai-gemini-icon">
                        <span class="material-symbols-outlined text-white text-[14px]">auto_awesome</span>
                    </div>
                    <div>
                        <h3 style="color:white;font-weight:700;font-size:16px;margin:0;line-height:1">Gudang AI</h3>
                        <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0">Super Admin Only</p>
                    </div>
                </div>
                <div style="display:flex; gap: 8px;">
                    <button id="ai-call-btn" style="background:transparent;border:none;color:rgba(255,255,255,0.6);cursor:pointer;display:flex;align-items:center;padding:4px;border-radius:8px" title="Mode Panggilan">
                        <span class="material-symbols-outlined" id="ai-call-icon">call</span>
                    </button>
                    <button id="ai-close-btn" style="background:transparent;border:none;color:rgba(255,255,255,0.6);cursor:pointer;display:flex;align-items:center;padding:4px;border-radius:8px" title="Tutup">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>
            <div class="ai-messages" id="ai-messages">
                <div class="ai-msg bot">Halo! Saya Gudang AI.<br><br>Saya bisa membantu menganalisis ribuan data barang lintas kapal dan supplier.<br><br>Coba tanya:<br><b>"Berapa jumlah sarung tangan las dari semua supplier?"</b></div>
            </div>
            <div class="ai-input-area">
                <input type="text" id="ai-input" placeholder="Tanya sesuatu tentang data..." autocomplete="off">
                <button id="ai-mic-btn" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); flex-shrink:0;">
                    <span class="material-symbols-outlined text-[20px]" id="ai-mic-icon" style="color: #aac7ff;">mic</span>
                </button>
                <button id="ai-send-btn">
                    <span class="material-symbols-outlined text-[20px]">send</span>
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    const panel = document.getElementById('ai-chat-panel');
    const closeBtn = document.getElementById('ai-close-btn');
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const micBtn = document.getElementById('ai-mic-btn');
    const micIcon = document.getElementById('ai-mic-icon');
    const messages = document.getElementById('ai-messages');
    const callBtn = document.getElementById('ai-call-btn');
    const callIcon = document.getElementById('ai-call-icon');

    // Voice Mode State
    let isCallMode = false;
    let isSpeaking = false;

    function speakText(text, onEndCallback) {
        if (!('speechSynthesis' in window)) {
            if (onEndCallback) onEndCallback();
            return;
        }
        window.speechSynthesis.cancel(); // Stop any current speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 1.1; // Slightly faster for natural feel
        
        utterance.onstart = () => { isSpeaking = true; };
        utterance.onend = () => {
            isSpeaking = false;
            if (onEndCallback) onEndCallback();
        };
        utterance.onerror = () => {
            isSpeaking = false;
            if (onEndCallback) onEndCallback();
        };
        
        window.speechSynthesis.speak(utterance);
    }

    callBtn.addEventListener('click', () => {
        isCallMode = !isCallMode;
        if (isCallMode) {
            callBtn.style.color = '#10b981'; // Green color indicating active call
            callIcon.textContent = 'phone_in_talk';
            speakText("Mode panggilan suara diaktifkan.", () => {
                if (isCallMode && !isRecording) micBtn.click();
            });
            appendMessage('bot', '📞 **Mode Panggilan Aktif**\nAI akan menjawab dengan suara dan mendengarkan secara terus menerus.');
        } else {
            callBtn.style.color = 'rgba(255,255,255,0.6)';
            callIcon.textContent = 'call';
            window.speechSynthesis.cancel();
            if (isRecording) micBtn.click(); // Stop listening
            appendMessage('bot', '📞 **Mode Panggilan Dinonaktifkan**.');
        }
    });

    // Setup Speech Recognition
    let recognition = null;
    let isRecording = false;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = function () {
            isRecording = true;
            micBtn.style.background = 'rgba(239, 68, 68, 0.2)';
            micBtn.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            micIcon.style.color = '#ef4444';
            input.placeholder = "Mendengarkan (Bicara sekarang)...";
            micBtn.style.animation = 'pulse-red 1.5s infinite';
        };

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            input.value = transcript;
            
            // Auto-send in call mode
            if (isCallMode) {
                setTimeout(() => {
                    if (!sendBtn.disabled) sendBtn.click();
                }, 800);
            }
        };

        recognition.onerror = function (event) {
            console.error("Speech recognition error", event.error);
            input.placeholder = "Gagal mendengar: " + event.error;
            micBtn.style.animation = 'none';
            isRecording = false;
            micBtn.style.background = 'rgba(255,255,255,0.06)';
            micBtn.style.borderColor = 'rgba(255,255,255,0.1)';
            micIcon.style.color = '#aac7ff';
            setTimeout(() => { if (!input.value) input.placeholder = "Tanya sesuatu tentang data..."; }, 2000);
        };

        recognition.onend = function () {
            isRecording = false;
            micBtn.style.background = 'rgba(255,255,255,0.06)';
            micBtn.style.borderColor = 'rgba(255,255,255,0.1)';
            micIcon.style.color = '#aac7ff';
            micBtn.style.animation = 'none';
            if (!input.value) input.placeholder = "Tanya sesuatu tentang data...";
        };

        micBtn.addEventListener('click', () => {
            if (isRecording) {
                try { recognition.stop(); } catch(e){}
            } else {
                if (isSpeaking) window.speechSynthesis.cancel(); // Stop AI talking if user interrupts
                try {
                    input.value = '';
                    input.placeholder = "Memulai mikrofon...";
                    micBtn.style.background = 'rgba(239, 68, 68, 0.2)';
                    micIcon.style.color = '#ef4444';
                    micBtn.style.animation = 'pulse-red 1.5s infinite';
                    recognition.start();
                } catch (err) {
                    alert('Gagal memulai mikrofon: ' + err.message);
                    isRecording = false;
                    micBtn.style.animation = 'none';
                    micBtn.style.background = 'rgba(255,255,255,0.06)';
                    micIcon.style.color = '#aac7ff';
                }
            }
        });
    } else {
        micBtn.addEventListener('click', () => {
            alert('Maaf, fitur Suara (Mikrofon) dinonaktifkan oleh browser Anda. Anda mungkin perlu menggunakan Safari atau Google Chrome versi terbaru.');
        });
    }

    let pendingQuestion = null; // Save context if AI asks for clarification
    let lastShipContext = null; // Save last ship number discussed
    let chatHistory = []; // Save conversation history for Gemini

    // Expose open/close globally
    window.openAIChat = function () {
        const panelEl = document.getElementById('ai-chat-panel');
        if (panelEl) {
            panelEl.classList.add('open');
            document.body.classList.add('ai-panel-open');
            checkApiKey();
        }
    };

    window.closeAIChat = function () {
        const panelEl = document.getElementById('ai-chat-panel');
        if (panelEl) {
            panelEl.classList.remove('open');
            document.body.classList.remove('ai-panel-open');
        }
    };

    closeBtn.addEventListener('click', window.closeAIChat);

    // Setup top bar button visibility based on super admin role
    function setupAIButton() {
        // Read profile from localStorage (set by auth.js after login)
        const profileStr = localStorage.getItem('userProfile');
        let profile = {};
        try { profile = JSON.parse(profileStr || '{}'); } catch { }

        const isSA = profile.id_number === '0000';

        // Find or create the FAB button
        let btn = document.getElementById('btn-ai-fab');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btn-ai-fab';
            btn.innerHTML = `<span class="material-symbols-outlined text-[28px]">auto_awesome</span>`;
            btn.addEventListener('click', () => window.openAIChat && window.openAIChat());
            // Insert directly to body as floating button
            document.body.appendChild(btn);
        }
        btn.classList.toggle('visible', isSA);
    }

    setupAIButton();
    // Re-check whenever auth state changes (profile loaded after navigation)
    window.addEventListener('app:profileLoaded', setupAIButton);

    function checkApiKey() {
        const envKey = import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : null;
        if (envKey) return; // Jika ada di .env, tidak perlu meminta lewat prompt

        if (!localStorage.getItem('GEMINI_API_KEY')) {
            const key = prompt("Untuk mengaktifkan AI, silakan masukkan API Key Gemini Anda:");
            if (key) {
                localStorage.setItem('GEMINI_API_KEY', key);
            } else {
                appendMessage('bot', '⚠️ Anda belum memasukkan API Key. Fitur AI Chatbot tidak dapat digunakan.');
            }
        }
    }

    function markdownToHtml(md) {
        const lines = md.split('\n');
        let html = '';
        let inTable = false;
        let isFirstRow = true;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // Detect table row
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                // Skip separator rows like |---|---|
                if (/^\|[\s:\-|]+\|$/.test(line.trim())) {
                    isFirstRow = false;
                    continue;
                }
                if (!inTable) {
                    inTable = true;
                    isFirstRow = true;
                    html += '<div class="ai-table-wrap"><table><thead>';
                }
                const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
                const tag = isFirstRow ? 'th' : 'td';
                if (!isFirstRow && isFirstRow === false && inTable) {
                    // Switching from thead to tbody
                }
                html += '<tr>' + cells.map(c => `<${tag}>${inlineMarkdown(c)}</${tag}>`).join('') + '</tr>';
                if (isFirstRow) {
                    html += '</thead><tbody>';
                    isFirstRow = false;
                }
                continue;
            }

            // Close table if open
            if (inTable) {
                html += '</tbody></table></div>';
                inTable = false;
                isFirstRow = true;
            }

            // Headings
            if (line.startsWith('### ')) { html += `<h4>${inlineMarkdown(line.slice(4))}</h4>`; continue; }
            if (line.startsWith('## ')) { html += `<h3>${inlineMarkdown(line.slice(3))}</h3>`; continue; }
            if (line.startsWith('# ')) { html += `<h2>${inlineMarkdown(line.slice(2))}</h2>`; continue; }

            // Empty line
            if (line.trim() === '') { html += '<br>'; continue; }

            // Normal text
            html += `<p>${inlineMarkdown(line)}</p>`;
        }

        if (inTable) html += '</tbody></table></div>';
        return html;
    }

    function inlineMarkdown(text) {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>');
    }

    function appendMessage(sender, text) {
        const div = document.createElement('div');
        div.className = `ai-msg ${sender}`;

        if (sender === 'bot') {
            div.innerHTML = markdownToHtml(text);
        } else {
            div.textContent = text;
        }

        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    async function handleSend() {
        const text = input.value.trim();
        if (!text) return;

        let apiKey = (import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : null) || localStorage.getItem('GEMINI_API_KEY');
        if (!apiKey) {
            checkApiKey();
            apiKey = (import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : null) || localStorage.getItem('GEMINI_API_KEY');
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
        loadingDiv.innerHTML = '<span class="material-symbols-outlined animate-spin inline-block align-middle mr-2">sync</span> Gudang AI sedang memproses...';
        messages.appendChild(loadingDiv);
        messages.scrollTop = messages.scrollHeight;

        try {
            // 1. Fetch data from Supabase (uses cache if available)
            const data = await fetchAllData();

            // 2. Smart pre-filter: extract keywords from user question & filter locally FIRST
            // Combine with previous question if we were waiting for ship clarification
            let queryForAI = text;
            if (pendingQuestion) {
                queryForAI = text + " (berkaitan dengan: " + pendingQuestion + ")";
                pendingQuestion = null; // clear after using
            }

            const questionLower = queryForAI.toLowerCase();

            // Extract potential ship keywords (e.g., "207", "kapal 207", "198")
            const shipKeywords = questionLower.match(/\b(\d{3,})\b/g) || []; // Modified to match just 3+ digits for ship number
            // Extract potential material keywords (words > 3 chars, skip stopwords)
            const stopwords = new Set(['yang', 'dari', 'dan', 'atau', 'di', 'ke', 'berapa', 'semua', 'semua', 'total', 'jumlah', 'suplayer', 'supplier', 'suplai', 'menyuplai', 'ada', 'kapal', 'data', 'baris', 'kontainer', 'saya', 'mau', 'butuh', 'kamu', 'membaginya', 'berdasarkan']);
            const materialKeywords = questionLower.split(/\s+/).filter(w => w.length > 3 && !stopwords.has(w) && isNaN(w));

            // Check if user explicitly wants all ships
            const wantsAllShips = questionLower.includes('semua kapal') || questionLower.includes('semua data') || questionLower.includes('kesemua') || questionLower.includes('seluruh');

            // Apply Context Memory for Ships
            if (wantsAllShips) {
                lastShipContext = null;
            } else if (shipKeywords.length > 0) {
                lastShipContext = [...shipKeywords];
            } else if (lastShipContext && lastShipContext.length > 0) {
                shipKeywords.push(...lastShipContext);
            }

            let filtered = data;

            // Filter by ship name if ship keywords found
            if (shipKeywords.length > 0) {
                const shipNums = shipKeywords.map(k => k.replace('kapal', '').trim());
                filtered = filtered.filter(row => {
                    const kapalStr = (row.nama_file || '').toLowerCase();
                    return shipNums.some(kw => kapalStr.includes(kw));
                });
            }

            // Filter by material if material keywords found
            if (materialKeywords.length > 0) {
                const matFiltered = filtered.filter(row => {
                    const materialStr = (row.nama_material || '').toLowerCase();
                    return materialKeywords.some(kw => materialStr.includes(kw));
                });
                // Only apply material filter if it yields results; otherwise keep ship-only results
                if (matFiltered.length > 0) filtered = matFiltered;
            }

            // If no filter matched (general question), use all data but aggregate heavily
            const dataToProcess = filtered.length > 0 ? filtered : data;

            // 3. Aggregate filtered data by Kapal + Kontainer + PT + Supplier + Material + Satuan
            const aggregated = {};
            dataToProcess.forEach(row => {
                if (!row) return;
                const kapal = (row.nama_file || '').replace(/,/g, ' ');
                const kontainer = (row.nomor_kontainer || '').replace(/,/g, ' ');
                const pt = (row.pt || '').replace(/,/g, ' ');
                const supplier = (row.supplier || '').replace(/,/g, ' ');
                const material = (row.nama_material || '').replace(/,/g, ' ');
                const satuan = (row.satuan || '').replace(/,/g, ' ');

                const key = `${kapal}|${kontainer}|${pt}|${supplier}|${material}|${satuan}`;
                if (!aggregated[key]) {
                    aggregated[key] = { kapal, kontainer, pt, supplier, material, satuan, jumlah: 0 };
                }
                aggregated[key].jumlah += (parseFloat(row.jumlah_data) || 0);
            });

            let filteredAggregated = Object.values(aggregated);
            const queryLower = queryForAI.toLowerCase();
            const ignoreWords = ['berapa', 'jumlah', 'dari', 'semua', 'untuk', 'yang', 'dengan', 'mana', 'memuat', 'tolong', 'tampilkan', 'kapal', 'kontainer'];
            const keywords = queryLower.split(/[\s?]+/).filter(w => w.length > 2 && !ignoreWords.includes(w));

            if (keywords.length > 0) {
                const keywordFiltered = filteredAggregated.filter(row => {
                    const rowValuesText = `${row.pt} ${row.supplier} ${row.material} ${row.satuan} ${row.kapal} ${row.kontainer}`.toLowerCase();
                    return keywords.some(k => rowValuesText.includes(k));
                });
                if (keywordFiltered.length > 0) {
                    filteredAggregated = keywordFiltered;
                }
            }

            let csvData = "Kapal,Kontainer,PT,Supplier,Material,Satuan,Total_Jumlah\n";
            filteredAggregated.forEach(row => {
                csvData += `${row.kapal},${row.kontainer},${row.pt},${row.supplier},${row.material},${row.satuan},${row.jumlah.toFixed(2)}\n`;
            });

            if (filteredAggregated.length > 200) {
                csvData = csvData.split('\n').slice(0, 201).join('\n') + '\n...[DATA DIPOTONG KARENA TERLALU BESAR]...';
            }

            const systemPrompt = `Kamu adalah asisten AI yang cerdas untuk mengelola data logistik (Gudang 6).
- Jika pengguna bertanya di luar konteks data, atau bertanya pertanyaan lanjutan, jawablah dengan natural dan ramah.
- Jika pengguna meminta analisis data atau tabel, sajikan data yang relevan dalam format Markdown Table yang rapi.
- [DATA RELEVAN (terdapat ${filteredAggregated.length > 200 ? '200+' : filteredAggregated.length} baris terkait dari database):]
${csvData}`;

            const activePanel = document.querySelector('.panel:not(.hidden)')?.id || 'tidak diketahui';
            let activeContainerName = window.currentContainer || 'Belum memilih kontainer';
            let uiState = `\n[STATUS UI SAAT INI]\n- Layar aktif: ${activePanel}\n- Kontainer aktif: ${activeContainerName}\n`;

            uiState += `\n[FUNGSI AGENTIC YANG BISA KAMU JALANKAN]\n`;
            uiState += `Jika user meminta mengeksekusi aksi di layar, balas dengan format persis seperti ini di akhir pesan:\n`;
            uiState += `- [ACTION: CHECK_SAMPLING] -> Untuk otomatis mencentang semua barang di layar yang wajib masuk kriteria sampling.\n`;
            uiState += `- [ACTION: UNCHECK_ALL] -> Untuk membatalkan semua centang barang.\n`;
            uiState += `- [ACTION: TAB_INVENTORY] -> Pindah ke tab armada/kontainer.\n`;
            uiState += `- [ACTION: SAMPLING_DB|<kapal>|<keyword_bebas>] -> Eksekusi sampling langsung ke database di latar belakang. Parameter <kapal> isi nomor kapal, dan <keyword_bebas> isi supplier, nama kontainer, atau barang (pisahkan koma). Contoh: [ACTION: SAMPLING_DB|207|sarung tangan, 1025]\n`;
            uiState += `- [ACTION: CLEAR_SAMPLING_DB] -> Hapus/kosongkan seluruh daftar sampling di database (mengembalikan status semua barang sampel menjadi Belum Inspeksi).\n`;

            // 3. Call FastAPI Custom Backend
            // Menggunakan Serverless Function Vercel (Terpusat)
            const BACKEND_URL = `/api/chat`;

            // Add user message to memory
            chatHistory.push({ role: "user", content: queryForAI });

            const requestBody = JSON.stringify({
                message: queryForAI,
                context_data: uiState + "\n[DATA EXCEL:]\n" + csvData,
                chat_history: chatHistory.slice(-10) // Send up to last 10 messages for context
            });

            let response;
            for (let attempt = 1; attempt <= 3; attempt++) {
                response = await fetch(BACKEND_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: requestBody
                });
                if (response.ok) break;

                const errBody = await response.clone().json();
                const errMsg = errBody.error?.message || '';
                // Retry on 503 / high demand
                if ((response.status === 503 || errMsg.toLowerCase().includes('demand')) && attempt < 3) {
                    document.getElementById(loadingId).innerHTML = `<span class="material-symbols-outlined animate-spin inline-block align-middle mr-2">sync</span> Server AI penuh, mencoba lagi (${attempt}/3)...`;
                    await new Promise(r => setTimeout(r, 4000 * attempt));
                    continue;
                }
                // Not retryable
                throw new Error(errMsg || 'Gagal menghubungi Gemini API');
            }

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Gagal menghubungi Gemini API');
            }

            const result = await response.json();

            // Handle if the backend returns an error message gracefully
            let botAnswer = result.reply;
            if (!botAnswer || botAnswer.includes("Terjadi kesalahan pada Agent") || response.status !== 200) {
                botAnswer = "⚠️ Maaf, saya sedang mengalami gangguan koneksi ke sistem pusat atau database. Mohon tunggu sebentar dan coba tanyakan lagi.";
                chatHistory.pop(); // Remove the last user message if it failed
            } else {
                // Save bot memory
                chatHistory.push({ role: "assistant", content: botAnswer });
            }

            // ----- AGENTIC AI EXECUTION -----
            if (botAnswer.includes('[ACTION: TAB_DASHBOARD]')) {
                botAnswer = botAnswer.replace('[ACTION: TAB_DASHBOARD]', '').trim();
                const btn = document.querySelector('.nav-item[data-tab="tab-overview"]');
                if (btn) btn.click();
            }
            if (botAnswer.includes('[ACTION: TAB_INVENTORY]')) {
                botAnswer = botAnswer.replace('[ACTION: TAB_INVENTORY]', '').trim();
                const btn = document.querySelector('.nav-item[data-tab="tab-armada"]');
                if (btn) btn.click();
            }
            if (botAnswer.includes('[ACTION: TAB_AKUN]')) {
                botAnswer = botAnswer.replace('[ACTION: TAB_AKUN]', '').trim();
                const btn = document.querySelector('.nav-item[data-tab="tab-users"]');
                if (btn) btn.click();
            }
            if (botAnswer.includes('[ACTION: CLOSE_AI]')) {
                botAnswer = botAnswer.replace('[ACTION: CLOSE_AI]', '').trim();
                document.getElementById('ai-overlay')?.classList.add('hidden');
            }

            // ADVANCED TOOL CALLS
            const panelItems = document.getElementById('panel-items');
            const isInsideContainer = panelItems && !panelItems.classList.contains('hidden') && window.currentItemsData;

            if (botAnswer.includes('[ACTION: CHECK_SAMPLING]')) {
                botAnswer = botAnswer.replace('[ACTION: CHECK_SAMPLING]', '').trim();
                if (isInsideContainer) {
                    let checkedCount = 0;
                    window.currentItemsData.forEach((item, i) => {
                        const samp = window.getSamplingStandard ? window.getSamplingStandard(item.nama_material, item.jumlah_data) : { pct: 0 };
                        if (samp.pct > 0) {
                            window.bulkSelectedItems.add(i);
                            const iconCb = document.getElementById('item-check-icon-' + i);
                            if (iconCb) {
                                iconCb.textContent = 'check_box';
                                iconCb.className = 'material-symbols-outlined text-[#aac7ff]';
                            }
                            const card = document.getElementById('item-card-' + i);
                            if (card) card.style.border = '1px solid #aac7ff';
                            checkedCount++;
                        }
                    });
                    if (window.updateBulkUI) window.updateBulkUI();
                    if (checkedCount > 0) {
                        setTimeout(() => appendMessage('bot', `✅ Berhasil mencentang **${checkedCount} barang** yang masuk kriteria sampling. Silakan klik **Inspeksi Tersorot** di bagian bawah.`), 500);
                    } else {
                        setTimeout(() => appendMessage('bot', `⚠️ Tidak ada barang yang butuh disampling di layar ini.`), 500);
                    }
                } else {
                    setTimeout(() => appendMessage('bot', `⚠️ Maaf, Anda harus membuka daftar barang di dalam sebuah kontainer terlebih dahulu.`), 500);
                }
            }

            const dbMatches = [...botAnswer.matchAll(/\[ACTION:\s*SAMPLING_DB\|([^|]+)\|([^\]]+)\]/gi)];
            if (dbMatches.length > 0) {
                // Hapus tags dari botAnswer secara sinkron sebelum ditampilkan ke UI
                for (const match of dbMatches) {
                    botAnswer = botAnswer.replace(match[0], '').trim();
                }
                setTimeout(async () => {
                    let totalUpdated = 0;
                    for (const match of dbMatches) {
                        const [fullMatch, kapal, keywordRaw] = match;
                        
                        const keywords = keywordRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

                        try {
                            // Gunakan query langsung ke database dengan fitur OR agar tidak terhalang limit 1000 baris
                            let query = supabase.from('penerimaan_kapal')
                                .select('id, supplier')
                                .ilike('nama_file', `%${kapal.trim()}%`);
                            
                            if (keywords.length > 0) {
                                const orQuery = keywords.map(k => `nama_material.ilike.%${k}%,supplier.ilike.%${k}%,nomor_kontainer.ilike.%${k}%`).join(',');
                                query = query.or(orQuery);
                            }

                            const { data, error } = await query;
                            if (error) throw error;

                            const toUpdate = data.map(item => item.id);

                            if (toUpdate.length > 0) {
                                const currentProfile = window.currentProfile || {};
                                const { error: updateErr } = await supabase.from('penerimaan_kapal')
                                    .update({
                                        status_inspeksi: 'Perlu Sampling',
                                        tanggal_inspeksi: new Date().toISOString(),
                                        id_staf: currentProfile.id_number || '',
                                        nama_staf: currentProfile.nama || window.currentUser?.email || ''
                                    })
                                    .in('id', toUpdate);
                                
                                if (updateErr) throw updateErr;
                                totalUpdated += toUpdate.length;
                            } else {
                                // DEBUG: Jika gagal, kumpulkan semua supplier unik untuk kapal ini
                                const uniqueSuppliers = [...new Set(data.map(d => d.supplier))].slice(0, 50).join(', ');
                                console.error("DEBUG: Kapal:", kapal, "Keyword:", keywordRaw, "Data Length:", data.length);
                                appendMessage('bot', `🔍 DEBUG (Hanya untuk Sistem): \n- Pencarian untuk Kapal: ${kapal}\n- Keyword: ${keywordRaw}\n- Total data kapal ini di DB: ${data.length}\n- Daftar Supplier yang ada di DB: ${uniqueSuppliers || 'Kosong'}`);
                            }
                        } catch (err) {
                            console.error(err);
                            appendMessage('bot', `❌ Gagal memproses ke database: ${err.message}`);
                        }
                    }

                    if (totalUpdated > 0) {
                        window.globalDataCache = null; // Invalidate cache agar UI refresh
                        appendMessage('bot', `✅ Berhasil mengeksekusi **${totalUpdated} barang** ke dalam daftar Sampling secara background!`);
                        if (window.renderSamplingDashboard) window.renderSamplingDashboard();
                    } else {
                        appendMessage('bot', `⚠️ Tidak ada barang yang cocok dengan kriteria sampling di database untuk pencarian tersebut.`);
                    }
                }, 500);
            }

            if (botAnswer.includes('[ACTION: CLEAR_SAMPLING_DB]')) {
                botAnswer = botAnswer.replace('[ACTION: CLEAR_SAMPLING_DB]', '').trim();
                setTimeout(async () => {
                    try {
                        const { data: currentSamples, error: updateErr } = await supabase.from('penerimaan_kapal')
                            .update({
                                status_inspeksi: 'Menunggu Inspeksi',
                                tanggal_inspeksi: null,
                                id_staf: '',
                                nama_staf: ''
                            })
                            .eq('status_inspeksi', 'Perlu Sampling')
                            .select('id');
                        
                        if (updateErr) throw updateErr;

                        if (currentSamples && currentSamples.length > 0) {
                            window.globalDataCache = null; // Invalidate cache agar UI refresh
                            appendMessage('bot', `✅ Berhasil membersihkan / menghapus **${currentSamples.length} barang** dari daftar Sampling.`);
                            
                            // Segarkan UI jika fungsi tersedia
                            if (window.renderSamplingDashboard) window.renderSamplingDashboard();
                        } else {
                            appendMessage('bot', `⚠️ Daftar sampling sudah kosong.`);
                        }
                    } catch (err) {
                        console.error(err);
                        appendMessage('bot', `❌ Gagal membersihkan daftar sampling: ${err.message}`);
                    }
                }, 500);
            }

            if (botAnswer.includes('[ACTION: UNCHECK_ALL]')) {
                botAnswer = botAnswer.replace('[ACTION: UNCHECK_ALL]', '').trim();
                if (isInsideContainer) {
                    window.bulkSelectedItems.clear();
                    window.currentItemsData.forEach((item, i) => {
                        const iconCb = document.getElementById('item-check-icon-' + i);
                        if (iconCb) {
                            iconCb.textContent = 'check_box_outline_blank';
                            iconCb.className = 'material-symbols-outlined text-white/20';
                        }
                        const card = document.getElementById('item-card-' + i);
                        if (card) card.style.border = '1px solid rgba(255,255,255,0.05)';
                    });
                    if (window.updateBulkUI) window.updateBulkUI();
                    setTimeout(() => appendMessage('bot', `✅ Semua centang barang telah dibersihkan.`), 500);
                }
            }
            // --------------------------------

            document.getElementById(loadingId).remove();
            appendMessage('bot', botAnswer);

            if (isCallMode) {
                // Strip markup for speech
                const cleanText = botAnswer.replace(/<[^>]*>?/gm, '')
                                           .replace(/\[ACTION:[^\]]+\]/g, '')
                                           .replace(/[*_~`]/g, '')
                                           .replace(/✅|⚠️|❌|🔍|📞/g, '');
                
                speakText(cleanText, () => {
                    if (isCallMode && !isRecording && !isSpeaking) {
                        setTimeout(() => micBtn.click(), 500); // Auto listen again
                    }
                });
            }

        } catch (error) {
            console.error(error);
            document.getElementById(loadingId).remove();
            appendMessage('bot', '❌ Maaf, terjadi kesalahan: ' + error.message);
            
            if (isCallMode) {
                speakText('Maaf, terjadi kesalahan.', () => {
                    if (isCallMode && !isRecording && !isSpeaking) setTimeout(() => micBtn.click(), 500);
                });
            }
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
