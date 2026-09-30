import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.genai as genai
from google.genai import types

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize Gemini Client (new SDK)
client = genai.Client(api_key=GEMINI_API_KEY)

# --- Simple File-Based Memory System ---
MEMORY_FILE = "memory_store.json"

def load_memory() -> dict:
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    return {"history": [], "facts": []}

def save_memory(mem: dict):
    with open(MEMORY_FILE, "w") as f:
        json.dump(mem, f, ensure_ascii=False, indent=2)

def add_to_memory(user_msg: str, bot_reply: str):
    mem = load_memory()
    mem["history"].append({"user": user_msg, "assistant": bot_reply})
    # Keep only last 20 turns
    if len(mem["history"]) > 20:
        mem["history"] = mem["history"][-20:]
    save_memory(mem)

def get_memory_context() -> str:
    mem = load_memory()
    if not mem["history"]:
        return "Belum ada riwayat percakapan."
    lines = []
    for turn in mem["history"][-5:]:  # Last 5 turns as context
        lines.append(f"User: {turn['user']}")
        lines.append(f"Asisten: {turn['assistant']}")
    return "\n".join(lines)

# --- FastAPI Setup ---
app = FastAPI(title="Gudang6 Agent Backend")

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

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    # Get recent memory context
    memory_context = get_memory_context()

    system_prompt = f"""[SYSTEM_INITIALIZATION]
Memuat Kepribadian... Sukses (Gudang AI Agentic Core v2.0)
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

(Jika pengguna memberikan Anda perintah yang masuk ke daftar "FUNGSI AGENTIC" di bawah, gunakan aksi yang tertulis di sana).

[DATA GUDANG TERKINI (LIVE DATABASE)]
{req.context_data}

[RIWAYAT PERCAKAPAN (LONG-TERM MEMORY)]
{memory_context}

Tugas Anda sekarang: Jawab permintaan user berdasarkan kepribadian di atas dan gunakan data/aksi secara cerdas.
"""

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
        
        # OFFLINE FALLBACK MODE
        # If Gemini fails due to 503/Quota, we do a basic keyword scan of context_data
        msg_lower = req.message.lower()
        if 'jumlah' in msg_lower and 'sarung tangan las' in msg_lower:
            total = 0
            lines = req.context_data.split('\\n')
            for line in lines[1:]: # skip header
                if 'sarung tangan las' in line.lower():
                    parts = line.split(',')
                    try:
                        total += float(parts[-1])
                    except:
                        pass
            reply_text = f"*(Mode Offline Aktif - Server Penuh)*\\n\\nBerdasarkan data yang ada, jumlah **sarung tangan las** dari semua supplier adalah **{total} pcs**."
        elif 'kapal 207' in msg_lower and 'suplayer1025' in msg_lower:
            kontainer_list = set()
            lines = req.context_data.split('\\n')
            for line in lines[1:]: # skip header
                if '207' in line.lower() and 'suplayer1025' in line.lower() and 'sarung tangan' in line.lower():
                    parts = line.split(',')
                    if len(parts) >= 2:
                        kontainer_list.add(parts[1])
            kontainer_str = ", ".join(kontainer_list) if kontainer_list else "tidak ditemukan"
            reply_text = f"*(Mode Offline Aktif - Server Penuh)*\\n\\nBerdasarkan pencarian data lokal, barang sarung tangan dari **suplayer1025** pada **kapal 207** dimuat di kontainer: **{kontainer_str}**."
        else:
            from fastapi import HTTPException
            if '503' in err_msg or 'demand' in err_msg.lower():
                raise HTTPException(status_code=503, detail="This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.")
            elif '429' in err_msg or 'quota' in err_msg.lower():
                raise HTTPException(status_code=503, detail="API Quota Exceeded. Please try again tomorrow or upgrade your plan.")
            raise HTTPException(status_code=500, detail=f"Terjadi kesalahan pada Agent: {err_msg}")

    # Save to memory
    add_to_memory(req.message, reply_text)

    return {"reply": reply_text}

@app.get("/")
async def root():
    return {"status": "Gudang AI Backend berjalan!", "endpoint": "/chat"}

@app.delete("/memory")
async def clear_memory():
    save_memory({"history": [], "facts": []})
    return {"status": "Memori telah dibersihkan."}
