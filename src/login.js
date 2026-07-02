import { login, redirectIfAuthenticated } from './auth.js';
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Jika sudah login, langsung arahkan ke dashboard
    await redirectIfAuthenticated();

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
                
            const role = profile?.role || 'staff';
            
            // Animasi centang sukses
            submitButton.classList.remove('bg-primary');
            submitButton.classList.add('bg-[#146c2e]'); // green
            submitButton.innerHTML = '<span class="material-symbols-outlined text-[20px]">check_circle</span> Berhasil';
            
            setTimeout(() => {
                if (role === 'admin') {
                    window.location.replace('/dashboard.html');
                } else {
                    window.location.replace('/staff_dashboard.html');
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
});
