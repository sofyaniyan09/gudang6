// ============================================================
// Navigation.js — Global Sidebar, Header, and SPA Router
// ============================================================

// Shared function: update the global header bar from page-header-config
function updateGlobalHeader() {
    const config = document.getElementById('page-header-config');
    if (!config) return;

    const titleEl = document.getElementById('global-header-title');
    const leftEl  = document.getElementById('global-header-left');
    const rightEl = document.getElementById('global-header-right');
    if (!titleEl || !leftEl || !rightEl) return;

    titleEl.innerHTML = config.querySelector('.page-title')?.innerHTML || '';
    leftEl.innerHTML  = config.querySelector('.left-actions')?.innerHTML || '';
    rightEl.innerHTML = config.querySelector('.right-actions')?.innerHTML || '';

    // Clear placeholders to prevent duplicate IDs
    const la = config.querySelector('.left-actions');
    const ra = config.querySelector('.right-actions');
    if (la) la.innerHTML = '';
    if (ra) ra.innerHTML = '';

    // Special handling for search placeholder (kelola_kapal)
    const searchPlaceholder = document.getElementById('original-search-placeholder');
    if (searchPlaceholder) {
        while (searchPlaceholder.firstChild) {
            rightEl.appendChild(searchPlaceholder.firstChild);
        }
    }
}

