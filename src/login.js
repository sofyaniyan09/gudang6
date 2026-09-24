import { login, loginWithGoogle, redirectIfAuthenticated } from './auth.js';
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Jika sudah login, langsung arahkan ke dashboard
    await redirectIfAuthenticated();

    // Cek apakah ada error akun Google belum ditautkan
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'unlinked_google') {
        const modalHtml = `
        <div id="unlinked-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-[24px] p-6 max-w-[340px] w-full shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
                <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-4">
                    <span class="material-symbols-outlined text-[24px]">warning</span>
                </div>
                <h3 class="text-[18px] font-semibold text-gray-900 mb-2">Akun Belum Ditautkan</h3>
                <p class="text-gray-600 text-[13px] mb-6 leading-relaxed">
                    Anda belum menautkan akun Google ini. Silakan <b>login manual</b> menggunakan ID & Password terlebih dahulu, lalu buka menu <b>Pengaturan</b> (di sudut kanan atas) untuk menautkan akun Google Anda.
                </p>
                <button id="btn-close-unlinked" class="w-full bg-[#18181b] hover:bg-black text-white py-3 rounded-xl text-[13px] font-medium transition-colors">
                    Mengerti
                </button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('btn-close-unlinked').addEventListener('click', () => {
            document.getElementById('unlinked-modal').remove();
            window.history.replaceState({}, document.title, window.location.pathname);
        });
    }

    // Check for hash errors from Supabase OAuth
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('error')) {
        const errorDesc = hashParams.get('error_description') || hashParams.get('error');
        alert("Autentikasi gagal: " + errorDesc);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const loginForm = document.getElementById('login-form');
    const idInput = document.getElementById('id-number');
    const passwordInput = document.getElementById('password');
    const submitButton = document.getElementById('btn-submit');
    const errorAlert = document.getElementById('error-msg');

    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const idNumber = idInput.value.trim();
        const password = passwordInput.value;
        
        if (!idNumber || !password) return;

        // Ubah tombol menjadi status Loading
        const originalBtnHtml = submitButton.innerHTML;
        submitButton.innerHTML = `<span class="material-symbols-outlined animate-spin text-[20px]">sync</span> <span class="font-semibold relative z-10">Memproses...</span>`;
        submitButton.disabled = true;
        errorAlert.classList.add('hidden');

        try {
            // Coba login ke Supabase
            const { user } = await login(idNumber, password);
            
            // Cek role user
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
                
            const role = profile?.role?.toLowerCase() || 'staff';
            
            if (role !== 'admin' && role !== 'staff' && role !== 'staf') {
                await supabase.auth.signOut();
                errorAlert.textContent = "Akses ditolak. Peran tidak valid.";
                errorAlert.classList.remove('hidden');
                
                submitButton.innerHTML = originalBtnHtml;
                submitButton.disabled = false;
                submitButton.classList.remove('bg-[#146c2e]');
                submitButton.classList.add('bg-primary');
                return;
            }
            
            // Animasi centang sukses
            submitButton.classList.remove('bg-primary');
            submitButton.classList.add('bg-[#146c2e]'); // green
            submitButton.innerHTML = '<span class="material-symbols-outlined text-[20px]">check_circle</span> Berhasil';
            
            setTimeout(() => {
                const isMobile = window.innerWidth <= 768;
                if (role === 'admin') {
                    if (isMobile) {
                        window.location.replace('/staff.html');
                    } else {
                        window.location.replace('/dashboard.html');
                    }
                } else if (role === 'staff' || role === 'staf') {
                    window.location.replace('/staff.html');
                }
            }, 500);
            
        } catch (error) {
            console.error("Login failed:", error);
            
            // Tampilkan pesan error
            errorAlert.textContent = "Nomor ID / Email atau Kata Sandi salah.";
            errorAlert.classList.remove('hidden');
            
            // Kembalikan tombol ke bentuk semula
            submitButton.innerHTML = originalBtnHtml;
            submitButton.disabled = false;
            submitButton.classList.remove('bg-[#146c2e]');
            submitButton.classList.add('bg-primary');
        }
    });

    // Event listener untuk Google Login
    const googleButton = document.getElementById('btn-google');
    if (googleButton) {
        googleButton.addEventListener('click', async () => {
            const originalGoogleHtml = googleButton.innerHTML;
            googleButton.innerHTML = `<span class="material-symbols-outlined animate-spin text-[16px]">sync</span> Tunggu...`;
            googleButton.disabled = true;
            errorAlert.classList.add('hidden');
            
            try {
                await loginWithGoogle();
            } catch (error) {
                console.error("Google Login failed:", error);
                errorAlert.textContent = "Terjadi kesalahan saat login dengan Google.";
                errorAlert.classList.remove('hidden');
                googleButton.innerHTML = originalGoogleHtml;
                googleButton.disabled = false;
            }
        });
    }
});
