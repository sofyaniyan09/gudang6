const fs = require('fs');
let code = fs.readFileSync('src/dashboard.js', 'utf-8');

code = code.replace(
    '.subscribe();',
    `.subscribe((status) => { console.log('Realtime Subscription Status:', status); });`
);

fs.writeFileSync('src/dashboard.js', code);
console.log("Patched dashboard.js");