// ============================================================
// renderNavigation — injects sidebar + header + bottom nav
// ============================================================
export function renderNavigation() {
    // 1. Sidebar HTML
    const sidebarHTML = `
<aside id="app-sidebar" class="hidden md:flex fixed left-0 top-0 h-full flex-col p-4 z-40 bg-surface-container-lowest/80 backdrop-blur-2xl border-r border-white/10 w-64 shadow-xl transition-all duration-300 ease-in-out">
    <!-- Modern minimal toggle: a small pill that appears on the sidebar edge -->
    <button id="btn-toggle-sidebar" class="sidebar-toggle-btn absolute -right-[14px] top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-[14px] h-[40px] rounded-r-lg bg-surface-container-highest/80 backdrop-blur-md border border-l-0 border-white/10 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100" title="Toggle Sidebar">
        <svg class="toggle-chevron w-3.5 h-3.5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
    
    <div class="mb-lg px-2 pt-2 flex items-center gap-1 overflow-hidden shrink-0">
        <!-- Logo Wrapper with wider width to prevent cutoff -->
        <div class="relative shrink-0 flex items-center justify-start overflow-hidden" style="width: 55px; height: 45px;">
            <img src="/assets/logo_transparent.png" alt="Logo" class="absolute left-0 h-full w-auto transition-all duration-300 ease-in-out opacity-90" style="object-fit: contain; object-position: left;">
        </div>
        <div class="sidebar-text flex items-center gap-2 transition-opacity duration-300 ease-in-out">
            <span class="font-black text-primary leading-none text-3xl tracking-tighter">CC</span>
            <div class="flex flex-col justify-center text-xs font-bold text-on-surface-variant leading-tight">
                <span>Penerimaan</span>
                <span>Material</span>
            </div>
        </div>
    </div>
    
    <nav class="flex-1 flex flex-col justify-center gap-2 overflow-y-auto overflow-x-hidden pr-2 pb-lg mt-6" id="sidebar-nav-links">
        <a class="nav-link flex items-center gap-3 px-3 py-3 rounded-xl whitespace-nowrap group transition-all duration-200 ease-in-out text-on-surface-variant hover:text-on-surface hover:bg-white/5 font-bold" href="dashboard.html" data-path="/dashboard.html">
            <span class="material-symbols-outlined flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ease-in-out text-[26px]">dashboard</span>
            <span class="sidebar-text text-[15px] transition-opacity duration-300 ease-in-out">Dashboard</span>
        </a>
        <a class="nav-link flex items-center gap-3 px-3 py-3 rounded-xl whitespace-nowrap group transition-all duration-200 ease-in-out text-on-surface-variant hover:text-on-surface hover:bg-white/5 font-bold" href="kelola_kapal.html" data-path="/kelola_kapal.html">
            <span class="material-symbols-outlined flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ease-in-out text-[26px]">directions_boat</span>
            <span class="sidebar-text text-[15px] transition-opacity duration-300 ease-in-out">Inventory Data</span>
        </a>
        <a class="nav-link flex items-center gap-3 px-3 py-3 rounded-xl whitespace-nowrap group transition-all duration-200 ease-in-out text-on-surface-variant hover:text-on-surface hover:bg-white/5 font-bold" href="user_management.html" data-path="/user_management.html">
            <span class="material-symbols-outlined flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ease-in-out text-[26px]">group</span>
            <span class="sidebar-text text-[15px] transition-opacity duration-300 ease-in-out">User Management</span>
        </a>
    </nav>
    
    <div class="mt-auto border-t border-white/10 pt-4 flex flex-col gap-2 overflow-hidden shrink-0">
        <a class="flex items-center gap-3 px-3 py-3 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-xl transition-all duration-200 ease-in-out whitespace-nowrap group font-bold" href="#">
            <span class="material-symbols-outlined text-[26px] flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ease-in-out" data-icon="settings">settings</span>
            <span class="sidebar-text text-[15px] transition-opacity duration-300 ease-in-out">Settings</span>
        </a>
        <button id="btn-logout" class="w-full flex items-center gap-3 px-3 py-3 text-error hover:text-error hover:bg-error/10 rounded-xl transition-all duration-200 ease-in-out text-left whitespace-nowrap group font-bold">
            <span class="material-symbols-outlined text-[26px] flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ease-in-out">logout</span>
            <span class="sidebar-text text-[15px] font-bold transition-opacity duration-300 ease-in-out">Logout</span>
        </button>
    </div>
</aside>
`;

    // 2. Bottom Nav HTML (Mobile)
    const bottomNavHTML = `
<nav id="mobile-bottom-nav" class="md:hidden fixed bottom-0 left-0 w-full z-50 bg-[#24262f] shadow-[0_-4px_25px_rgba(0,0,0,0.5)] rounded-t-[32px] flex items-center justify-between px-6 pb-6 pt-4 text-on-surface-variant transition-transform duration-300 ease-in-out transform translate-y-0">
    <a href="dashboard.html" class="nav-link-mobile flex flex-col items-center p-2 hover:text-primary transition-all duration-200 ease-in-out" data-path="/dashboard.html">
        <span class="material-symbols-outlined text-[28px] transition-transform duration-200 ease-in-out hover:scale-110">home</span>
    </a>
    
    <div class="relative w-16 h-16 -mt-12 flex-shrink-0">
        <a href="kelola_kapal.html" class="nav-link-mobile absolute inset-0 bg-surface-container-high text-on-surface-variant rounded-full flex items-center justify-center border-[6px] border-[#10131b] shadow-lg transition-all duration-300 ease-in-out hover:scale-105 z-10" data-path="/kelola_kapal.html">
            <span class="material-symbols-outlined text-[28px]">directions_boat</span>
        </a>
    </div>

    <a href="#" class="flex flex-col items-center p-2 hover:text-primary transition-all duration-200 ease-in-out">
        <span class="material-symbols-outlined text-[28px] transition-transform duration-200 ease-in-out hover:scale-110">qr_code_scanner</span>
    </a>

    <a href="#" class="flex flex-col items-center p-2 hover:text-primary transition-all duration-200 ease-in-out">
        <span class="material-symbols-outlined text-[28px] transition-transform duration-200 ease-in-out hover:scale-110">search</span>
    </a>

    <a href="user_management.html" class="nav-link-mobile flex flex-col items-center p-2 hover:text-primary transition-all duration-200 ease-in-out" data-path="/user_management.html">
        <span class="material-symbols-outlined text-[28px] transition-transform duration-200 ease-in-out hover:scale-110">person</span>
    </a>
</nav>
`;

    // 3. Global Header HTML
    const headerHTML = `
    <header id="global-top-bar" class="sticky top-0 right-0 z-30 w-full bg-background/80 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
        <div class="max-w-[1536px] mx-auto w-full px-4 md:px-6 py-4 flex justify-between items-center">
            <div class="flex items-center gap-4">
                <button id="btn-mobile-menu" class="md:hidden text-on-surface-variant hover:text-on-surface transition-colors">
                    <span class="material-symbols-outlined text-[24px]">menu</span>
                </button>
                <div id="global-header-left"></div>
                <h1 id="global-header-title" class="text-[22px] font-bold text-on-surface flex items-center gap-2">Overview</h1>
            </div>
            <div id="global-header-right" class="flex items-center gap-2 text-on-surface-variant"></div>
        </div>
    </header>
    `;

    // 4. Inject into DOM
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

    const mainContent = document.getElementById('main-content');
    if (mainContent && !document.getElementById('global-top-bar')) {
        mainContent.insertAdjacentHTML('afterbegin', headerHTML);
    }

    document.body.insertAdjacentHTML('beforeend', bottomNavHTML);

    // 5. Highlight Active Link
    highlightActiveLinks(window.location.pathname);

    // 6. Add View Transition meta tag
    if (!document.querySelector('meta[name="view-transition"]')) {
        const meta = document.createElement('meta');
        meta.name = 'view-transition';
        meta.content = 'same-origin';
        document.head.appendChild(meta);
    }

    // 7. Inject CSS for sidebar collapse & SPA transitions (NO body fadeIn!)
    const style = document.createElement('style');
    style.id = 'nav-dynamic-styles';
    style.innerHTML = `
        /* Sidebar toggle pill — hidden by default, shows on sidebar hover */
        #app-sidebar { transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1); }
        #app-sidebar .sidebar-toggle-btn { opacity: 0; transition: opacity 0.2s ease, background 0.2s ease; }
        #app-sidebar:hover .sidebar-toggle-btn { opacity: 1; }

        /* Collapsed sidebar state */
        .sidebar-collapsed #app-sidebar { width: 5.5rem; }
        .sidebar-collapsed #app-sidebar .sidebar-text { opacity: 0; width: 0; visibility: hidden; }
        .sidebar-collapsed #app-sidebar .sidebar-toggle-btn .toggle-chevron { transform: rotate(180deg); }

        /* Content wrapper slide */
        .content-wrapper { transition: padding-left 0.4s cubic-bezier(0.25, 1, 0.5, 1), margin-left 0.4s cubic-bezier(0.25, 1, 0.5, 1); }
        @media (min-width: 768px) {
            .sidebar-collapsed .content-wrapper.md\\:pl-64 { padding-left: 5.5rem !important; }
            .sidebar-collapsed .content-wrapper.md\\:ml-64 { margin-left: 5.5rem !important; }
        }

        /* SPA page transition — only animates the main content area, NOT sidebar/header */
        ::view-transition-old(main-content),
        ::view-transition-new(main-content) {
            animation-duration: 0.35s;
            animation-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
        }
        ::view-transition-old(main-content) {
            animation-name: spa-fade-out;
        }
        ::view-transition-new(main-content) {
            animation-name: spa-fade-in;
        }
        @keyframes spa-fade-out {
            from { opacity: 1; transform: translateY(0); }
            to   { opacity: 0; transform: translateY(6px); }
        }
        @keyframes spa-fade-in {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        /* Tag the main element for view-transition isolation */
        #main-content > main {
            view-transition-name: main-content;
        }

        /* Ensure sidebar & header are NEVER part of the view transition */
        #app-sidebar,
        #global-top-bar,
        #mobile-bottom-nav {
            view-transition-name: none;
        }
    `;
    if (!document.getElementById('nav-dynamic-styles')) {
        document.head.appendChild(style);
    }

    // 8. Restore sidebar collapsed state
    if (localStorage.getItem('sidebar_collapsed') === 'true') {
        document.documentElement.classList.add('sidebar-collapsed');
    }

    // 9. Sidebar toggle logic
    const sidebarToggleBtn = document.querySelector('#app-sidebar #btn-toggle-sidebar');
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);

    // 10. Update header from current page config
    updateGlobalHeader();

    // 11. Bind Logout
    import('../auth.js').then(({ logout }) => {
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            const newBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
            newBtn.addEventListener('click', logout);
        }
    }).catch(err => {
        console.log('auth.js not loaded:', err);
    });
}

