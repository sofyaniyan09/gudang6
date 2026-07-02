const fs = require('fs');
let code = fs.readFileSync('kelola_kapal.html', 'utf-8');

code = code.replace(
    /class="fixed text-white hover:bg-white\/30 rounded-full transition-colors hidden flex items-center justify-center cursor-pointer"/g,
    'class="fixed text-white hover:bg-white/30 rounded-full transition-colors hidden items-center justify-center cursor-pointer"'
);

// Add click outside to close modal
code = code.replace(
    '<div id="image-preview-modal" class="hidden fixed inset-0 flex items-center justify-center transition-opacity" style="z-index: 99999; background-color: rgba(0, 0, 0, 0.9); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">',
    '<div id="image-preview-modal" onclick="if(event.target.id === \'image-preview-modal\') window.closeImagePreview()" class="hidden fixed inset-0 flex items-center justify-center transition-opacity" style="z-index: 99999; background-color: rgba(0, 0, 0, 0.9); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); cursor: pointer;">'
);

// Prevent image click from closing modal
code = code.replace(
    '<img id="preview-image" src="" class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-transform transform scale-95 pointer-events-auto" alt="Preview Foto">',
    '<img id="preview-image" src="" onclick="event.stopPropagation()" class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-transform transform scale-95 pointer-events-auto cursor-default" alt="Preview Foto">'
);

fs.writeFileSync('kelola_kapal.html', code);
console.log("Patched HTML root");
