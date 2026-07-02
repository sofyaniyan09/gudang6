import { supabase } from './src/supabaseClient.js';
async function test() {
  const { data, error } = await supabase.from('penerimaan_kapal').select('*').limit(1);
  console.log(Object.keys(data[0] || {}));
}
test();
