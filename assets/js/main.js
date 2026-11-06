/* =====================================================================
   MAIN: wires everything together once the page has loaded
   ===================================================================== */

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
