const fs = require('fs');
let code = fs.readFileSync('src/dashboard.js', 'utf-8');

code = code.replace(
    /const data = \[\s*\{\s*label:\s*"Selesai 100%".*?\];/s,
    `const data = [
        { label: "Selesai (" + selesai + ")", val: selesai, color: "#22c55e" },
        { label: "On Proses (" + onProses + ")", val: onProses, color: "#f97316" },
        { label: "Belum Diupdate (" + belumDiupdate + ")", val: belumDiupdate, color: "#3e90ff" }
    ];`
);

fs.writeFileSync('src/dashboard.js', code);
console.log("Patched legend in dashboard.js");
