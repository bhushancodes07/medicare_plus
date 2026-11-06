/* =====================================================================
   API: every call to the Supabase database / storage lives here
   (returns data or throws an Error with a readable message)
   ===================================================================== */

function needSb() {
    if (!sb) throw new Error('Not connected to Supabase.');
    if (!currentUser) throw new Error('Please log in first.');
}
function check(res) {
    if (res.error) throw new Error(res.error.message || 'Request failed.');
    return res.data;
}

/* ---------- products (public) ---------- */
async function fetchProducts() {
    const rows = check(await sb.from('products').select('*').eq('active', true));
    return rows.map(r => ({
        id: r.id, name: r.name, brand: r.brand, cat: r.cat,
        price: Number(r.price), mrp: Number(r.mrp), rating: Number(r.rating), reviews: r.reviews,
        emoji: r.emoji, image: r.image || '', desc: r.description, stock: r.stock,
        prescription: r.prescription, tags: r.tags || [], popular: r.popular
    }));
}

/* ---------- addresses ---------- */
async function fetchAddresses() {
    needSb();
    return check(await sb.from('addresses').select('*').order('created_at', { ascending: false }));
}
async function insertAddress(a) {
    needSb();
    return check(await sb.from('addresses').insert({
        label: a.label, full_name: a.full_name, phone: a.phone, line1: a.line1,
        line2: a.line2, city: a.city, state: a.state, pincode: a.pincode
    }));
}

/* ---------- prescriptions ---------- */
async function fetchPrescriptions() {
    needSb();
    return check(await sb.from('prescriptions').select('id,file_path,file_name,status,created_at').order('created_at', { ascending: false }));
}
async function uploadPrescription(file) {
    needSb();
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
    const path = `${currentUser.id}/${Date.now()}.${ext}`;           // folder = user id (enforced by storage policy)
    const up = await sb.storage.from('prescriptions').upload(path, file, { contentType: file.type });
    if (up.error) throw new Error(up.error.message);
    return check(await sb.from('prescriptions').insert({ file_path: path, file_name: file.name }).select().single());
}
async function signedPrescriptionUrl(path) {
    needSb();
    const res = await sb.storage.from('prescriptions').createSignedUrl(path, 120);   // link valid for 2 minutes
    return check(res).signedUrl;
}

/* ---------- orders ---------- */
async function fetchOrders() {
    needSb();
    return check(await sb.from('orders')
        .select('id,order_no,status,payment_method,payment_status,total,created_at,order_items(name,emoji,image,qty,price)')
        .order('created_at', { ascending: false }));
}
async function createOrder(items, address, payment, prescriptionId) {
    needSb();
    const data = check(await sb.rpc('place_order', {
        p_items: items, p_address: address, p_payment: payment, p_prescription: prescriptionId || null
    }));
    return Array.isArray(data) ? data[0] : data;        // { out_order_id, out_order_no, out_total }
}
