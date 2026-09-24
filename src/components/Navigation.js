const TRANSLATIONS = {
    'id': {
        'nav_dashboard': 'Dasbor',
        'nav_kelola': 'Data Inventory',
        'nav_user': 'Manajemen Akun',
        'nav_settings': 'Pengaturan',
        'nav_logout': 'Logout',
        'nav_lang': 'ID',
    },
    'zh': {
        'nav_dashboard': '仪表板',
        'nav_kelola': '库存数据',
        'nav_user': '账户管理',
        'nav_settings': '设置',
        'nav_logout': '退出',
        'nav_lang': '中文',
    }
};

let currentLocale = localStorage.getItem('web_locale') || 'id';

export function initNavigation() {
    currentLocale = localStorage.getItem('web_locale') || 'id';
    window.t = (key) => TRANSLATIONS[currentLocale][key] || key;
}

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
            <img src="${localStorage.getItem('app_logo_url') || '/assets/logo_transparent.png'}" id="app-global-logo" alt="Logo" class="absolute left-0 h-full w-auto transition-all duration-300 ease-in-out opacity-90" style="object-fit: contain; object-position: left;">
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
            <span class="sidebar-text text-[15px] transition-opacity duration-300 ease-in-out">${window.t('nav_dashboard')}</span>
        </a>
        <a class="nav-link flex items-center gap-3 px-3 py-3 rounded-xl whitespace-nowrap group transition-all duration-200 ease-in-out text-on-surface-variant hover:text-on-surface hover:bg-white/5 font-bold" href="kelola_kapal.html" data-path="/kelola_kapal.html">
            <span class="material-symbols-outlined flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ease-in-out text-[26px]">directions_boat</span>
            <span class="sidebar-text text-[15px] transition-opacity duration-300 ease-in-out">${window.t('nav_kelola')}</span>
        </a>
        <a class="nav-link flex items-center gap-3 px-3 py-3 rounded-xl whitespace-nowrap group transition-all duration-200 ease-in-out text-on-surface-variant hover:text-on-surface hover:bg-white/5 font-bold" href="user_management.html" data-path="/user_management.html" id="nav-user-management" style="display:none;">
            <span class="material-symbols-outlined flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ease-in-out text-[26px]">group</span>
            <span class="sidebar-text text-[15px] transition-opacity duration-300 ease-in-out">${window.t('nav_user')}</span>
        </a>
    </nav>
    
    <div class="mt-auto border-t border-white/10 pt-4 flex flex-col gap-2 overflow-hidden shrink-0">
        <!-- Settings moved to top right -->
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

    // 3. Global Header HTML with Settings Button
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
            <div class="flex items-center gap-4">
                <div id="global-header-right" class="flex items-center gap-2 text-on-surface-variant"></div>
                <!-- Settings Toggle Button -->
                <button id="btn-open-settings" class="w-10 h-10 rounded-full bg-surface-container-high border border-white/10 flex items-center justify-center hover:bg-surface-container-highest transition-colors shadow-sm overflow-hidden relative group shrink-0">
                    <span class="material-symbols-outlined text-[22px] text-on-surface-variant group-hover:text-on-surface transition-colors" id="btn-open-settings-icon">settings</span>
                    <img id="btn-open-settings-img" src="" class="w-full h-full object-cover hidden" alt="Avatar">
                </button>
            </div>
        </div>
    </header>
    `;

    // Settings Popup
    const settingsPopupHTML = `
    <style>
      #settings-card {
        position: absolute;
        top: 50%;
        right: 24px;
        transform: translateY(-50%) scale(0.95);
        width: 340px;
        max-width: calc(100% - 2rem);
        background-color: #f2f2f7;
        border-radius: 36px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        border: 1px solid rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        padding: 12px;
        gap: 12px;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        opacity: 0;
        z-index: 101;
      }
      .dark #settings-card {
        background-color: #000000;
        border-color: rgba(255,255,255,0.1);
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      }
      #settings-card.scale-100 {
        transform: translateY(-50%) scale(1);
        opacity: 1;
      }
      @media (max-width: 768px) {
        #settings-card {
          right: 16px;
        }
      }
      .settings-section {
        background-color: #ffffff;
        border-radius: 28px;
        padding: 8px;
        display: flex;
        flex-direction: column;
      }
      .dark .settings-section {
        background-color: #1C1C1E;
      }
      .settings-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        border-radius: 20px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .settings-row:hover {
        background-color: rgba(0,0,0,0.05);
      }
      .dark .settings-row:hover {
        background-color: rgba(255,255,255,0.05);
      }
      .settings-text {
        font-size: 15px;
        font-weight: 600;
        color: #000000;
        margin-left: 12px;
      }
      .dark .settings-text {
        color: #ffffff;
      }
      .settings-subtext {
        font-size: 14px;
        color: #8e8e93;
        margin-right: 4px;
      }
      .settings-divider {
        height: 1px;
        background-color: rgba(0,0,0,0.05);
        margin: 2px 16px;
      }
      .dark .settings-divider {
        background-color: rgba(255,255,255,0.05);
      }
      .settings-icon-wrapper {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        flex-shrink: 0;
      }
    </style>
    <!-- Overlay Settings Panel -->
    <div id="settings-panel" class="fixed inset-0 z-[100] hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
        <!-- Backdrop -->
        <div id="settings-backdrop" class="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity opacity-0 cursor-pointer" style="position: absolute; top:0; left:0; width:100%; height:100%;"></div>
        
        <!-- Panel Card -->
        <div id="settings-card">
            
            <!-- Header/Profile Section -->
            <div class="settings-section" style="padding: 12px;">
              <div class="flex items-center gap-4 relative">
                <div class="w-[56px] h-[56px] rounded-full flex items-center justify-center shrink-0 overflow-hidden relative group cursor-pointer" id="settings-avatar-wrapper" title="Ubah Foto Profil" style="background-color: #e5e5ea;">
                  <img src="" id="settings-avatar-img" class="w-full h-full object-cover hidden" alt="Avatar">
                  <span class="material-symbols-outlined text-3xl text-gray-500" id="settings-avatar-icon">person</span>
                  <div class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                     <span class="material-symbols-outlined text-white text-[20px]">add_a_photo</span>
                  </div>
                  <input type="file" id="input-avatar-upload" accept="image/*" class="hidden">
                </div>
                <div class="min-w-0 flex-1">
                  <h2 class="text-[19px] font-semibold tracking-tight truncate settings-text" style="margin-left:0;" id="settings-profile-name">Admin</h2>
                  <p class="text-[13px] text-gray-500 mt-0.5" style="margin-left:0;" id="settings-profile-role">Akun Apple, iCloud, dan lainnya</p>
                </div>
                <span class="material-symbols-outlined text-gray-400 text-[20px] mr-2">chevron_right</span>
              </div>
            </div>
            
            <!-- Settings List Section -->
            <div class="settings-section">
                
                <!-- Mode Terang/Gelap -->
                <div class="settings-row" id="panel-theme-row">
                    <div class="flex items-center">
                      <div class="settings-icon-wrapper" style="background-color: #FF9500;" id="panel-theme-icon-container">
                        <span class="material-symbols-outlined text-[18px]" id="panel-theme-icon">light_mode</span>
                      </div>
                      <span class="settings-text" id="panel-theme-text">Mode Terang</span>
                    </div>
                    <!-- Toggle -->
                    <button id="panel-theme-toggle" class="relative inline-flex h-[32px] w-[52px] shrink-0 items-center rounded-full transition-colors duration-300" style="background-color: #34C759;">
                      <span class="inline-block h-[28px] w-[28px] transform rounded-full bg-white transition-transform duration-300 shadow-sm pointer-events-none translate-x-[22px]" id="panel-theme-knob"></span>
                    </button>
                </div>
                
                <div class="settings-divider"></div>

                <!-- Bahasa -->
                <div class="settings-row" id="panel-lang-row">
                    <div class="flex items-center">
                      <div class="settings-icon-wrapper" style="background-color: #007AFF;">
                        <span class="material-symbols-outlined text-[18px]">language</span>
                      </div>
                      <span class="settings-text" id="panel-lang-text">Bahasa</span>
                    </div>
                    <div class="flex items-center">
                      <select id="lang-select" class="bg-transparent text-[14px] text-gray-500 font-semibold outline-none border-none cursor-pointer text-right appearance-none mr-1" style="background:transparent; color:#8e8e93;">
                         <option value="id">Indonesia (ID)</option>
                         <option value="zh">中文 (ZH)</option>
                      </select>
                      <span class="material-symbols-outlined text-gray-400 text-[20px] pointer-events-none">expand_more</span>
                    </div>
                </div>

                <div class="settings-divider"></div>
                  
                <!-- Tautkan Akun Google -->
                <div class="settings-row" id="btn-link-google">
                    <div class="flex items-center">
                      <div class="settings-icon-wrapper" style="background-color: #ffffff; border: 1px solid rgba(0,0,0,0.1);">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-[18px] h-[18px]">
                      </div>
                      <span class="settings-text">Tautkan Akun Google</span>
                    </div>
                    <span class="material-symbols-outlined text-gray-400 text-[20px]">chevron_right</span>
                </div>

                <!-- Admin Only: Ganti Logo -->
                <div id="admin-only-settings" style="display:none; flex-direction:column;">
                    <div class="settings-divider"></div>
                    <div class="settings-row" id="panel-logo-row">
                        <div class="flex items-center">
                          <div class="settings-icon-wrapper" style="background-color: #AF52DE;">
                            <span class="material-symbols-outlined text-[18px]">imagesmode</span>
                          </div>
                          <span class="settings-text" id="panel-logo-text">Ganti Logo App</span>
                        </div>
                        <span class="material-symbols-outlined text-gray-400 text-[20px]">chevron_right</span>
                        <input type="file" id="input-app-logo" accept="image/*" class="hidden">
                    </div>
                </div>
            </div>

            <!-- Logout Section -->
            <div class="settings-section">
                <div class="settings-row" id="btn-logout">
                    <div class="flex items-center">
                      <div class="settings-icon-wrapper" style="background-color: #FF3B30;">
                        <span class="material-symbols-outlined text-[18px]">logout</span>
                      </div>
                      <span class="settings-text" style="color: #FF3B30;">Logout</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    // 4. Inject into DOM
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

    const mainContent = document.getElementById('main-content');
    if (mainContent && !document.getElementById('global-top-bar')) {
        mainContent.insertAdjacentHTML('afterbegin', headerHTML);
    }

    document.body.insertAdjacentHTML('beforeend', bottomNavHTML);

    if (!document.getElementById('settings-panel')) {
        document.body.insertAdjacentHTML('beforeend', settingsPopupHTML);
    }

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

        /* SPA page transition */
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

        #main-content > main { view-transition-name: main-content; }
        #app-sidebar, #global-top-bar, #mobile-bottom-nav, #settings-panel { view-transition-name: none; }
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

    // 10. Settings Popup Logic
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsBackdrop = document.getElementById('settings-backdrop');
    const settingsCard = document.getElementById('settings-card');
    
    function closeSettings() {
        settingsBackdrop.classList.remove('opacity-100');
        settingsCard.classList.remove('scale-100', 'opacity-100');
        setTimeout(() => settingsPanel.classList.add('hidden'), 300);
    }

    if (btnOpenSettings) {
        btnOpenSettings.addEventListener('click', () => {
            settingsPanel.classList.remove('hidden');
            // Allow display block to apply before animating opacity
            setTimeout(() => {
                settingsBackdrop.classList.add('opacity-100');
                settingsCard.classList.add('scale-100', 'opacity-100');
            }, 10);
        });
    }
    
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettings);

    // 11. Theme Logic
    const themeRow = document.getElementById('panel-theme-row');
    const themeKnob = document.getElementById('panel-theme-knob');
    const themeIcon = document.getElementById('panel-theme-icon');
    const themeIconContainer = document.getElementById('panel-theme-icon-container');
    const themeText = document.getElementById('panel-theme-text');
    let isDark = localStorage.getItem('theme') !== 'light';
    
    function applyTheme() {
        if (isDark) {
            document.documentElement.classList.add('dark');
            if(themeKnob) {
                themeKnob.style.transform = 'translateX(24px)';
                themeKnob.parentElement.style.backgroundColor = '#34C759';
            }
            if(themeIcon) themeIcon.textContent = 'dark_mode';
            if(themeIconContainer) {
                themeIconContainer.style.backgroundColor = '#5E5CE6';
            }
            if(themeText) themeText.textContent = 'Mode Gelap';
        } else {
            document.documentElement.classList.remove('dark');
            if(themeKnob) {
                themeKnob.style.transform = 'translateX(0px)';
                themeKnob.parentElement.style.backgroundColor = '#E5E5EA';
            }
            if(themeIcon) themeIcon.textContent = 'light_mode';
            if(themeIconContainer) {
                themeIconContainer.style.backgroundColor = '#FF9500';
            }
            if(themeText) themeText.textContent = 'Mode Terang';
        }
    }
    applyTheme(); // apply immediately

    if (themeRow) {
        themeRow.addEventListener('click', () => {
            isDark = !isDark;
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            applyTheme();
        });
    }

    // 12. Bind Language Dropdown
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        // Set initial selected option
        langSelect.value = localStorage.getItem('web_locale') || 'id';

        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            localStorage.setItem('web_locale', newLang);
            currentLocale = newLang; // Update the module-level variable
            
            // Update sidebar translations dynamically
            const sidebarDash = document.querySelector('a[data-path="/dashboard.html"] .sidebar-text');
            if (sidebarDash) sidebarDash.textContent = window.t('nav_dashboard');
            
            const sidebarKelola = document.querySelector('a[data-path="/kelola_kapal.html"] .sidebar-text');
            if (sidebarKelola) sidebarKelola.textContent = window.t('nav_kelola');
            
            const sidebarUser = document.querySelector('a[data-path="/user_management.html"] .sidebar-text');
            if (sidebarUser) sidebarUser.textContent = window.t('nav_user');

            // Update bottom nav translations dynamically
            const bNavDash = document.querySelector('.b-nav-text-dashboard');
            if (bNavDash) bNavDash.textContent = window.t('nav_dashboard');
            
            const bNavKelola = document.querySelector('.b-nav-text-kelola');
            if (bNavKelola) bNavKelola.textContent = window.t('nav_kelola');
            
            const bNavUser = document.querySelector('.b-nav-text-user');
            if (bNavUser) bNavUser.textContent = window.t('nav_user');
            
            // Update settings popup language text
            const panelLangText = document.getElementById('panel-lang-text');
            if (panelLangText) panelLangText.textContent = newLang === 'zh' ? '语言' : 'Bahasa';
            
            // Re-render header if a global function exists in spa.js
            if (typeof window.renderGlobalHeader === 'function') {
                window.renderGlobalHeader();
            }
        });
    }

    // 12b. Bind Ganti Logo App
    const panelLogoRow = document.getElementById('panel-logo-row');
    const inputAppLogo = document.getElementById('input-app-logo');
    if (panelLogoRow && inputAppLogo) {
        panelLogoRow.addEventListener('click', () => {
            inputAppLogo.click();
        });
        inputAppLogo.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                // Tampilkan loading state sederhana di ikon
                const iconSpan = panelLogoRow.querySelector('.material-symbols-outlined');
                if (iconSpan) iconSpan.textContent = 'hourglass_top';

                const { supabase } = await import('../supabaseClient.js');
                if (supabase) {
                    const filePath = 'public/logo_transparent.png';
                    const { data, error } = await supabase.storage
                        .from('inspeksi_foto')
                        .upload(filePath, file, {
                            cacheControl: '3600',
                            upsert: true
                        });
                    
                    if (error) {
                        console.error("Error uploading logo to Supabase:", error);
                        throw error;
                    }
                    
                    const { data: publicUrlData } = supabase.storage
                        .from('inspeksi_foto')
                        .getPublicUrl(filePath);
                    
                    const timestampedUrl = publicUrlData.publicUrl + '?t=' + new Date().getTime();
                    
                    localStorage.setItem('app_logo_url', timestampedUrl);
                    
                    const globalLogo = document.getElementById('app-global-logo');
                    if (globalLogo) globalLogo.src = timestampedUrl;
                    const mobileLogo = document.getElementById('mobile-app-logo');
                    if (mobileLogo) mobileLogo.src = timestampedUrl;
                    
                    if (iconSpan) iconSpan.textContent = 'imagesmode';
                    alert('Logo aplikasi berhasil diperbarui di server!');
                }
            } catch (err) {
                console.error("Failed to upload logo:", err);
                const reader = new FileReader();
                reader.onload = function(event) {
                    const base64 = event.target.result;
                    localStorage.setItem('app_logo_url', base64);
                    const globalLogo = document.getElementById('app-global-logo');
                    if (globalLogo) globalLogo.src = base64;
                    const mobileLogo = document.getElementById('mobile-app-logo');
                    if (mobileLogo) mobileLogo.src = base64;
                    
                    const iconSpan = panelLogoRow.querySelector('.material-symbols-outlined');
                    if (iconSpan) iconSpan.textContent = 'imagesmode';
                    alert('Logo berhasil diperbarui secara lokal (gagal ke server).');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 13. Update header from current page config
    updateGlobalHeader();

    // 14. Bind Logout, Admin features, Google Link, Profile details
    import('../auth.js').then(({ logout }) => {
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            const newBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
            newBtn.addEventListener('click', logout);
        }
        
        // Show user management if admin
        import('../supabaseClient.js').then(({ supabase }) => {
            if (supabase) {
                supabase.auth.getUser().then(({ data: { user } }) => {
                    if (user) {
                        supabase.from('profiles').select('*').eq('id', user.id).single().then(({data}) => {
                            if (data) {
                                if (data.role === 'admin') {
                                    const userNav = document.getElementById('nav-user-management');
                                    if (userNav) userNav.style.display = 'flex';
                                    
                                    const bottomUserNav = document.getElementById('bottom-nav-user-management');
                                    if (bottomUserNav) bottomUserNav.style.display = 'flex';

                                    // Show Admin Only Settings
                                    const adminSettings = document.getElementById('admin-only-settings');
                                    if (adminSettings) adminSettings.style.display = 'flex';
                                    
                                    const roleEl = document.getElementById('settings-profile-role');
                                    if (roleEl) roleEl.textContent = 'ADMINISTRATOR';
                                } else {
                                    const roleEl = document.getElementById('settings-profile-role');
                                    if (roleEl) roleEl.textContent = 'STAF OPERASIONAL';
                                }
                                if (data.nama) {
                                    const nameEl = document.getElementById('settings-profile-name');
                                    if (nameEl) nameEl.textContent = data.nama;
                                }
                                if (data.avatar_url) {
                                    const url = `${supabase.storage.from('avatars').getPublicUrl(data.avatar_url).data.publicUrl}?t=${new Date().getTime()}`;
                                    const imgEl = document.getElementById('settings-avatar-img');
                                    const iconEl = document.getElementById('settings-avatar-icon');
                                    const tbImgEl = document.getElementById('btn-open-settings-img');
                                    const tbIconEl = document.getElementById('btn-open-settings-icon');
                                    if(imgEl) { imgEl.src = url; imgEl.classList.remove('hidden'); }
                                    if(iconEl) iconEl.classList.add('hidden');
                                    if(tbImgEl) { tbImgEl.src = url; tbImgEl.classList.remove('hidden'); }
                                    if(tbIconEl) tbIconEl.classList.add('hidden');
                                }
                            }
                        });
                        
                        // Link Google
                        const btnLinkGoogle = document.getElementById('btn-link-google');
                        if (btnLinkGoogle) {
                            const isGoogleLinked = user.identities?.some(id => id.provider === 'google');
                            if (isGoogleLinked) {
                                const span = btnLinkGoogle.querySelector('span');
                                if (span) span.textContent = 'Akun Google Tertaut';
                                btnLinkGoogle.classList.add('opacity-50', 'pointer-events-none');
                            } else {
                                btnLinkGoogle.addEventListener('click', async () => {
                                    await supabase.auth.linkIdentity({ provider: 'google' });
                                });
                            }
                        }
                    }
                });
            }
        }).catch(err => {
            console.log('supabaseClient.js not loaded:', err);
        });
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
        initNavigation();
        renderNavigation();
        setupSPA();
    });
} else {
    initNavigation();
    renderNavigation();
    setupSPA();
}
