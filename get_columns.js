const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL="?(.*?)"?\r?\n/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY="?(.*?)"?\r?\n/)[1].trim();

async function check() {
  const res = await fetch(`${supabaseUrl}/rest/v1/penerimaan_kapal?select=*&limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const data = await res.json();
  if(data && data.length > 0) {
    console.log(Object.keys(data[0]));
  }
}
check();
