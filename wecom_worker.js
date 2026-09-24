import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://ubfseivosripbfongkcp.supabase.co",
  "sb_publishable_kabeekdg65dyS86snIaTVA_ihsnp0u1"
);

const WEBHOOK_URLS = [
  'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=a1f1c899-3d52-4165-a30d-a8a3fe22045b',
  'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=09cd17d4-d64a-457c-8091-c328e709aa4a',
];
let webhookIndex = 0;

function getNextWebhook() {
  const url = WEBHOOK_URLS[webhookIndex];
  webhookIndex = (webhookIndex + 1) % WEBHOOK_URLS.length;
  return url;
}

function log(msg) {
  const now = new Date().toLocaleTimeString('id-ID', { hour12: false });
  console.log(`[${now}] ${msg}`);
}

async function sendTextToWeCom(text, url) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
  });
  const data = await resp.json();
  if (data.errcode !== 0) throw new Error(`WeCom text error: ${data.errmsg}`);
}

async function sendImageToWeCom(imageUrl, webhookUrl) {
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`Gagal download gambar: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());

  if (buffer.length > 2 * 1024 * 1024) {
    log(`  ⚠️  Gambar terlalu besar (${(buffer.length / 1024 / 1024).toFixed(1)}MB), skip`);
    return;
  }

  const { createHash } = await import('crypto');
  const base64 = buffer.toString('base64');
  const md5 = createHash('md5').update(buffer).digest('hex');

  const sendResp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'image', image: { base64, md5 } }),
  });
  const data = await sendResp.json();
  if (data.errcode !== 0) throw new Error(`WeCom image error: ${data.errmsg}`);
}

async function processQueue() {
  const { data: items, error } = await supabase
    .from('wecom_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    log(`❌ Error fetching queue: ${error.message}`);
    return;
  }

  if (!items || items.length === 0) return;

  log(`📋 Ditemukan ${items.length} antrean. Memproses...`);

  for (const item of items) {
    const webhookUrl = getNextWebhook();

    // Tandai processing
    await supabase.from('wecom_queue').update({ status: 'processing' }).eq('id', item.id);

    try {
      const payload = item.payload;
      const text = payload.text;
      const imageUrls = payload.imageUrls || [];

      await sendTextToWeCom(text, webhookUrl);
      await new Promise(r => setTimeout(r, 1500));

      for (const imgUrl of imageUrls) {
        if (imgUrl && imgUrl.length > 0) {
          try {
            await sendImageToWeCom(imgUrl, webhookUrl);
            await new Promise(r => setTimeout(r, 1500));
          } catch (imgErr) {
            log(`  ⚠️  Gambar gagal: ${imgErr.message}`);
          }
        }
      }

      await supabase.from('wecom_queue').update({ status: 'completed' }).eq('id', item.id);
      log(`  ✅ Antrean ID ${item.id} selesai`);

    } catch (err) {
      log(`  ❌ Antrean ID ${item.id} gagal: ${err.message}`);
      await supabase.from('wecom_queue').update({ status: 'failed' }).eq('id', item.id);
    }
  }
}

// === MAIN LOOP ===
const POLL_INTERVAL = 5000; // Cek setiap 5 detik

log('🚀 WeCom Worker dimulai. Memantau antrean setiap 5 detik...');
log('   Tekan Ctrl+C untuk menghentikan.\n');

async function loop() {
  while (true) {
    try {
      await processQueue();
    } catch (e) {
      log(`Error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

loop();
