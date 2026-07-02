import { supabase } from './supabaseClient.js';

/**
 * Memastikan pengguna memiliki sesi (sudah login) sebelum melihat halaman.
 * Panggil fungsi ini di awal file javascript halaman Dashboard dsb.
 */
export async function requireAuth() {
    // Gunakan getUser() alih-alih getSession() agar memvalidasi langsung ke server Supabase
    const { data, error } = await supabase.auth.getUser();
    
    if (error || !data || !data.user) {
        // Arahkan kembali ke halaman login jika tidak valid (termasuk jika sesi dihapus admin)
        window.location.replace('/index.html');
        return null;
    }
    
    return data.user;
}

/**
 * Jika pengguna sudah login, arahkan langsung ke Dashboard saat mereka membuka halaman index.html
 */
export async function redirectIfAuthenticated() {
    const { data, error } = await supabase.auth.getUser();
    if (data && data.user) {
        const user = data.user;
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
            
        if (profile && profile.role === 'admin') {
            window.location.replace('/dashboard.html');
        } else {
            window.location.replace('/staff_dashboard.html');
        }
    }
}

/**
 * Memproses login dengan Nomor ID & Password ke Supabase
 * Menggunakan trik "Email Samaran" (NomorID@gudang6.com)
 */
export async function login(idNumber, password) {
    // Jika input mengandung '@', berarti Admin sedang menggunakan Email lama.
    // Jika tidak ada '@', berarti user baru sedang menggunakan Nomor ID.
    const loginEmail = idNumber.includes('@') ? idNumber : `${idNumber}@gudang6.com`;
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
    });
    
    if (error) {
        throw error;
    }
    
    return data;
}

/**
 * Memproses Log Out
 */
export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Logout Error:", error);
        throw error;
    }
    window.location.replace('/index.html');
}

// Pasang pendengar otomatis. Jika status berubah menjadi SIGNED_OUT dari mana pun, paksa kembali ke index.
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        const currentPath = window.location.pathname;
        if (currentPath !== '/' && currentPath !== '/index.html') {
            window.location.replace('/index.html');
        }
    }
});
