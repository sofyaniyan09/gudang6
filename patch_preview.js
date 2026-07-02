const fs = require('fs');
let code = fs.readFileSync('src/kelolaKapal.js', 'utf-8');

// Fix single quotes in encodedUrls
code = code.replace(
    /const encodedUrls = encodeURIComponent\(JSON\.stringify\(parsed\)\);/g,
    `const encodedUrls = encodeURIComponent(JSON.stringify(parsed)).replace(/'/g, "%27");`
);
code = code.replace(
    /const encodedUrls = encodeURIComponent\(JSON\.stringify\(\[row\.foto_inspeksi\]\)\);/g,
    `const encodedUrls = encodeURIComponent(JSON.stringify([row.foto_inspeksi])).replace(/'/g, "%27");`
);

// Fix updatePreviewUI hidden/flex toggle
const updateTarget = `    if (currentPreviewUrls.length > 1) {
        counter.textContent = \`\${currentPreviewIndex + 1} / \${currentPreviewUrls.length}\`;
        counter.classList.remove('hidden');
        btnPrev.classList.remove('hidden');
        btnNext.classList.remove('hidden');
    } else {
        counter.classList.add('hidden');
        btnPrev.classList.add('hidden');
        btnNext.classList.add('hidden');
    }`;

const updateReplace = `    if (currentPreviewUrls.length > 1) {
        counter.textContent = \`\${currentPreviewIndex + 1} / \${currentPreviewUrls.length}\`;
        counter.classList.remove('hidden');
        
        btnPrev.classList.remove('hidden');
        btnPrev.classList.add('flex');
        
        btnNext.classList.remove('hidden');
        btnNext.classList.add('flex');
    } else {
        counter.classList.add('hidden');
        
        btnPrev.classList.remove('flex');
        btnPrev.classList.add('hidden');
        
        btnNext.classList.remove('flex');
        btnNext.classList.add('hidden');
    }`;

code = code.replace(updateTarget, updateReplace);

fs.writeFileSync('src/kelolaKapal.js', code);
console.log("Patched JS");
