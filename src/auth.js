import { supabase } from './supabaseClient.js';

/**
 * Memastikan pengguna memiliki sesi (sudah login) sebelum melihat halaman.
 * Panggil fungsi ini di awal file javascript halaman Dashboard dsb.
 */
export async function requireAuth(allowedRole = null) {
    // Gunakan getUser() alih-alih getSession() agar memvalidasi langsung ke server Supabase
    const { data, error } = await supabase.auth.getUser();

    if (error || !data || !data.user) {
        // Arahkan kembali ke halaman login jika tidak valid (termasuk jika sesi dihapus admin)
        window.location.replace('/index.html');
        return null;
    }

    if (allowedRole) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

        if (profile?.role !== allowedRole) {
            // Jika role tidak sesuai, paksa logout dan lemparkan ke index.html
            const provider = data.user.app_metadata?.provider;
            await supabase.auth.signOut();

            if (provider === 'google') {
                window.location.replace('/index.html?error=unlinked_google');
            } else {
                window.location.replace('/index.html?error=unauthorized');
            }
            return null;
        }
        
        // Auto-redirect Admin to Staff Portal on Mobile
        if (profile?.role === 'admin' && window.innerWidth <= 768 && !window.location.pathname.includes('staff.html')) {
            window.location.replace('/staff.html');
            return null;
        }
    }

    return data.user;
}

/**
 * Memastikan pengguna memiliki sesi (sudah login) sebagai staff atau admin.
 * Panggil fungsi ini di awal file javascript halaman Staff Portal dsb.
 */
export async function requireStaffAuth() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data || !data.user) {
        window.location.replace('/index.html');
        return null;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

    const role = profile?.role?.toLowerCase();

    if (!profile || (role !== 'staff' && role !== 'staf' && role !== 'admin')) {
        const provider = data.user.app_metadata?.provider;
        await supabase.auth.signOut();

        if (provider === 'google') {
            window.location.replace('/index.html?error=unlinked_google');
        } else {
            window.location.replace('/index.html?error=unauthorized');
        }
        return null;
    }

    return { user: data.user, profile };
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
            .select('*')
            .eq('id', user.id)
            .maybeSingle(); // Use maybeSingle to avoid errors if profile doesn't exist

        const role = profile?.role?.toLowerCase();
        if (profile && role === 'admin') {
            window.location.replace('/dashboard.html');
        } else if (profile && (role === 'staff' || role === 'staf')) {
            window.location.replace('/staff.html');
        } else {
            const provider = user.app_metadata?.provider;
            await supabase.auth.signOut();
            if (provider === 'google' || (user.app_metadata?.providers && user.app_metadata.providers.includes('google'))) {
                window.location.replace('/index.html?error=unlinked_google');
            }
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
 * Login dengan Google OAuth
 */
export async function loginWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            // Setelah berhasil dari Google, kembali ke URL ini
            redirectTo: window.location.origin + '/index.html',
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        }
    });

    if (error) {
        console.error("Google Login Error:", error);
        throw error;
    }

    return data;
}

/**
 * Menautkan akun Google yang sedang aktif ke sesi pengguna saat ini
 */
export async function linkGoogleAccount() {
    const { data, error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/dashboard.html?linked=true',
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        }
    });

    if (error) {
        console.error("Link Google Error:", error);
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