// ============================================================
// Helper: toggle sidebar
// ============================================================
function toggleSidebar(e) {
    if (e) e.preventDefault();
    const isCollapsed = document.documentElement.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed);
}

// ============================================================
// Helper: highlight active nav links
// ============================================================
function highlightActiveLinks(path) {
    // Desktop sidebar
    document.querySelectorAll('#sidebar-nav-links .nav-link').forEach(link => {
        const dp = link.getAttribute('data-path');
        const isActive = path.endsWith(dp) || (path === '/' && dp === '/dashboard.html');
        if (isActive) {
            link.classList.remove('text-on-surface-variant', 'hover:text-on-surface', 'hover:bg-white/5');
            link.classList.add('bg-primary/10', 'border', 'border-primary/20', 'text-primary');
            link.querySelector('.material-symbols-outlined')?.classList.add('icon-filled');
        } else {
            link.classList.add('text-on-surface-variant', 'hover:text-on-surface', 'hover:bg-white/5');
            link.classList.remove('bg-primary/10', 'border', 'border-primary/20', 'text-primary');
            link.querySelector('.material-symbols-outlined')?.classList.remove('icon-filled');
        }
    });

    // Mobile bottom nav
    document.querySelectorAll('#mobile-bottom-nav .nav-link-mobile').forEach(link => {
        const dp = link.getAttribute('data-path');
        const isActive = path.endsWith(dp) || (path === '/' && dp === '/dashboard.html');
        if (isActive) {
            if (dp === '/kelola_kapal.html') {
                link.classList.remove('bg-surface-container-high', 'text-on-surface-variant');
                link.classList.add('bg-[#a8c7fa]', 'text-[#041e49]');
            } else {
                link.classList.add('text-primary');
                link.classList.remove('text-on-surface-variant');
            }
            link.querySelector('.material-symbols-outlined')?.classList.add('icon-filled');
        } else {
            if (dp === '/kelola_kapal.html') {
                link.classList.add('bg-surface-container-high', 'text-on-surface-variant');
                link.classList.remove('bg-[#a8c7fa]', 'text-[#041e49]');
            } else {
                link.classList.remove('text-primary');
                link.classList.add('text-on-surface-variant');
            }
            link.querySelector('.material-symbols-outlined')?.classList.remove('icon-filled');
        }
    });
}

