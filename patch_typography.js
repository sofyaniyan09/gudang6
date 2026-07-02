const fs = require('fs');
const path = require('path');

const files = ['dashboard.html', 'kelola_kapal.html', 'user_management.html', 'index.html'];
const cwd = process.cwd();

const fontSizeConfig = `
                fontSize: {
                    'display-lg': ['32px', '40px'],
                    'display-md': ['28px', '36px'],
                    'display-sm': ['24px', '32px'],
                    'headline-lg': ['24px', '32px'],
                    'headline-md': ['20px', '28px'],
                    'headline-sm': ['18px', '24px'],
                    'title-lg': ['18px', '24px'],
                    'title-md': ['16px', '24px'],
                    'title-sm': ['14px', '20px'],
                    'body-lg': ['16px', '24px'],
                    'body-md': ['14px', '20px'],
                    'body-sm': ['12px', '16px'],
                    'label-lg': ['14px', '20px'],
                    'label-md': ['12px', '16px'],
                    'label-sm': ['11px', '16px'],
                },
`;

files.forEach(file => {
    const filePath = path.join(cwd, file);
    if (!fs.existsSync(filePath)) return;
    
    let html = fs.readFileSync(filePath, 'utf8');

    // Add fontSize to tailwind.config
    if (!html.includes('fontSize: {')) {
        html = html.replace(/(extend:\s*\{)/, '$1\n' + fontSizeConfig);
    }

    // Replace invalid spacing classes with standard tailwind ones
    html = html.replace(/py-lg/g, 'py-8');
    html = html.replace(/py-xl/g, 'py-10');
    html = html.replace(/px-lg/g, 'px-8');
    html = html.replace(/px-xl/g, 'px-10');
    html = html.replace(/pt-lg/g, 'pt-8');
    html = html.replace(/pb-lg/g, 'pb-8');
    
    html = html.replace(/mb-xl/g, 'mb-10');
    html = html.replace(/mb-lg/g, 'mb-8');
    html = html.replace(/mt-lg/g, 'mt-8');
    
    html = html.replace(/gap-sm/g, 'gap-2');
    html = html.replace(/gap-md/g, 'gap-4');
    html = html.replace(/gap-lg/g, 'gap-6');

    html = html.replace(/p-lg/g, 'p-6');
    html = html.replace(/p-xl/g, 'p-8');
    
    html = html.replace(/md:p-margin-desktop/g, 'md:p-8');
    html = html.replace(/md:pb-margin-desktop/g, 'md:pb-8');

    fs.writeFileSync(filePath, html);
    console.log(`Patched font sizes and spacing in ${file}`);
});
