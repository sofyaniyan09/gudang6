const fs = require('fs');
let code = fs.readFileSync('src/kelolaKapal.js', 'utf-8');

const setupRealtimeFunc = `
function setupRealtime() {
    if (realtimeShipChannel) {
        supabase.removeChannel(realtimeShipChannel);
    }
    realtimeShipChannel = supabase.channel('kelolakapal-updates')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'penerimaan_kapal' },
            (payload) => {
                console.log('Realtime update received!', payload);
                if (currentFile) {
                    openFile(currentFile);
                } else {
                    loadFiles();
                }
            }
        )
        .subscribe();
}
`;

if (!code.includes('function setupRealtime()')) {
    code = code.replace('async function initKelolaKapal()', setupRealtimeFunc + '\nasync function initKelolaKapal()');
    fs.writeFileSync('src/kelolaKapal.js', code);
    console.log("Patched kelolaKapal.js successfully");
} else {
    console.log("Already patched");
}
