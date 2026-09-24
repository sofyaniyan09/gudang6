import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('penerimaan_kapal').select('*').limit(1);
  console.log("penerimaan_kapal:", error ? error.message : "exists");
  
  // Try to query wecom_queue
  const { error: e2 } = await supabase.from('wecom_queue').select('*').limit(1);
  console.log("wecom_queue:", e2 ? e2.message : "exists");
}
check();
