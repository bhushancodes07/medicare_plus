/* Admin panel. Plain script (no import): uses the Supabase client created in config.js. */
(() => {
/* If anything fails, show the error on the page instead of a blank white screen. */
function showFail(msg) {
    document.body.hidden = false;
    const bar = document.createElement('p');
    bar.style.cssText = 'background:#fde7e5;color:#b42318;padding:12px 20px;margin:0;font:14px system-ui';
    bar.textContent = 'Admin error: ' + msg + ' (open the browser console with F12 for details)';
    document.body.prepend(bar);
}
window.addEventListener('error', (e) => showFail(e.message));
window.addEventListener('unhandledrejection', (e) => showFail((e.reason && e.reason.message) || e.reason));
setTimeout(() => { if (document.body.hidden) showFail('still checking access after 5 seconds'); }, 5000);

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

/* auth.js (which creates the client) is not loaded on this page, so build our own
   from the URL and anon key that config.js defines, whatever they are called. */
function findCredentials() {
    const names = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_KEY', 'SUPABASE_ANON', 'SUPABASE_PUBLISHABLE_KEY',
        'supabaseUrl', 'supabaseKey', 'supabaseAnonKey', 'SB_URL', 'SB_KEY', 'SB_ANON_KEY',
        'CONFIG', 'config', 'APP_CONFIG', 'SUPABASE_CONFIG', 'SUPABASE', 'SITE_CONFIG', 'CFG', 'ENV'];
    const flat = [];
    const take = (v, depth) => {
        if (typeof v === 'string') flat.push(v);
        else if (v && typeof v === 'object' && depth < 3) Object.values(v).forEach((x) => take(x, depth + 1));
    };
    for (const n of names) {
        try { take((0, eval)(n), 0); } catch (e) { /* name does not exist */ }
    }
    const url = flat.find((x) => /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/i.test(x));
    const key = flat.find((x) => /^eyJ/.test(x) || /^sb_publishable_/.test(x));
    return url && key ? { url, key } : null;
}

let adminSb = findSupabaseClient();
if (!adminSb && window.supabase && typeof window.supabase.createClient === 'function') {
    const creds = findCredentials();
    if (creds) adminSb = window.supabase.createClient(creds.url, creds.key);
}

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
const when = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const ORDER_STATUS = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const PAY_STATUS = ['pending', 'paid', 'failed', 'refunded'];
const opts = (list, cur) => list.map((v) => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('');

function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (bad ? ' bad' : '');
  setTimeout(() => (t.className = ''), 2600);
}

/* ---------- admin check (the real protection is the RLS policies in admin-setup.sql) ---------- */
async function init() {
  const { data: { user } } = await adminSb.auth.getUser();
  let ok = false;
  if (user) {
    const { data } = await adminSb.from('profiles').select('role').eq('id', user.id).maybeSingle();
    ok = data?.role === 'admin';
  }
  if (!ok) return location.replace('index.html');
  document.body.hidden = false;
  bind();
  loadStats();
  loadProducts();
}

function bind() {
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.dataset.tab;
    if (!tab) return;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b === e.target));
    document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== tab));
    ({ products: loadProducts, orders: loadOrders, rx: loadRx })[tab]();
  });
  $('#pSearch').addEventListener('input', renderProducts);
  $('#addBtn').addEventListener('click', () => openForm());
  $('#pCancel').addEventListener('click', () => $('#pDialog').close());
  $('#pForm').addEventListener('submit', saveProduct);
  $('#pTable').addEventListener('click', onProductClick);
  $('#oFilter').addEventListener('change', loadOrders);
  $('#oTable').addEventListener('change', onOrderChange);
  $('#rFilter').addEventListener('change', loadRx);
  $('#rTable').addEventListener('click', onRxClick);
}

