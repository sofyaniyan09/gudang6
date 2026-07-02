import { supabase } from './supabaseClient.js';
import { requireAuth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;

    // Fetch user profile to display their name
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('nama')
            .eq('id', user.id)
            .single();

        if (profile && profile.nama) {
            document.getElementById('staff-welcome').textContent = `Selamat Datang, ${profile.nama}`;
        }
    } catch (e) {
        console.error("Gagal mengambil profil", e);
    }
});

// Fetch data for dashboard metrics
async function loadStaffMetrics() {
    // 1. Total Ships = unique 'nama_file' in 'penerimaan_kapal'
    const totalShipsEl = document.getElementById('total-ships-count');
    if (totalShipsEl) {
        const { data, error } = await supabase
            .from('penerimaan_kapal')
            .select('nama_file');
        
        if (!error && data) {
            const uniqueFiles = new Set(data.map(d => d.nama_file).filter(Boolean));
            totalShipsEl.textContent = uniqueFiles.size;
        } else {
            totalShipsEl.textContent = '-';
        }
    }
}
document.addEventListener('DOMContentLoaded', loadStaffMetrics);
