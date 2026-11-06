/* =====================================================================
   PRODUCTS: categories, product grid, filters, search, wishlist, quick view
   ===================================================================== */

let currentFilter = 'all';
let currentSort = 'popular';
let searchQuery = '';
let visibleCount = PAGE_SIZE;
let wishlist = loadStored('wishlist', []);

/* ---------- image slot: real <img> when `image` is set, emoji otherwise ---------- */
function mediaHTML(kind, item) {
    const img = item.image
        ? `<img class="media-img" src="${IMAGE_PATH[kind]}${encodeURI(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.remove()">`
        : '';
    return `<span class="media">${img}<span class="media-emoji" aria-hidden="true">${item.emoji}</span></span>`;
}

const STAR_PATH = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>';
function starsHTML(rating) {
    return [1, 2, 3, 4, 5].map(i =>
        `<svg viewBox="0 0 24 24" fill="${i <= Math.floor(rating) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5">${STAR_PATH}</svg>`
    ).join('');
}
const discountOf = p => Math.round(((p.mrp - p.price) / p.mrp) * 100);

/* ---------- categories ---------- */
function renderCategories() {
    document.getElementById('catGrid').innerHTML = categories.map(c => `
        <button type="button" class="cat-card" onclick="filterByCategory('${c.cat}')" aria-label="Shop ${escapeHTML(c.name)}">
            <div class="cat-icon">${mediaHTML('categories', c)}</div>
            <div class="cat-name">${c.name}</div>
            <div class="cat-count">${c.count}</div>
        </button>`).join('');
}

/* ---------- filtering / sorting ---------- */
function getFilteredProducts() {
    let list = allProducts.slice();                                  // never mutate the source array

    if (currentFilter === 'wishlist') list = list.filter(p => wishlist.includes(p.id));
    else if (currentFilter !== 'all') list = list.filter(p => p.cat === currentFilter);

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        list = list.filter(p => {
            const catName = (categories.find(c => c.cat === p.cat) || {}).name || '';
            return [p.name, p.brand, p.cat.replace('-', ' '), catName, p.desc].some(s => s.toLowerCase().includes(q));
        });
    }

    const sorters = {
        'price-low': (a, b) => a.price - b.price,
        'price-high': (a, b) => b.price - a.price,
        'discount': (a, b) => discountOf(b) - discountOf(a),
        'rating': (a, b) => b.rating - a.rating,
        'popular': (a, b) => b.popular - a.popular
    };
    return list.sort(sorters[currentSort] || sorters.popular);
}

function productCardHTML(p) {
    const discount = discountOf(p);
    const wished = wishlist.includes(p.id);
    return `
    <article class="product-card">
        <div class="product-img">
            <div class="product-tags">
                ${discount > 0 ? `<span class="tag tag-discount">${discount}% OFF</span>` : ''}
                ${p.prescription ? '<span class="tag tag-rx">Rx</span>' : ''}
                ${p.tags.includes('new') ? '<span class="tag tag-new">NEW</span>' : ''}
                ${p.tags.includes('hot') ? '<span class="tag tag-hot">🔥 HOT</span>' : ''}
            </div>
            <button class="product-wishlist ${wished ? 'active' : ''}" onclick="toggleWishlist(${p.id})"
                aria-label="${wished ? 'Remove from' : 'Add to'} wishlist" aria-pressed="${wished}">
                <svg viewBox="0 0 24 24" fill="${wished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            ${mediaHTML('products', p)}
        </div>
        <div class="product-body">
            <div class="product-brand">${escapeHTML(p.brand)}</div>
            <h3 class="product-name">${escapeHTML(p.name)}</h3>
            <div class="product-rating">
                <div class="stars">${starsHTML(p.rating)}</div>
                <span class="rating-count">${p.rating} (${p.reviews})</span>
            </div>
            <div class="product-price-row">
                <span class="price">₹${p.price}</span>
                ${p.mrp > p.price ? `<span class="mrp">₹${p.mrp}</span><span class="save">Save ₹${p.mrp - p.price}</span>` : ''}
            </div>
            <div class="product-meta">${p.prescription ? '⚠️ Prescription required' : '✓ In stock · Free delivery'}</div>
            <div class="product-actions">
                <button class="btn-cart" onclick="addToCart(${p.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <span class="btn-label-full">Add to Cart</span><span class="btn-label-short">Add</span>
                </button>
                <button class="btn-quick" onclick="quickView(${p.id})" title="Quick view" aria-label="Quick view">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </div>
        </div>
    </article>`;
}