/* ---------- dashboard numbers ---------- */
async function count(table, filter) {
  let q = adminSb.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: n } = await q;
  return n ?? 0;
}
async function loadStats() {
  const [prod, fresh, rx, low] = await Promise.all([
    count('products'),
    count('orders', (q) => q.eq('status', 'placed')),
    count('prescriptions', (q) => q.eq('status', 'pending')),
    count('products', (q) => q.eq('active', true).lte('stock', 10)),
  ]);
  $('#stats').innerHTML = [
    ['Products', prod], ['New orders', fresh],
    ['Prescriptions to review', rx], ['Low stock (10 or fewer)', low],
  ].map(([l, n]) => `<div><b>${n}</b><span>${l}</span></div>`).join('');
}

/* ---------- products ---------- */
let products = [];

async function loadProducts() {
  const { data, error } = await adminSb.from('products').select('*').order('id');
  if (error) return toast(error.message, true);
  products = data;
  renderProducts();
}

function renderProducts() {
  const q = $('#pSearch').value.trim().toLowerCase();
  const rows = products.filter((p) => !q || `${p.name} ${p.brand} ${p.cat}`.toLowerCase().includes(q));
  $('#pTable').innerHTML = rows.length
    ? `<table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>${
      rows.map((p) => `<tr>
        <td>${esc(p.emoji)} ${esc(p.name)}<small>${esc(p.brand)}${p.prescription ? ' <span class="badge">Rx</span>' : ''}</small></td>
        <td>${esc(p.cat)}</td>
        <td>${money(p.price)}<small>MRP ${money(p.mrp)}</small></td>
        <td>${p.stock}</td>
        <td><span class="badge${p.active ? '' : ' off'}">${p.active ? 'Visible' : 'Hidden'}</span></td>
        <td><button data-edit="${p.id}">Edit</button><button data-toggle="${p.id}">${p.active ? 'Hide' : 'Show'}</button></td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="empty">No products found.</p>';
}

function openForm(p) {
  const f = $('#pForm');
  f.reset();
  $('#pTitle').textContent = p ? 'Edit product' : 'Add product';
  if (p) {
    for (const k of ['id', 'name', 'brand', 'cat', 'price', 'mrp', 'stock', 'emoji', 'image', 'description']) f.elements[k].value = p[k] ?? '';
    f.elements.tags.value = (p.tags || []).join(', ');
    f.elements.prescription.checked = p.prescription;
    f.elements.active.checked = p.active;
  }
  $('#pDialog').showModal();
}

async function onProductClick(e) {
  const edit = e.target.dataset.edit, tog = e.target.dataset.toggle;
  if (edit) return openForm(products.find((p) => p.id == edit));
  if (tog) {
    const p = products.find((x) => x.id == tog);
    // Hide instead of delete, so old orders keep working
    const { error } = await adminSb.from('products').update({ active: !p.active }).eq('id', p.id);
    if (error) return toast(error.message, true);
    toast(p.active ? 'Product hidden from store' : 'Product visible in store');
    loadProducts(); loadStats();
  }
}

async function saveProduct(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const id = f.get('id');
  const row = {
    name: f.get('name').trim(), brand: f.get('brand').trim(), cat: f.get('cat').trim(),
    price: +f.get('price'), mrp: +f.get('mrp'), stock: +f.get('stock'),
    emoji: f.get('emoji').trim() || '💊', image: f.get('image').trim(),
    description: f.get('description').trim(),
    tags: f.get('tags').split(',').map((t) => t.trim()).filter(Boolean),
    prescription: f.has('prescription'), active: f.has('active'),
  };
  const { error } = id
    ? await adminSb.from('products').update(row).eq('id', id)
    : await adminSb.from('products').insert(row);
  if (error) return toast(error.message, true);
  $('#pDialog').close();
  toast('Product saved');
  loadProducts(); loadStats();
}

