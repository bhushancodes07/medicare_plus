/* =====================================================================
   CART & CHECKOUT
   ===================================================================== */

let cart = loadStored('cart', []).filter(i => allProducts.some(p => p.id === i.id));

const getProduct = id => allProducts.find(p => p.id === id);

/* one place that calculates every total (cart drawer + checkout) */
function calcTotals(extra = 0) {
    const subtotal = cart.reduce((s, i) => { const p = getProduct(i.id); return s + (p ? p.price * i.qty : 0); }, 0);
    const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
    const gst = Math.round(subtotal * GST_RATE);
    return { subtotal, delivery, gst, extra, total: subtotal + delivery + gst + extra };
}

function saveCart() { saveStored('cart', cart); }

/* ---------- actions ---------- */
function addToCart(id, qty = 1, { silent = false } = {}) {
    const p = getProduct(id);
    if (!p) return;
    const existing = cart.find(i => i.id === id);
    if (existing) existing.qty = Math.min(99, existing.qty + qty);
    else cart.push({ id, qty, prescription: p.prescription });
    saveCart();
    updateCartUI();

    if (!silent) {
        if (p.prescription) showToast('Added — prescription required', `${p.name} needs a valid prescription. Please upload it at checkout.`, 'info');
        else showToast('Added to Cart', `${qty > 1 ? qty + ' × ' : ''}${p.name} added to your cart`, 'success');
    }
    const btn = document.querySelector('.cart-btn');
    btn.classList.add('bump');
    setTimeout(() => btn.classList.remove('bump'), 220);
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id !== id);
    saveCart();
    updateCartUI();
}

function updateQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.min(99, item.qty + delta);
    if (item.qty <= 0) removeFromCart(id);
    else { saveCart(); updateCartUI(); }
}

/* ---------- render ---------- */
function updateCartUI() {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    ['cartCount', 'mobileCartCount', 'cartItemCount'].forEach(id => { document.getElementById(id).textContent = count; });

    const body = document.getElementById('cartBody');
    const foot = document.getElementById('cartFoot');

    if (cart.length === 0) {
        body.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <h4>Your cart is empty</h4>
                <p>Add medicines and healthcare products to get started</p>
                <button class="btn btn-primary" onclick="closeCart();document.getElementById('products').scrollIntoView({behavior:'smooth'})">Start Shopping</button>
            </div>`;
        foot.hidden = true;
        return;
    }

    body.innerHTML = cart.map(item => {
        const p = getProduct(item.id);
        return `
        <div class="cart-item">
            <div class="cart-item-img">${mediaHTML('products', p)}</div>
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHTML(p.name)}</div>
                <div class="cart-item-meta">${escapeHTML(p.brand)} · ${p.prescription ? '⚠️ Rx required' : 'OTC'}</div>
                <div class="cart-item-controls">
                    <div class="qty-control">
                        <button class="qty-btn" onclick="updateQty(${p.id}, -1)" aria-label="Decrease quantity">−</button>
                        <input class="qty-val" type="text" value="${item.qty}" readonly aria-label="Quantity">
                        <button class="qty-btn" onclick="updateQty(${p.id}, 1)" aria-label="Increase quantity">+</button>
                    </div>
                    <div>
                        <div class="cart-item-price">₹${p.price * item.qty}</div>
                        <button class="cart-item-remove" onclick="removeFromCart(${p.id})">Remove</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    const t = calcTotals();
    document.getElementById('cartSubtotal').textContent = '₹' + t.subtotal;
    document.getElementById('cartDelivery').textContent = t.delivery === 0 ? 'FREE' : '₹' + t.delivery;
    document.getElementById('cartGST').textContent = '₹' + t.gst;
    document.getElementById('cartTotal').textContent = '₹' + t.total;

    const bar = document.getElementById('freeDeliveryBar');
    const unlocked = t.subtotal >= FREE_DELIVERY_MIN;
    bar.classList.toggle('unlocked', unlocked);
    bar.innerHTML = unlocked
        ? '🎉 You have unlocked <strong>FREE delivery</strong>!'
        : `🚚 Add <strong>₹${FREE_DELIVERY_MIN - t.subtotal}</strong> more for FREE delivery!`;
    foot.hidden = false;
}

