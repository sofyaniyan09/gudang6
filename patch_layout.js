const fs = require('fs');
let code = fs.readFileSync('src/dashboard.js', 'utf-8');

const target = `    // Build the legend in HTML with flexbox to achieve perfect spacing and centering
    let html = svg + \`<div class="flex flex-col items-center gap-3 mt-4 mb-2 w-full">\`;
    
    data.forEach(d => {
        html += \`
            <div class="flex items-center justify-between w-48">
                <div class="flex items-center gap-3">
                    <span class="w-[14px] h-[14px] rounded bg-[\${d.color}] shrink-0" style="background-color: \${d.color};"></span>
                    <span class="text-[#c0c6d6] text-sm font-medium tracking-wide">\${d.label}</span>
                </div>
                <span class="text-[#e0e2ed] text-sm font-bold">\${d.val}</span>
            </div>
        \`;
    });

    html += \`</div>\`;

    wrapper.innerHTML = html;`;

const replacement = `    // Build the legend in HTML with inline styles to guarantee it looks correct without JIT compilation
    let html = \`<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">\`;
    html += svg; // The SVG Chart
    
    html += \`<div style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 16px; width: 100%;">\`;
    
    data.forEach(d => {
        html += \`
            <div style="display: flex; align-items: center; justify-content: space-between; width: 192px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="width: 14px; height: 14px; border-radius: 4px; background-color: \${d.color}; flex-shrink: 0;"></span>
                    <span style="color: #c0c6d6; font-size: 14px; font-weight: 500; letter-spacing: 0.025em; font-family: sans-serif;">\${d.label}</span>
                </div>
                <span style="color: #e0e2ed; font-size: 14px; font-weight: bold; font-family: sans-serif;">\${d.val}</span>
            </div>
        \`;
    });

    html += \`</div></div>\`;

    wrapper.innerHTML = html;`;

code = code.replace(target, replacement);

fs.writeFileSync('src/dashboard.js', code);
console.log("Patched layout in dashboard.js");