// ============================================================
// SPA Router — intercepts ALL internal links, swaps <main> only
// ============================================================
const SPA_PAGES = ['dashboard.html', 'kelola_kapal.html', 'user_management.html', 'staff_dashboard.html'];

function isSPALink(href) {
    if (!href) return false;
    try {
        const url = new URL(href, window.location.origin);
        // Must be same origin
        if (url.origin !== window.location.origin) return false;
        // Must be one of our known SPA pages
        return SPA_PAGES.some(page => url.pathname.endsWith(page));
    } catch {
        return false;
    }
}

export function setupSPA() {
    const performNavigation = async (url, addToHistory = true) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network error');
            const html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newMain = doc.querySelector('#main-content main');

            if (!newMain) {
                // Fallback: page structure doesn't match, do a full reload
                window.location.href = url;
                return;
            }

            const swapContent = () => {
                const currentMain = document.querySelector('#main-content main');
                if (!currentMain) {
                    window.location.href = url;
                    return;
                }
                currentMain.innerHTML = newMain.innerHTML;
                document.title = doc.title;

                if (addToHistory) {
                    window.history.pushState({ path: url }, '', url);
                }

                highlightActiveLinks(window.location.pathname);
                updateGlobalHeader();

                // Load page-specific scripts if they haven't been loaded yet
                const newScripts = doc.querySelectorAll('script[src]');
                newScripts.forEach(script => {
                    const src = script.getAttribute('src');
                    if (!document.querySelector(`script[src="${src}"]`)) {
                        const newScript = document.createElement('script');
                        newScript.src = src;
                        if (script.type) newScript.type = script.type;
                        document.body.appendChild(newScript);
                    }
                });

                // Dispatch event so page-specific scripts can re-initialize
                document.dispatchEvent(new Event('app:pageLoaded'));
            };

            // Use View Transitions API for smooth macOS-like transition
            if (document.startViewTransition) {
                document.startViewTransition(swapContent);
            } else {
                swapContent();
            }
        } catch (error) {
            console.error('SPA Navigation failed:', error);
            window.location.href = url;
        }
    };

    // Intercept ALL internal link clicks that point to SPA pages
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;

        const href = link.href;
        // Skip hash-only links, external links, and non-SPA pages
        if (!href || href.includes('#') || !isSPALink(href)) return;
        // Skip if modifier keys are held (Cmd+click, Ctrl+click, etc.)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        e.preventDefault();
        // Don't navigate if we're already on the same page
        const targetPath = new URL(href, window.location.origin).pathname;
        if (targetPath === window.location.pathname) return;

        performNavigation(href);
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        performNavigation(window.location.href, false);
    });
}

// ============================================================
// Auto-initialize
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        renderNavigation();
        setupSPA();
    });
} else {
    renderNavigation();
    setupSPA();
}
