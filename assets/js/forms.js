/* =====================================================================
   FORMS: prescription upload (click, keyboard, drag & drop) + newsletter
   ===================================================================== */

const RX_MAX_MB = 10;

function setupDragDrop() {
    const zone = document.getElementById('uploadZone');

    ['dragenter', 'dragover'].forEach(evt => zone.addEventListener(evt, e => {
        e.preventDefault();
        zone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(evt => zone.addEventListener(evt, e => {
        e.preventDefault();
        zone.classList.remove('dragover');
    }));
    zone.addEventListener('drop', e => {
        if (e.dataTransfer.files.length) handleRxFile(e.dataTransfer.files[0]);
    });
    zone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('rxFile').click(); }
    });
}

function handleRxUpload(e) {
    const file = e.target.files[0];
    if (file) handleRxFile(file);
    e.target.value = '';                           // allow choosing the same file again
}

async function handleRxFile(file) {
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) { showToast('Unsupported file', 'Please upload a JPG, PNG or PDF prescription.', 'error'); return; }
    if (file.size > RX_MAX_MB * 1024 * 1024) { showToast('File too large', `Maximum file size is ${RX_MAX_MB} MB.`, 'error'); return; }

    /* demo mode (Supabase not configured) */
    if (!authConfigured()) {
        showToast('Prescription Uploaded! 📋', `“${file.name}” received (demo mode).`, 'success');
        return;
    }
    if (!currentUser) {
        showToast('Please log in', 'Log in to upload your prescription securely.', 'info');
        openAuth();
        return;
    }
    showToast('Uploading…', `“${file.name}”`, 'info');
    try {
        const row = await uploadPrescription(file);
        showToast('Prescription Uploaded! 📋', 'Our pharmacist will review it. Find it under Account → My Prescriptions.', 'success');
        onPrescriptionUploaded(row);
    } catch (err) {
        showToast('Upload failed', err.message, 'error');
    }
}

function subscribeNewsletter(e) {
    e.preventDefault();
    const email = e.target.querySelector('input').value;
    showToast('Subscribed Successfully! 🎉', `Welcome to the MediCare Plus family! Your 15% discount code has been sent to ${email}`, 'success');
    e.target.reset();
}
