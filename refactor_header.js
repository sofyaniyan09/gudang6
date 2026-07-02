const fs = require('fs');

const files = ['dashboard.html', 'kelola_kapal.html', 'user_management.html', 'staff_dashboard.html'];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // Skip if already refactored
    if (content.includes('id="page-header-config"')) continue;

    // 1. Remove the TopAppBar (Mobile & Desktop Header) outside main-content
    content = content.replace(/<!-- TopAppBar \(Mobile & Desktop Header\) -->[\s\S]*?<\/header>/, '');
    content = content.replace(/<header class="sticky top-0 right-0 z-30 flex justify-between items-center px-6 py-4 w-full bg-surface\/80 backdrop-blur-xl shadow-sm md:hidden md:flex">[\s\S]*?<\/header>/, '');

    // 2. Extract inner header
    const headerRegex = /<header class="sticky top-0 right-0 z-30 w-full[^>]*>([\s\S]*?)<\/header>/;
    const match = content.match(headerRegex);
    if (match) {
        let innerHeader = match[1];
        
        let titleMatch = innerHeader.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        let titleHtml = titleMatch ? titleMatch[1].trim() : 'Overview';
        let isComplexTitle = titleHtml.includes('<span');
        
        let leftActions = '';
        let rightActions = '';
        let rightMatch = null;
        
        if (file === 'kelola_kapal.html') {
            leftActions = `<button id="btn-back-to-files" class="hidden text-on-surface-variant hover:text-on-surface transition-colors"><span class="material-symbols-outlined text-[24px]">arrow_back</span></button>`;
            rightMatch = innerHeader.match(/<div class="flex items-center gap-2 text-on-surface-variant"[^>]*>([\s\S]*?)<\/div>\n    <\/div>/);
            if (!rightMatch) {
                // Try simpler match
                rightMatch = innerHeader.match(/<div class="flex items-center gap-2[^>]*>([\s\S]*?)<\/div>/);
            }
            if (rightMatch) rightActions = rightMatch[0]; 
        }

        const configHtml = `
  <!-- Page Header Configuration for SPA -->
  <div id="page-header-config" class="hidden">
    <div class="page-title">${isComplexTitle ? titleHtml : `<span id="main-title-text">${titleHtml}</span>`}</div>
    <div class="left-actions">${leftActions}</div>
    <div class="right-actions">${file === 'kelola_kapal.html' ? '<!-- Search will be dynamically cloned -->' : '<!-- No specific right actions -->'}</div>
  </div>`;
        
        if (file === 'kelola_kapal.html') {
             content = content.replace(headerRegex, configHtml + '\n  <!-- Original right side search will be handled by Navigation.js -->\n  <div id="original-search-placeholder" class="hidden">' + (rightMatch ? rightMatch[0] : '') + '</div>');
        } else {
             content = content.replace(headerRegex, configHtml);
        }
    }

    fs.writeFileSync(file, content);
    console.log(`Extracted header from ${file}`);
}
