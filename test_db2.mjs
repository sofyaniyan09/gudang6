import { createClient } from '@supabase/supabase-js';
const supabaseUrl = "https://ubfseivosripbfongkcp.supabase.co";
const supabaseAnonKey = "sb_publishable_kabeekdg65dyS86snIaTVA_ihsnp0u1";
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function check() {
    const { data } = await supabase.from('penerimaan_kapal').select('nomor_kontainer, satuan_kemasan').limit(5);
    console.log(data);
}
check();