/* ---------- checkout ---------- */
function selectedPaymentFee() {
    const sel = document.querySelector('.payment-method.selected');
    return sel ? parseInt(sel.dataset.fee || '0', 10) : 0;
}

function openCheckout() {
    if (cart.length === 0) {
        showToast('Cart is empty', 'Add products before checking out', 'error');
        return;
    }
    closeModal('quickViewModal');
    closeCart();
    if (authConfigured() && !currentUser) {          // real orders need an account
        pendingCheckout = true;
        showToast('Please log in', 'Log in or sign up to place your order.', 'info');
        openAuth();
        return;
    }
    renderCheckoutSummary();
    openModal('checkoutModal');
    prepareCheckout();                               // saved address + prescription picker (account.js)
}

function renderCheckoutSummary() {
    const fee = selectedPaymentFee();
    const t = calcTotals(fee);
    document.getElementById('checkoutSummary').innerHTML = `
        <h4>Order Summary</h4>
        ${cart.map(item => {
            const p = getProduct(item.id);
            return `<div class="summary-item"><span>${p.emoji} ${escapeHTML(p.name)} × ${item.qty}</span><span>₹${p.price * item.qty}</span></div>`;
        }).join('')}
        <div class="summary-item"><span>Subtotal</span><span>₹${t.subtotal}</span></div>
        <div class="summary-item"><span>Delivery</span><span>${t.delivery === 0 ? 'FREE' : '₹' + t.delivery}</span></div>
        <div class="summary-item"><span>GST (${GST_RATE * 100}%)</span><span>₹${t.gst}</span></div>
        ${fee ? `<div class="summary-item"><span>COD charges</span><span>₹${fee}</span></div>` : ''}
        <div class="summary-item total"><span>Total</span><span>₹${t.total}</span></div>
        <div class="secure-note">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            100% Secure Payment · 256-bit SSL encrypted
        </div>`;
}

function selectPayment(el) {
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input').checked = true;
    renderCheckoutSummary();                      // COD fee appears / disappears
}

function selectedPayment() {
    const r = document.querySelector('.payment-method.selected input');
    return r ? r.value : 'upi';
}

async function placeOrder(e) {
    e.preventDefault();                           // the browser has already validated required fields
    if (cart.length === 0) { showToast('Cart is empty', 'Add products before checking out', 'error'); return; }

    /* demo mode: Supabase not configured -> keep the old local behaviour */
    if (!authConfigured()) { finishOrder('MPC' + Date.now().toString().slice(-6), 'Our pharmacist will call you shortly.'); return; }
    if (!currentUser) { pendingCheckout = true; openAuth(); return; }

    const btn = document.querySelector('.place-order-btn');
    const label = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Placing order…';
    try {
        const address = readAddress();
        const rx = cartNeedsRx() ? document.getElementById('rxSelect').value : null;
        const items = cart.map(i => ({ id: i.id, qty: i.qty }));
        const order = await createOrder(items, address, selectedPayment(), rx);

        const saveBox = document.getElementById('saveAddr');
        if (saveBox.checked && !document.getElementById('savedAddr').value) {
            try { await insertAddress(address); } catch (err) { console.warn('Address not saved:', err.message); }
        }
        finishOrder(order.out_order_no, 'You can track it under Account → My Orders.');
    } catch (err) {
        showToast('Could not place order', err.message, 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = label;
    }
}

function finishOrder(orderNo, note) {
    showToast('Order Placed! 🎉', `Order ID: ${orderNo}. ${note}`, 'success');
    cart = [];
    saveCart();
    updateCartUI();
    closeModal('checkoutModal');

    document.getElementById('checkoutForm').reset();
    document.querySelectorAll('.payment-method').forEach((m, i) => m.classList.toggle('selected', i === 0));
    loadProductsFromSupabase();                   // refresh stock numbers
}
