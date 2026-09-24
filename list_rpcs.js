const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL="?(.*?)"?\r?\n/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY="?(.*?)"?\r?\n/)[1].trim();

fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`)
  .then(res => res.json())
  .then(data => console.log(Object.keys(data.paths).filter(p => p.includes('rpc'))))
  .catch(console.error);
