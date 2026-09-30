#!/bin/bash

# Warna terminal untuk teks
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}🚀 Memulai Gudang 6 (Frontend & Backend AI) 🚀${NC}"
echo -e "${GREEN}===============================================${NC}"
echo -e "Kedua server akan dijalankan dengan '--host 0.0.0.0' agar Anda bisa"
echo -e "membukanya dari HP / Ponsel di jaringan WiFi yang sama."
echo ""

# 1. Start Python Backend (FastAPI) di background
echo -e "${BLUE}[1/2] Menyalakan Backend AI (FastAPI)...${NC}"
cd ai-backend
# Aktifkan virtual environment jika ada
if [ -d "venv" ]; then
    source venv/bin/activate
fi
# Jalankan uvicorn dan lempar ke background (&)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# 1b. Jalankan Localtunnel agar backend bisa diakses via HTTPS dari iPad (Vercel)
echo -e "${BLUE}[+] Membuat tunnel HTTPS aman untuk Backend (gudang6-ai-backend.loca.lt)...${NC}"
npx localtunnel --port 8000 --subdomain gudang6-ai-backend &
TUNNEL_PID=$!

# 2. Start Frontend (Vite)
echo -e "${BLUE}[2/2] Menyalakan Frontend Web (Vite)...${NC}"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo -e "\n${GREEN}Semua server berhasil berjalan! Tekan Ctrl + C untuk mematikan keduanya.${NC}\n"

# Menangkap sinyal Ctrl+C untuk mematikan semua server secara bersih
trap "echo -e '\n${BLUE}Mematikan server Gudang 6...${NC}'; kill $BACKEND_PID $FRONTEND_PID $TUNNEL_PID; exit" SIGINT

# Tunggu proses berjalan selamanya sampai di-kill
wait $FRONTEND_PID $BACKEND_PID $TUNNEL_PID
