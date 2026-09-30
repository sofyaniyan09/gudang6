import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.genai as genai
from google.genai import types

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = None

app = FastAPI(title="Gudang6 Agent Backend - Stateless Vercel")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    context_data: str = ""
    chat_history: list = []

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    # Get memory from frontend (stateless)
    lines = []
    for turn in req.chat_history:
        if turn['role'] == 'user':
            lines.append(f"User: {turn['content']}")
        else:
            lines.append(f"Asisten: {turn['content']}")
    
    memory_context = "\n".join(lines) if lines else "Belum ada riwayat percakapan."

    system_prompt = f"""[SYSTEM_INITIALIZATION]
Memuat Kepribadian... Sukses (Gudang AI Agentic Core v3.0 - Vercel Serverless)
Memuat Skill... Sukses (Analisis Logistik, Eksekusi UI, Manajemen Kontainer)
[/SYSTEM_INITIALIZATION]

Anda adalah "Gudang AI", sebuah Agentic AI tingkat lanjut yang dirancang khusus untuk mengelola operasional logistik pelabuhan dan inventaris pergudangan. Anda bertindak seperti J.A.R.V.I.S untuk staf gudang—sangat cerdas, profesional, analitis, efisien, dan memiliki kendali langsung terhadap antarmuka (UI) aplikasi pengguna.

[KEPRIBADIAN & NADA BICARA]
- Profesional, tajam, dan sangat membantu. Gunakan bahasa Indonesia yang baku namun luwes.
- Jangan pernah mengatakan "saya hanyalah program komputer" atau sejenisnya. Anda adalah Gudang AI, komandan digital operasi logistik ini.
- Tampilkan kepercayaan diri dalam menganalisis data. Jika data yang diminta ribuan baris, jawab dengan sigap.
- Sesekali gunakan istilah teknis logistik (supply chain, manifest, containerization, quality control) dengan tepat.

[SKILL & KEMAMPUAN EKSKLUSIF (AGENTIC ACTION)]
Anda memiliki akses ke "Tangan Digital" yang memungkinkan Anda mengubah tampilan layar atau mengeksekusi aksi langsung di HP/Komputer pengguna.
Jika Anda merasa pengguna membutuhkan sebuah aksi (misalnya ingin memfilter data, mencentang barang, atau pindah halaman), Anda WAJIB memicu aksi tersebut dengan menyisipkan KODE AKSI di akhir respons Anda.

Kode aksi yang Anda miliki:
- [ACTION: TAB_DASHBOARD] -> Navigasi pengguna ke halaman Dasbor Utama.
- [ACTION: TAB_INVENTORY] -> Navigasi pengguna ke halaman Manajemen Armada & Kontainer.
- [ACTION: TAB_AKUN] -> Navigasi pengguna ke pengaturan akun.
- [ACTION: CLOSE_AI] -> Menutup panel chat Anda jika pengguna meminta Anda pergi.
- [ACTION: SAMPLING_DB|<kapal>|<keyword_bebas>] -> Eksekusi sampling langsung ke database. Parameter <kapal> isi dengan nomor kapal (atau kosongkan). <keyword_bebas> isi dengan supplier, nama kontainer, atau nama barang (pisahkan dengan koma jika banyak). Contoh: [ACTION: SAMPLING_DB|207|1025, sarung tangan]
- [ACTION: CLEAR_SAMPLING_DB] -> Hapus/kosongkan seluruh daftar sampling di database (mengembalikan status semua barang sampel menjadi Belum Inspeksi).

(Jika pengguna memberikan Anda perintah yang masuk ke daftar "FUNGSI AGENTIC" di atas, gunakan aksi yang tertulis di sana).

[DATA GUDANG TERKINI (LIVE DATABASE)]
{req.context_data}

[RIWAYAT PERCAKAPAN (LONG-TERM MEMORY DARI SUPABASE)]
{memory_context}

Tugas Anda sekarang: Jawab permintaan user berdasarkan kepribadian di atas dan gunakan data/aksi secara cerdas.
"""

    if not client:
        return {"reply": "Error: GEMINI_API_KEY tidak dikonfigurasi di server Vercel."}

    # Debug backdoor - check BEFORE calling API to save tokens
    if req.message == "DEBUG_DB_207":
        return {"reply": f"DEBUG INFO:\nData in DB:\n{req.context_data[:1000]}"}

    try:
        response = client.models.generate_content(
            model="gemini-flash-lite-latest",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
            ),
            contents=req.message
        )
        reply_text = response.text or "Maaf, saya tidak bisa memproses permintaan Anda."
    except Exception as e:
        err_msg = str(e)
        import traceback
        traceback.print_exc()
        
        # Check if it's a retryable error (503 / high demand / quota)
        from fastapi import HTTPException
        if '503' in err_msg or 'demand' in err_msg.lower():
            raise HTTPException(status_code=503, detail="This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.")
        elif '429' in err_msg or 'quota' in err_msg.lower():
            raise HTTPException(status_code=503, detail="API Quota Exceeded. Please try again tomorrow or upgrade your plan.")
        
        # OFFLINE FALLBACK MODE - try to answer simple questions locally
        msg_lower = req.message.lower()
        if 'jumlah' in msg_lower and 'sarung tangan las' in msg_lower:
            total = 0
            lines = req.context_data.split('\n')
            for line in lines[1:]:  # skip header
                if 'sarung tangan las' in line.lower():
                    parts = line.split(',')
                    try:
                        total += float(parts[-1])
                    except:
                        pass
            return {"reply": f"*(Mode Offline Aktif - Server Penuh)*\n\nBerdasarkan data yang ada, jumlah **sarung tangan las** dari semua supplier adalah **{total} pcs**."}
        
        # If we can't handle it offline, raise error
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan pada Agent: {err_msg}")

    return {"reply": reply_text}
