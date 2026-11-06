/* =====================================================================
   ACCOUNT UI: checkout helpers (saved address, prescription picker),
   "My Orders" / "My Prescriptions" popup, products loaded from Supabase
   ===================================================================== */

let pendingCheckout = false;      // user clicked checkout before logging in
let hubTab = 'orders';
let savedAddresses = [];

const loggedIn = () => !!(sb && currentUser);
const cartNeedsRx = () => cart.some(i => { const p = getProduct(i.id); return p && p.prescription; });
const $ = id => document.getElementById(id);

/* ---------- products from the database (falls back to data.js if anything fails) ---------- */
async function loadProductsFromSupabase() {
    if (!sb) return;
    try {
        const rows = await fetchProducts();
        if (!rows.length) return;
        allProducts.splice(0, allProducts.length, ...rows);
        cart = cart.filter(i => getProduct(i.id));
        saveCart();
        renderProducts();
        updateCartUI();
    } catch (err) { console.warn('Using built-in products:', err.message); }
}

/* ---------- checkout preparation ---------- */
async function prepareCheckout() {
    const on = loggedIn();
    $('saveAddrWrap').hidden = !on;
    const needsRx = on && cartNeedsRx();
    $('checkoutRx').hidden = !needsRx;
    $('rxSelect').required = needsRx;
    if (!on) return;

    if (!$('email').value) $('email').value = currentUser.email || '';
    const m = currentUser.user_metadata || {};
    if (!$('fullName').value && m.full_name) $('fullName').value = m.full_name;
    if (!$('phone').value && currentUser.phone) $('phone').value = currentUser.phone;

    try {
        const [addresses, prescriptions] = await Promise.all([fetchAddresses(), needsRx ? fetchPrescriptions() : []]);
        savedAddresses = addresses;
        fillAddressSelect();
        if (needsRx) fillPrescriptionSelect(prescriptions);
    } catch (err) { showToast('Could not load your saved details', err.message, 'error'); }
}

function fillAddressSelect() {
    const sel = $('savedAddr');
    sel.innerHTML = '<option value="">Use a new address</option>' + savedAddresses.map(a =>
        `<option value="${a.id}">${escapeHTML(a.label)} — ${escapeHTML(a.line1)}, ${escapeHTML(a.city)}</option>`).join('');
    $('savedAddrWrap').hidden = savedAddresses.length === 0;
    if (savedAddresses.length && !$('line1').value) { sel.value = savedAddresses[0].id; applySavedAddress(); }
}

function applySavedAddress() {
    const a = savedAddresses.find(x => x.id === $('savedAddr').value);
    if (!a) return;
    $('fullName').value = a.full_name; $('phone').value = a.phone;
    $('line1').value = a.line1; $('line2').value = a.line2;
    $('city').value = a.city; $('state').value = a.state;
    $('pincode').value = a.pincode; $('addrType').value = a.label;
    $('saveAddr').checked = false;
}

function fillPrescriptionSelect(list, selectId) {
    const usable = list.filter(p => p.status !== 'rejected');
    const keep = selectId || $('rxSelect').value;
    $('rxSelect').innerHTML = '<option value="">Select a prescription</option>' + usable.map(p =>
        `<option value="${p.id}">${escapeHTML(p.file_name || 'Prescription')} · ${fmtDate(p.created_at)} (${p.status})</option>`).join('');
    $('rxSelect').value = keep || (usable[0] ? usable[0].id : '');
}

function readAddress() {
    return {
        label: $('addrType').value, full_name: $('fullName').value.trim(), phone: $('phone').value.trim(),
        email: $('email').value.trim(), line1: $('line1').value.trim(), line2: $('line2').value.trim(),
        city: $('city').value.trim(), state: $('state').value, pincode: $('pincode').value.trim()
    };
}

/* called by forms.js after a prescription upload succeeds */
async function onPrescriptionUploaded(row) {
    if ($('checkoutModal').classList.contains('active') && !$('checkoutRx').hidden) {
        fillPrescriptionSelect(await fetchPrescriptions(), row.id);
    }
    if ($('hubModal').classList.contains('active') && hubTab === 'prescriptions') renderHub();
}

/* ---------- My Orders / My Prescriptions popup ---------- */
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const STATUS_LABEL = { placed: 'Order placed', confirmed: 'Confirmed', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' };
const PAY_LABEL = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking', cod: 'Cash on Delivery' };

function openHub(tab) {
    if (!loggedIn()) { openAuth(); return; }
    closeModal('authModal');
    setHubTab(tab || 'orders');
    openModal('hubModal');
}

function setHubTab(tab) {
    hubTab = tab;
    document.querySelectorAll('[data-hub]').forEach(b => b.classList.toggle('active', b.dataset.hub === tab));
    $('hubTitle').textContent = tab === 'orders' ? 'My Orders' : 'My Prescriptions';
    $('hubUpload').hidden = tab !== 'prescriptions';
    renderHub();
}

async function renderHub() {
    const box = $('hubList');
    box.innerHTML = '<p class="hub-empty">Loading…</p>';
    try {
        box.innerHTML = hubTab === 'orders' ? ordersHTML(await fetchOrders()) : prescriptionsHTML(await fetchPrescriptions());
    } catch (err) { box.innerHTML = `<p class="hub-empty">${escapeHTML(err.message)}</p>`; }
}

function ordersHTML(orders) {
    if (!orders.length) return '<p class="hub-empty">🛍️<br>No orders yet. Your orders will appear here.</p>';
    return orders.map(o => `
        <div class="order-card">
            <div class="order-top">
                <div><strong>#${escapeHTML(o.order_no)}</strong><div class="order-date">${fmtDate(o.created_at)} · ${PAY_LABEL[o.payment_method] || o.payment_method}</div></div>
                <span class="status-badge st-${o.status}">${STATUS_LABEL[o.status] || o.status}</span>
            </div>
            <ul class="order-items">${(o.order_items || []).map(i =>
                `<li><span>${i.emoji || '💊'} ${escapeHTML(i.name)} × ${i.qty}</span><span>₹${i.price * i.qty}</span></li>`).join('')}</ul>
            <div class="order-total"><span>Total</span><strong>₹${o.total}</strong></div>
        </div>`).join('');
}

function prescriptionsHTML(list) {
    if (!list.length) return '<p class="hub-empty">📋<br>No prescriptions uploaded yet.</p>';
    return list.map(p => `
        <div class="order-card rx-card">
            <div class="order-top">
                <div><strong>${escapeHTML(p.file_name || 'Prescription')}</strong><div class="order-date">Uploaded ${fmtDate(p.created_at)}</div></div>
                <span class="status-badge st-${p.status}">${STATUS_LABEL[p.status] || p.status}</span>
            </div>
            <button class="btn btn-outline rx-view" type="button" data-path="${escapeHTML(p.file_path)}" onclick="viewPrescription(this.dataset.path)">View file</button>
        </div>`).join('');
}

async function viewPrescription(path) {
    const win = window.open('', '_blank');                 // open first so popup blockers allow it
    try {
        const url = await signedPrescriptionUrl(path);
        if (win) win.location = url;
    } catch (err) { if (win) win.close(); showToast('Could not open file', err.message, 'error'); }
}
