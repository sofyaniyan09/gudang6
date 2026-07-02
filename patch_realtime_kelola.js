const fs = require('fs');
let code = fs.readFileSync('src/kelolaKapal.js', 'utf-8');

code = code.replace(
    '.subscribe();',
    `.subscribe((status) => { console.log('Realtime Subscription Status kelolaKapal:', status); });`
);

fs.writeFileSync('src/kelolaKapal.js', code);
console.log("Patched kelolaKapal.js");
