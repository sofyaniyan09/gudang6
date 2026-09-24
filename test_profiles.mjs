import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  "https://ubfseivosripbfongkcp.supabase.co",
  "sb_publishable_kabeekdg65dyS86snIaTVA_ihsnp0u1"
);
async function run() {
    const { data } = await supabase.from('profiles').select('*').eq('nama', 'lyam');
    console.log(JSON.stringify(data, null, 2));
}
run();
