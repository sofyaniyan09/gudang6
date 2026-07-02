import { supabase } from './supabaseClient.js';
import { requireAuth, logout } from './auth.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Klien khusus untuk mendaftarkan user baru TANPA merusak sesi admin yang sedang login
const adminAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storageKey: 'supabase.admin.auth.token'
    }
});

async function initUserManagement() {
    // 1. Verifikasi Login
    const currentUser = await requireAuth();
    if (!currentUser) return;

    // 2. Verifikasi Peran (Role = Admin)
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

    if (profileError || !profileData || profileData.role !== 'admin') {
        alert("Akses Ditolak: Fitur Manajemen Pengguna hanya dapat diakses oleh Admin.");
        window.location.replace('/dashboard.html');
        return;
    }

    // 3. Load Users from profiles
    loadUsers();

    // 4. Setup UI Events
    document.getElementById('btn-logout')?.addEventListener('click', logout);
    
    // Setup Modal
    const modal = document.getElementById('modal-add-user');
    const modalContent = document.getElementById('modal-content');
    const btnAddUser = document.getElementById('btn-add-user');
    const btnCancelUser = document.getElementById('btn-cancel-user');
    
    function openModal() {
        modal.classList.remove('hidden');
        // Trigger reflow
        void modal.offsetWidth;
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }

    function closeModal() {
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.getElementById('form-add-user').reset();
            document.getElementById('add-user-error').classList.add('hidden');
        }, 200);
    }

    btnAddUser.addEventListener('click', openModal);
    btnCancelUser.addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', closeModal);

    // Setup Reset Password Modal
    const resetModal = document.getElementById('modal-reset-password');
    const resetModalContent = document.getElementById('modal-content-reset');
    const btnCancelReset = document.getElementById('btn-cancel-reset');
    
    window.openResetModal = function(uid, nama) {
        document.getElementById('input-reset-uid').value = uid;
        document.getElementById('reset-target-name').textContent = nama;
        document.getElementById('form-reset-password').reset();
        document.getElementById('reset-password-error').classList.add('hidden');
        
        resetModal.classList.remove('hidden');
        void resetModal.offsetWidth;
        resetModalContent.classList.remove('scale-95', 'opacity-0');
        resetModalContent.classList.add('scale-100', 'opacity-100');
    };

    function closeResetModal() {
        resetModalContent.classList.remove('scale-100', 'opacity-100');
        resetModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            resetModal.classList.add('hidden');
        }, 200);
    }

    btnCancelReset.addEventListener('click', closeResetModal);
    document.getElementById('modal-backdrop-reset').addEventListener('click', closeResetModal);

    window.deleteUser = async function(uid, nama) {
        if (!confirm(`Apakah Anda yakin ingin menghapus akun ${nama}? (Tindakan ini tidak dapat dibatalkan)`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', uid);

            if (error) throw error;
            alert(`Akun ${nama} berhasil dihapus.`);
            loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert(`Gagal menghapus akun: ${error.message}`);
        }
    };

    // Form Submit (Reset Sandi)
    document.getElementById('form-reset-password').addEventListener('submit', async (e) => {
        e.preventDefault();
        const uid = document.getElementById('input-reset-uid').value;
        const newPassword = document.getElementById('input-new-password').value;
        const errorMsg = document.getElementById('reset-password-error');
        const submitBtn = document.getElementById('btn-save-reset');

        errorMsg.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span> Memproses...';

        try {
            const { data, error } = await supabase.rpc('admin_reset_password', {
                uid: uid,
                new_password: newPassword
            });

            if (error) throw error;

            closeResetModal();
            alert('Kata sandi berhasil direset!');
        } catch (error) {
            console.error(error);
            errorMsg.textContent = error.message || 'Gagal mereset sandi.';
            errorMsg.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Ubah Sandi';
        }
    });

    // Form Submit (Buat Akun Baru)
    document.getElementById('form-add-user').addEventListener('submit', async (e) => {
        e.preventDefault();
        const idNumber = document.getElementById('input-id-number').value.trim();
        const nama = document.getElementById('input-nama').value.trim();
        const password = document.getElementById('input-password').value;
        const role = document.getElementById('input-role').value;
        const errorMsg = document.getElementById('add-user-error');
        const submitBtn = document.getElementById('btn-save-user');

        errorMsg.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span> Memproses...';

        try {
            // Cek apakah ID Number sudah dipakai di tabel profiles
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('id_number')
                .eq('id_number', idNumber)
                .single();

            if (existingUser) {
                throw new Error("Nomor ID ini sudah digunakan oleh karyawan lain!");
            }

            // Gunakan Admin Client untuk sign up dengan Email Samaran
            const dummyEmail = `${idNumber}@gudang6.com`;
            const { data: authData, error: authError } = await adminAuthClient.auth.signUp({
                email: dummyEmail,
                password: password,
            });

            if (authError) throw authError;

            // Jika berhasil signUp, tambahkan ke tabel profiles
            const userId = authData.user.id;
            
            const { error: insertError } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    id_number: idNumber,
                    nama: nama,
                    role: role
                });

            if (insertError) throw insertError;

            closeModal();
            loadUsers();
            alert(`Berhasil membuat akun untuk ${nama} (ID: ${idNumber}).`);

        } catch (error) {
            console.error(error);
            errorMsg.textContent = error.message || 'Gagal membuat akun.';
            errorMsg.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Simpan Akun';
        }
    });
}

