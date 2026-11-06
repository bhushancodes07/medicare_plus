/* =====================================================================
   MAIN: wires everything together once the page has loaded
   ===================================================================== */

/* Finds your existing Supabase client (created in config.js) whatever it is called. */
function findSupabaseClient() {
    const list = [
        typeof sb !== 'undefined' ? sb : null,
        typeof supabaseClient !== 'undefined' ? supabaseClient : null,
        typeof sbClient !== 'undefined' ? sbClient : null,
        typeof db !== 'undefined' ? db : null,
        typeof client !== 'undefined' ? client : null,
        window.sb, window.supabaseClient, window.sbClient, window.db, window.client
    ];
    return list.find(c => c && c.auth && typeof c.from === 'function') || null;
}

/* Shows the "Admin" nav link only to logged-in admins. Never breaks the store if it fails. */
function setupAdminLink() {
    try {
        const link = document.getElementById('adminLink');
        const client = findSupabaseClient();
        if (!link) return console.warn('[admin] #adminLink not found in index.html');
        if (!client) return console.warn('[admin] Supabase client not found - check config.js');

        const check = async (session) => {
            link.hidden = true;
            if (!session || !session.user) return;
            const { data, error } = await client.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
            if (error) return console.warn('[admin] profile lookup failed:', error.message);
            link.hidden = !data || data.role !== 'admin';
        };

        client.auth.getSession().then(({ data }) => check(data.session));
        /* re-check on login / logout (setTimeout avoids a Supabase callback deadlock) */
        client.auth.onAuthStateChange((_event, session) => setTimeout(() => check(session), 0));
    } catch (err) {
        console.warn('[admin] setup failed:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    renderCategories();
    renderProducts();
    updateCartUI();
    setupScrollEffects();
    setupReveal();
    setupDragDrop();
    setupSearch();
    setupModals();
    initAuth();
    setupAdminLink();
    loadProductsFromSupabase();

    /* filter chips */
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => setFilter(chip.dataset.filter));
    });

    /* show a fade on the nav when it overflows horizontally */
    const nav = document.querySelector('.nav');
    const navInner = document.querySelector('.nav-inner');
    const updateNavFade = () => nav.classList.toggle('can-scroll', navInner.scrollWidth - navInner.clientWidth - navInner.scrollLeft > 4);
    navInner.addEventListener('scroll', updateNavFade, { passive: true });
    window.addEventListener('resize', updateNavFade);
    updateNavFade();

    /* desktop nav category links */
    document.querySelectorAll('.nav-link[data-cat]').forEach(link => {
        link.addEventListener('click', () => filterByCategory(link.dataset.cat));
    });
});