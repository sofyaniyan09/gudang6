export function initSPA() {
    bindLinks();
    updateSidebarActive(window.location.pathname);
    
    window.addEventListener('popstate', (e) => {
        loadPage(window.location.href, false);
    });
}

function bindLinks() {
    const links = document.querySelectorAll('#app-sidebar a[href$=".html"], nav.md\\:hidden a[href$=".html"]');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = link.getAttribute('href');
            if (window.location.pathname.endsWith(url) || window.location.href === url) return;
            loadPage(url, true);
        });
    });
}

async function loadPage(url, pushState) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // iOS Style Top Progress Bar
    let loaderBar = document.getElementById('ios-loader-bar');
    if (!loaderBar) {
        loaderBar = document.createElement('div');
        loaderBar.id = 'ios-loader-bar';
        loaderBar.className = 'fixed top-0 left-0 h-[3px] bg-primary z-[9999] transition-all duration-300 ease-out shadow-[0_0_8px_rgba(var(--md-sys-color-primary),0.8)]';
        loaderBar.style.width = '0%';
        loaderBar.style.opacity = '0';
        document.body.appendChild(loaderBar);
    }

    // Start Loader
    loaderBar.style.opacity = '1';
    loaderBar.style.width = '30%';

    // iOS Style Animation Out (Quick fade out, no jarring transform)
    mainContent.style.transition = 'opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
    mainContent.style.opacity = '0';
    mainContent.style.pointerEvents = 'none';

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const htmlText = await response.text();
        
        // Progress update
        loaderBar.style.width = '70%';

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const newMainContent = doc.getElementById('main-content');
        
        if (newMainContent) {
            document.title = doc.title;
            
            setTimeout(() => {
                // Swap content
                mainContent.innerHTML = newMainContent.innerHTML;
                
                // Inject missing scripts
                const newScripts = Array.from(doc.querySelectorAll('script[src]'));
                newScripts.forEach(newScript => {
                    const src = newScript.getAttribute('src');
                    if (!document.querySelector(`script[src="${src}"]`)) {
                        const scriptTag = document.createElement('script');
                        scriptTag.src = src;
                        scriptTag.type = newScript.type;
                        document.body.appendChild(scriptTag);
                    }
                });

                // iOS Style Animation In
                // Force a reflow so the transition applies
                void mainContent.offsetWidth; 
                mainContent.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
                mainContent.style.opacity = '1';
                mainContent.style.pointerEvents = 'auto';
                
                if (pushState) {
                    window.history.pushState(null, '', url);
                }
                
                updateSidebarActive(url);
                
                // Finish Loader
                loaderBar.style.width = '100%';
                setTimeout(() => {
                    loaderBar.style.opacity = '0';
                    setTimeout(() => { loaderBar.style.width = '0%'; }, 300);
                }, 300);

                // Dispatch event so modules can re-init
                document.dispatchEvent(new CustomEvent('app:pageLoaded', { detail: { url } }));
            }, 150); // Wait for the 150ms fade-out to finish
        } else {
            window.location.href = url;
        }
    } catch (error) {
        console.error('Failed to load page:', error);
        window.location.href = url; // Fallback
    }
}

function updateSidebarActive(url) {
    const sidebarLinks = document.querySelectorAll('#app-sidebar a[href$=".html"]');
    sidebarLinks.forEach(link => {
        const href = link.getAttribute('href');
        const isMatch = url.endsWith(href);
        
        if (isMatch) {
            link.className = 'flex items-center gap-3 px-3 py-3 rounded-xl whitespace-nowrap group transition-colors duration-200 bg-primary/10 border border-primary/20 text-primary';
            const icon = link.querySelector('.material-symbols-outlined');
            if (icon) icon.classList.add('icon-filled');
        } else {
            link.className = 'flex items-center gap-3 px-3 py-3 rounded-xl whitespace-nowrap group transition-colors duration-200 text-on-surface-variant hover:text-on-surface hover:bg-white/5';
            const icon = link.querySelector('.material-symbols-outlined');
            if (icon) icon.classList.remove('icon-filled');
        }
    });

    const bottomNavLinks = document.querySelectorAll('nav.md\\:hidden a[href$=".html"]');
    bottomNavLinks.forEach(link => {
        const href = link.getAttribute('href');
        const isMatch = url.endsWith(href);
        
        if (isMatch) {
            link.className = 'flex flex-col items-center justify-center text-primary font-bold hover:bg-surface-container p-2 rounded-lg transition-transform scale-90';
            const icon = link.querySelector('.material-symbols-outlined');
            if (icon) icon.classList.add('icon-filled');
        } else {
            link.className = 'flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container p-2 rounded-lg transition-transform hover:scale-90';
            const icon = link.querySelector('.material-symbols-outlined');
            if (icon) icon.classList.remove('icon-filled');
        }
    });
}

// Auto init if included as module
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSPA);
} else {
    initSPA();
}
