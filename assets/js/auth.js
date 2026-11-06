/* =====================================================================
   AUTH (Supabase): email + password, phone OTP, password reset, logout
   ===================================================================== */

let sb = null;              // Supabase client (null until config.js is filled in)
let currentUser = null;
let authMode = 'login';     // 'login' | 'signup' | 'phone' | 'recovery'
let otpPhone = '';

const authConfigured = () =>
    typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY &&
    !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_ANON_KEY.startsWith('YOUR_');

function initAuth() {
    if (!authConfigured()) { renderAuthState(); return; }
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    sb.auth.getSession().then(({ data }) => setUser(data.session ? data.session.user : null));
    sb.auth.onAuthStateChange((event, session) => {
        setUser(session ? session.user : null);
        if (event === 'PASSWORD_RECOVERY') { setAuthMode('recovery'); openModal('authModal'); }
    });
}

function setUser(user) {
    currentUser = user;
    renderAuthState();
    if (user && pendingCheckout) {                       // they logged in from the checkout button
        pendingCheckout = false;
        closeModal('authModal');
        openCheckout();
    }
}

function displayName(u) {
    const m = (u && u.user_metadata) || {};
    return m.full_name || (u && u.email ? u.email.split('@')[0] : (u && u.phone) || 'Account');
}

/* header label + modal view */
function renderAuthState() {
    const name = currentUser ? displayName(currentUser).split(' ')[0] : 'Account';
    document.querySelectorAll('.account-btn .action-label, #mobileAccountLabel').forEach(el => { el.textContent = name; });

    const guest = document.getElementById('authGuest');
    const user = document.getElementById('authUser');
    const note = document.getElementById('authSetupNote');
    note.hidden = authConfigured();
    guest.hidden = !!currentUser && authMode !== 'recovery';
    user.hidden = !currentUser || authMode === 'recovery';

    if (currentUser) {
        document.getElementById('authAvatar').textContent = displayName(currentUser).charAt(0).toUpperCase();
        document.getElementById('authUserName').textContent = displayName(currentUser);
        document.getElementById('authUserContact').textContent = currentUser.email || currentUser.phone || '';
    }
    document.getElementById('authTitle').textContent =
        currentUser && authMode !== 'recovery' ? 'My Account'
            : { login: 'Welcome back', signup: 'Create your account', phone: 'Login with phone', recovery: 'Set a new password' }[authMode];
}

function openAuth() {
    if (!currentUser && authMode === 'recovery') authMode = 'login';
    renderAuthState();
    clearAuthError();
    openModal('authModal');
}

function setAuthMode(mode) {
    authMode = mode;
    clearAuthError();
    document.querySelectorAll('#authTabs .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    document.getElementById('authForm').hidden = !['login', 'signup'].includes(mode);
    document.getElementById('phoneForm').hidden = mode !== 'phone';
    document.getElementById('recoveryForm').hidden = mode !== 'recovery';
    document.getElementById('authTabs').hidden = mode === 'recovery';
    document.getElementById('authNameGroup').hidden = mode !== 'signup';
    document.getElementById('authForgot').hidden = mode !== 'login';
    document.getElementById('authSubmit').textContent = mode === 'signup' ? 'Create Account' : 'Login';
    document.getElementById('authPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    renderAuthState();
}

/* ---------- helpers ---------- */
function showAuthError(msg) {
    const el = document.getElementById('authError');
    el.textContent = msg;
    el.hidden = false;
}
function clearAuthError() { document.getElementById('authError').hidden = true; }

async function withBusy(btn, fn) {
    clearAuthError();
    if (!sb) { showAuthError('Login is not set up yet. Add your Supabase keys in assets/js/config.js.'); return; }
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Please wait…';
    try { await fn(); }
    catch (err) { showAuthError(err.message || 'Something went wrong. Please try again.'); }
    finally { btn.disabled = false; btn.textContent = label; }
}

/* ---------- email + password ---------- */
function submitAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    return withBusy(document.getElementById('authSubmit'), async () => {
        if (authMode === 'signup') {
            const full_name = document.getElementById('authName').value.trim();
            const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name } } });
            if (error) throw error;
            if (data.session) { closeModal('authModal'); showToast('Account created 🎉', 'Welcome to MediCare Plus!', 'success'); }
            else { showToast('Check your email', 'We sent a confirmation link to ' + email, 'info'); closeModal('authModal'); }
        } else {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
            closeModal('authModal');
            showToast('Logged in', 'Welcome back!', 'success');
        }
        document.getElementById('authForm').reset();
    });
}

function forgotPassword() {
    const email = document.getElementById('authEmail').value.trim();
    if (!email) { showAuthError('Enter your email above first, then tap “Forgot password”.'); return; }
    return withBusy(document.getElementById('authSubmit'), async () => {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        showToast('Reset link sent', 'Check ' + email + ' for the password reset link.', 'info');
    });
}

function submitRecovery(e) {
    e.preventDefault();
    const password = document.getElementById('newPassword').value;
    return withBusy(document.getElementById('recoverySubmit'), async () => {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        setAuthMode('login');
        closeModal('authModal');
        showToast('Password updated', 'You can now use your new password.', 'success');
    });
}

/* ---------- phone OTP (needs an SMS provider enabled in Supabase) ---------- */
function sendOtp(e) {
    e.preventDefault();
    const digits = document.getElementById('authPhone').value.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) { showAuthError('Enter a valid 10-digit mobile number.'); return; }
    return withBusy(document.getElementById('otpSend'), async () => {
        otpPhone = '+91' + digits;
        const { error } = await sb.auth.signInWithOtp({ phone: otpPhone });
        if (error) throw error;
        document.getElementById('otpStep').hidden = false;
        document.getElementById('otpSend').textContent = 'Resend OTP';
        showToast('OTP sent', 'Enter the code sent to ' + otpPhone, 'info');
    });
}

function verifyOtp(e) {
    e.preventDefault();
    const token = document.getElementById('authOtp').value.trim();
    return withBusy(document.getElementById('otpVerify'), async () => {
        const { error } = await sb.auth.verifyOtp({ phone: otpPhone, token, type: 'sms' });
        if (error) throw error;
        closeModal('authModal');
        showToast('Logged in', 'Welcome to MediCare Plus!', 'success');
    });
}

/* ---------- logout ---------- */
async function logout() {
    if (sb) await sb.auth.signOut();
    setUser(null);
    savedAddresses = [];
    closeModal('authModal');
    showToast('Logged out', 'See you soon!', 'info');
}
