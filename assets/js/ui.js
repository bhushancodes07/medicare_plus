/* =====================================================================
   UI HELPERS: theme, toasts, overlay / drawers / modals, scroll effects
   ===================================================================== */

/* ---------- storage (safe: never throws, e.g. in private mode) ---------- */
function loadStored(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
}
function saveStored(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- theme ---------- */
function applyTheme() {
    let saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
    const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('dark-theme', dark);
}

function toggleTheme() {
    const dark = document.body.classList.toggle('dark-theme');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
}

/* ---------- overlay + scroll lock (single source of truth) ---------- */
function syncOverlay() {
    const menu = document.getElementById('mobileMenu');
    const drawerOpen = !!document.querySelector('.cart-drawer.active, .mobile-menu.active');
    const modalOpen = !!document.querySelector('.modal.active');
    document.getElementById('overlay').classList.toggle('active', drawerOpen);
    document.body.style.overflow = drawerOpen || modalOpen ? 'hidden' : '';

    const burger = document.getElementById('hamburger');
    const menuOpen = menu.classList.contains('active');
    burger.classList.toggle('active', menuOpen);
    burger.setAttribute('aria-expanded', menuOpen);
}

function openCart() {
    document.getElementById('cartDrawer').classList.add('active');
    syncOverlay();
}
function closeCart() {
    document.getElementById('cartDrawer').classList.remove('active');
    syncOverlay();
}

function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('active');
    syncOverlay();
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
    syncOverlay();
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    syncOverlay();
}

function closeAll() {
    document.querySelectorAll('.cart-drawer, .mobile-menu, .modal').forEach(el => el.classList.remove('active'));
    syncOverlay();
}

/* clicking the dark backdrop of a modal closes it */
function setupModals() {
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
}

/* ---------- toasts ---------- */
const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/><circle cx="12" cy="12" r="10"/></svg>'
};

function showToast(title, msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'success' ? '' : ' ' + type);
    toast.setAttribute('role', 'status');

    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.innerHTML = TOAST_ICONS[type] || TOAST_ICONS.success;

    const text = document.createElement('div');
    text.className = 'toast-text';
    const h = document.createElement('h5'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = msg;
    text.append(h, p);

    toast.append(icon, text);
    container.appendChild(toast);
    while (container.children.length > 3) container.firstChild.remove();   // cap stack

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/* ---------- scroll effects & anchors ---------- */
function setupScrollEffects() {
    const header = document.getElementById('header');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const id = a.getAttribute('href');
            if (id === '#') { e.preventDefault(); return; }          // placeholder links
            const target = document.querySelector(id);
            if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
        });
    });
}

function setActiveNav(cat) {
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', cat ? l.dataset.cat === cat : l.getAttribute('href') === '#home');
    });
}

/* ---------- reveal on scroll + animated stat counters ---------- */
function setupReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
        items.forEach(el => { el.classList.add('visible'); const n = el.querySelector('.stat-num'); if (n) n.textContent = formatNum(n); });
        return;
    }
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            const num = entry.target.querySelector('.stat-num');
            if (num) animateNumber(num);
            observer.unobserve(entry.target);                         // run once
        });
    }, { threshold: 0.2 });
    items.forEach(el => observer.observe(el));
}

function animateNumber(el) {
    const target = parseInt(el.dataset.target, 10);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = formatNum(el, target); return; }
    let current = 0;
    const increment = target / 60;
    const step = () => {
        current += increment;
        if (current < target) { el.textContent = formatNum(el, Math.floor(current)); requestAnimationFrame(step); }
        else el.textContent = formatNum(el, target);
    };
    step();
}

function formatNum(el, n = parseInt(el.dataset.target, 10)) {
    if (el.dataset.suffix) return n + el.dataset.suffix;
    if (n >= 100000) return (n / 100000).toFixed(1).replace('.0', '') + 'L+';
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K+';
    return n + '+';
}