function renderProducts() {
    const list = getFilteredProducts();
    const visible = list.slice(0, visibleCount);
    const grid = document.getElementById('productGrid');
    const info = document.getElementById('resultsInfo');

    document.getElementById('loadMoreWrap').hidden = visibleCount >= list.length;

    if (list.length === 0) {
        info.textContent = '';
        const isWish = currentFilter === 'wishlist' && !searchQuery;
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-ico">${isWish ? '🤍' : '🔍'}</div>
                <h3>${isWish ? 'Your wishlist is empty' : searchQuery ? `No products found for “${escapeHTML(searchQuery)}”` : 'No products found'}</h3>
                <p>${isWish ? 'Tap the heart on any product to save it here.' : 'Try a different search term or browse the categories.'}</p>
            </div>`;
        return;
    }

    const label = currentFilter === 'wishlist' ? ' in your wishlist' : searchQuery ? ` for “${escapeHTML(searchQuery)}”` : '';
    info.innerHTML = `Showing ${visible.length} of ${list.length} products${label}`;
    grid.innerHTML = visible.map(productCardHTML).join('');
}

/* ---------- filter / sort / paging controls ---------- */
function setFilter(cat, { scroll = false, keepSearch = false } = {}) {
    currentFilter = cat;
    visibleCount = PAGE_SIZE;
    if (!keepSearch) {
        searchQuery = '';
        document.getElementById('searchInput').value = '';
    }
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === cat));
    setActiveNav(cat === 'all' || cat === 'wishlist' ? null : cat);
    renderProducts();
    if (scroll) document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

function filterByCategory(cat) { setFilter(cat, { scroll: true }); }
function showWishlist() { setFilter('wishlist', { scroll: true }); }

function sortProducts() {
    currentSort = document.getElementById('sortSelect').value;
    renderProducts();
}

function loadMoreProducts() {
    visibleCount += PAGE_SIZE;
    renderProducts();
}

/* ---------- search ---------- */
function setupSearch() {
    const input = document.getElementById('searchInput');
    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            searchQuery = input.value.trim();
            visibleCount = PAGE_SIZE;
            if (searchQuery && currentFilter !== 'all') setFilter('all', { keepSearch: true });   // search across everything
            else renderProducts();
        }, 150);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
}

function handleSearch() {
    searchQuery = document.getElementById('searchInput').value.trim();
    visibleCount = PAGE_SIZE;
    if (currentFilter !== 'all') setFilter('all', { keepSearch: true }); else renderProducts();
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('searchInput').blur();
}

/* ---------- wishlist ---------- */
function toggleWishlist(id) {
    if (wishlist.includes(id)) {
        wishlist = wishlist.filter(w => w !== id);
        showToast('Removed from wishlist', 'Product removed from your wishlist', 'info');
    } else {
        wishlist.push(id);
        showToast('Added to wishlist', 'Product saved to your wishlist', 'success');
    }
    saveStored('wishlist', wishlist);
    renderProducts();
}

/* ---------- quick view ---------- */
let qvCurrentQty = 1;

function quickView(id) {
    const p = allProducts.find(pr => pr.id === id);
    if (!p) return;
    qvCurrentQty = 1;
    const discount = discountOf(p);
    const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/></svg>';

    document.getElementById('quickViewBody').innerHTML = `
    <div class="qv-grid">
        <div class="qv-img">${mediaHTML('products', p)}</div>
        <div class="qv-info">
            <div class="qv-brand">${escapeHTML(p.brand)}</div>
            <h2>${escapeHTML(p.name)}</h2>
            <div class="qv-rating">
                <div class="stars">${starsHTML(p.rating)}</div>
                <span class="qv-rating-text">${p.rating} · ${p.reviews} reviews</span>
            </div>
            <div class="qv-price">
                <span class="price">₹${p.price}</span>
                ${p.mrp > p.price ? `<span class="mrp">₹${p.mrp}</span>` : ''}
                ${discount > 0 ? `<span class="save">${discount}% OFF</span>` : ''}
            </div>
            <div class="qv-desc">${escapeHTML(p.desc)}</div>
            <div class="qv-meta">
                <div class="qv-meta-item">${check}<span class="label">In Stock: ${p.stock} units available</span></div>
                <div class="qv-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    <span class="label">Free delivery on orders above ₹${FREE_DELIVERY_MIN}</span>
                </div>
                <div class="qv-meta-item">${check}<span class="label">100% Genuine · Batch verified</span></div>
                ${p.prescription ? `
                <div class="qv-meta-item danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span class="label"><strong>Prescription required</strong> · Upload at checkout</span>
                </div>` : ''}
            </div>
            <div class="qv-qty">
                <label for="qvQty">Quantity:</label>
                <div class="qty-control large">
                    <button class="qty-btn" onclick="qvQty(-1)" aria-label="Decrease quantity">−</button>
                    <input class="qty-val" type="text" id="qvQty" value="1" readonly>
                    <button class="qty-btn" onclick="qvQty(1)" aria-label="Increase quantity">+</button>
                </div>
            </div>
            <div class="qv-actions">
                <button class="btn btn-primary" onclick="qvAddToCart(${p.id})">Add to Cart</button>
                <button class="btn btn-outline" onclick="qvBuyNow(${p.id})">Buy Now</button>
            </div>
        </div>
    </div>`;
    openModal('quickViewModal');
}

function qvQty(delta) {
    qvCurrentQty = Math.min(99, Math.max(1, qvCurrentQty + delta));
    document.getElementById('qvQty').value = qvCurrentQty;
}
function qvAddToCart(id) {
    addToCart(id, qvCurrentQty);
    closeModal('quickViewModal');
}
function qvBuyNow(id) {
    addToCart(id, qvCurrentQty, { silent: true });
    openCheckout();
}
