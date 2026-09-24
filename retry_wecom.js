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

async function sendTextToWeCom(text, url) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
  });
  const data = await resp.json();
  if (data.errcode !== 0) throw new Error(`WeCom text error: ${data.errmsg}`);
  console.log(`  ✅ Teks terkirim`);
}

async function sendImageToWeCom(imageUrl, webhookUrl) {
  // Download image
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`Gagal download gambar: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  
  if (buffer.length > 2 * 1024 * 1024) {
    console.log(`  ⚠️  Gambar terlalu besar (${(buffer.length / 1024 / 1024).toFixed(1)}MB), skip`);
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
  console.log(`  ✅ Gambar terkirim`);
}

async function processFailedQueue() {
  // Ambil semua yang berstatus failed
  const { data: items, error } = await supabase
    .from('wecom_queue')
    .select('*')
    .eq('status', 'failed')
    .order('created_at', { ascending: true });

  if (error) {
    console.log("Error fetching queue:", error.message);
    return;
  }

  if (!items || items.length === 0) {
    console.log("Tidak ada antrean yang gagal. Semua sudah bersih!");
    return;
  }

  console.log(`\n📋 Ditemukan ${items.length} antrean yang gagal. Memproses...\n`);

  for (const item of items) {
    const webhookUrl = getNextWebhook();
    console.log(`--- Antrean ID ${item.id} ---`);
    
    try {
      const payload = item.payload;
      const text = payload.text;
      const imageUrls = payload.imageUrls || [];

      // Kirim teks
      await sendTextToWeCom(text, webhookUrl);
      await new Promise(r => setTimeout(r, 1500));

      // Kirim gambar
      for (const imgUrl of imageUrls) {
        if (imgUrl && imgUrl.length > 0) {
          try {
            await sendImageToWeCom(imgUrl, webhookUrl);
            await new Promise(r => setTimeout(r, 1500));
          } catch (imgErr) {
            console.log(`  ⚠️  Gagal kirim gambar: ${imgErr.message}`);
          }
        }
      }

      // Update status ke completed
      await supabase.from('wecom_queue').update({ status: 'completed' }).eq('id', item.id);
      console.log(`  🎉 Antrean ID ${item.id} selesai!\n`);

    } catch (err) {
      console.log(`  ❌ Gagal: ${err.message}\n`);
    }
  }

  console.log("\n✅ Selesai memproses semua antrean yang gagal!");
}

processFailedQueue();