/* ---------- orders ---------- */
async function loadOrders() {
  let q = adminSb.from('orders').select('*, order_items(name, qty)')
    .order('created_at', { ascending: false }).limit(100);
  const st = $('#oFilter').value;
  if (st) q = q.eq('status', st);
  const { data, error } = await q;
  if (error) return toast(error.message, true);
  $('#oTable').innerHTML = data.length
    ? `<table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Order status</th><th>Payment</th></tr></thead><tbody>${
      data.map((o) => {
        const a = o.address || {};
        const locked = o.status === 'cancelled' ? ' disabled' : '';
        return `<tr>
          <td>${esc(o.order_no)}<small>${when(o.created_at)}</small></td>
          <td>${esc(a.full_name)}<small>${esc(a.phone)}</small><small>${esc(a.line1)}, ${esc(a.city)} ${esc(a.pincode)}</small></td>
          <td>${o.order_items.map((i) => `${esc(i.name)} x${i.qty}`).join('<br>')}</td>
          <td>${money(o.total)}<small>${esc(o.payment_method)}</small></td>
          <td><select data-order="${o.id}" data-field="p_status"${locked}>${opts(ORDER_STATUS, o.status)}</select></td>
          <td><select data-order="${o.id}" data-field="p_payment_status"${locked}>${opts(PAY_STATUS, o.payment_status)}</select></td>
        </tr>`;
      }).join('')}</tbody></table>`
    : '<p class="empty">No orders match this filter.</p>';
}

async function onOrderChange(e) {
  const s = e.target;
  if (!s.dataset.order) return;
  if (s.value === 'cancelled' && !confirm('Cancel this order and put the stock back? This cannot be undone.')) return loadOrders();
  const { error } = await adminSb.rpc('admin_set_order_status', { p_order: s.dataset.order, [s.dataset.field]: s.value });
  toast(error ? error.message : 'Order updated', !!error);
  loadOrders(); loadStats();
}

/* ---------- prescriptions ---------- */
async function loadRx() {
  let q = adminSb.from('prescriptions').select('*').order('created_at', { ascending: false }).limit(100);
  const st = $('#rFilter').value;
  if (st) q = q.eq('status', st);
  const { data, error } = await q;
  if (error) return toast(error.message, true);
  $('#rTable').innerHTML = data.length
    ? `<table><thead><tr><th>File</th><th>Uploaded</th><th>User</th><th>Status</th><th></th></tr></thead><tbody>${
      data.map((r) => `<tr>
        <td>${esc(r.file_name || 'prescription')}</td>
        <td>${when(r.created_at)}</td>
        <td><small>${esc(r.user_id.slice(0, 8))}</small></td>
        <td><span class="badge${r.status === 'rejected' ? ' off' : ''}">${esc(r.status)}</span></td>
        <td>
          <button data-view="${esc(r.file_path)}">View file</button>
          <button data-rx="${r.id}" data-status="approved">Approve</button>
          <button data-rx="${r.id}" data-status="rejected">Reject</button>
        </td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="empty">No prescriptions match this filter.</p>';
}

async function onRxClick(e) {
  const b = e.target;
  if (b.dataset.view) {
    const w = window.open('about:blank'); // opened first so the browser doesn't block it
    const { data, error } = await adminSb.storage.from('prescriptions').createSignedUrl(b.dataset.view, 120);
    if (error) { w?.close(); return toast(error.message, true); }
    if (w) w.location.href = data.signedUrl;
  } else if (b.dataset.rx) {
    const { error } = await adminSb.from('prescriptions').update({ status: b.dataset.status }).eq('id', b.dataset.rx);
    toast(error ? error.message : `Prescription ${b.dataset.status}`, !!error);
    loadRx(); loadStats();
  }
}

if (!adminSb) {
    document.body.hidden = false;
    document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">Could not read your Supabase URL and key from config.js. Open the console (F12) and tell me the variable names used in config.js.</p>';
} else {
    init().catch((e) => showFail(e.message));
}
})();