import { createClient } from '@supabase/supabase-js';
const supabaseUrl = "https://ubfseivosripbfongkcp.supabase.co";
const supabaseAnonKey = "sb_publishable_kabeekdg65dyS86snIaTVA_ihsnp0u1";
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function check() {
    const { data } = await supabase.from('penerimaan_kapal').select('nama_file');
    const uniqueFiles = new Set(data.map(item => item.nama_file).filter(Boolean));
    console.log("Total unique files:", uniqueFiles.size);
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    console.log("Total profiles:", count);
}
check();