async function loadUsers() {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;
    const tableBody = document.getElementById('user-table-body');
    tableBody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-on-surface-variant"><span class="material-symbols-outlined animate-spin text-primary text-4xl block mb-2">sync</span> Memuat daftar pengguna...</td></tr>`;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-error">Gagal memuat data pengguna. Pastikan tabel 'profiles' sudah ada di Supabase.</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-on-surface-variant">Belum ada akun terdaftar.</td></tr>`;
        return;
    }

    tableBody.innerHTML = '';
    data.forEach(user => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-surface-container-low transition-colors group";
        
        let roleBadge = user.role === 'admin' 
            ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm"><span class="material-symbols-outlined text-[14px]">shield</span> Admin</span>`
            : `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">Staff</span>`;

        let actionButtons = '';
        if (user.id !== currentUserId) {
            actionButtons = `
                <button onclick="openResetModal('${user.id}', '${user.nama || 'Tanpa Nama'}')" class="flex items-center gap-1.5 px-3 py-1.5 bg-error/10 text-error hover:bg-error/20 rounded-lg text-xs font-bold transition-colors">
                    <span class="material-symbols-outlined text-[14px]">key</span> Reset
                </button>
                <button onclick="deleteUser('${user.id}', '${user.nama || 'Tanpa Nama'}')" class="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-colors">
                    <span class="material-symbols-outlined text-[14px]">delete</span> Hapus
                </button>
            `;
        } else {
            actionButtons = `<span class="text-[10px] text-primary bg-primary/10 px-2 py-1 rounded-full font-bold">Akun Anda (Terlindungi)</span>`;
        }

        tr.innerHTML = `
            <td class="py-4 px-6 text-left whitespace-nowrap">
                <span class="font-medium text-on-surface-variant text-sm">ID: ${user.id_number || '-'}</span>
            </td>
            <td class="py-4 px-6 text-left">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant shrink-0">
                        <span class="material-symbols-outlined text-[20px]">person</span>
                    </div>
                    <p class="font-bold text-on-surface">${user.nama || 'Tanpa Nama'}</p>
                </div>
            </td>
            <td class="py-4 px-6 text-left">
                ${roleBadge}
            </td>
            <td class="py-4 px-6 text-left">
                <span class="text-[10px] text-on-surface-variant px-3 py-1 bg-surface-container rounded-lg font-bold">Terdaftar</span>
            </td>
            <td class="py-4 px-6 text-right">
                <div class="flex items-center justify-end gap-2">
                    ${actionButtons}
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initUserManagement); } else { initUserManagement(); }

document.addEventListener('app:pageLoaded', (e) => { if (window.location.pathname.endsWith('user_management.html')) initUserManagement(); });
