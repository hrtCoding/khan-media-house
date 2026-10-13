// ============================================================
//  core.js — Firebase, helpers, login, router, data subscriptions
// ============================================================
firebase.initializeApp(window.firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const FV = firebase.firestore.FieldValue;
const col = n => db.collection(n);

// ---------- App state ----------
const S = {
  user: null,            // {uid,name,userId,role}
  customers: [], orders: [], products: [],
  employees: [], salaryPays: [], daily: [], txs: [], staffList: [],
  editOrderId: null, prefillCustomerId: null
};
let unsubs = [];
let currentPage = null;

// ---------- Helpers ----------
const BN = '০১২৩৪৫৬৭৮৯';  // Bangla digits (kept only so typed Bangla digits still work as input)
const bn = s => String(s);   // English digits shown everywhere
const en = s => String(s || '').replace(/[০-৯]/g, d => BN.indexOf(d));
const num = v => parseFloat(en(v)) || 0;
const fmt = n => '৳ ' + bn((Math.round((parseFloat(n) || 0) * 100) / 100).toLocaleString('en-IN'));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const pad = n => String(n).padStart(2, '0');
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function thisMonth() { return todayStr().slice(0, 7); }
function fmtDate(s) { if (!s) return '—'; const [y, m, d] = s.split('-'); return bn(`${d}/${m}/${y}`); }   // DD/MM/YYYY
function monthLabel(ym) { if (!ym) return ''; const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${bn(y)}`; }
function prevMonth(ym) { let [y, m] = ym.split('-').map(Number); m--; if (m < 1) { m = 12; y--; } return `${y}-${pad(m)}`; }
function nextMonth(ym) { let [y, m] = ym.split('-').map(Number); m++; if (m > 12) { m = 1; y++; } return `${y}-${pad(m)}`; }
function monthsRange(from, to) { const r = []; let c = from; while (c <= to && r.length < 600) { r.push(c); c = nextMonth(c); } return r; }
const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const isAdmin = () => S.user && S.user.role === 'admin';
const norm = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const emailOf = id => `${id.trim().toLowerCase()}@${window.APP_EMAIL_DOMAIN}`;
const STATUS = { pending: 'Pending', processing: 'In Progress', ready: 'Ready', delivered: 'Delivered' };
const statusBadge = s => `<span class="badge b-${s}">${STATUS[s] || s}</span>`;
const $ = id => document.getElementById(id);

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  const ic = { success: 'fa-circle-check text-green-600', error: 'fa-circle-xmark text-red-600', info: 'fa-circle-info text-blue-600' }[type];
  t.className = `toast ${type}`; t.innerHTML = `<i class="fas ${ic}"></i><span>${esc(msg)}</span>`;
  $('toast-container').appendChild(t); setTimeout(() => t.remove(), 3500);
}
function busy(btn, on, html) {
  if (typeof btn === 'string') btn = $(btn); if (!btn) return;
  if (on) { btn.dataset.h = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
  else { btn.disabled = false; btn.innerHTML = html || btn.dataset.h || btn.innerHTML; }
}
// Every date field shows DD/MM/YYYY (the browser's own date box follows the PC language, so we use flatpickr)
function initDates(root = document) {
  if (!window.flatpickr) return;
  root.querySelectorAll('input[type="date"]').forEach(el => {
    if (el._flatpickr) return;
    if (!el.placeholder) el.placeholder = 'DD/MM/YYYY';
    flatpickr(el, { altInput: true, altFormat: 'd/m/Y', dateFormat: 'Y-m-d', allowInput: false, disableMobile: true, minDate: el.getAttribute('min') || null, defaultDate: el.value || null, altInputClass: el.className });
  });
}
function openModal(html, wide) {
  $('modal-root').innerHTML = `<div class="modal-box ${wide ? 'wide' : ''}">${html}</div>`; initDates($('modal-root'));
  $('modal-root').classList.add('open'); document.body.style.overflow = 'hidden';
}
function closeModal() { $('modal-root').classList.remove('open'); $('modal-root').innerHTML = ''; document.body.style.overflow = ''; }
const modalHead = (title, sub = '') => `<div class="flex items-start justify-between p-5 border-b border-slate-100"><div><div class="font-bold text-lg text-slate-800">${title}</div>${sub ? `<div class="text-sm text-slate-500">${sub}</div>` : ''}</div><button class="text-slate-400 hover:text-slate-700 p-1" onclick="closeModal()"><i class="fas fa-xmark text-xl"></i></button></div>`;
const empty = (icon, text) => `<div class="text-center py-10 text-slate-400"><i class="fas ${icon} text-3xl mb-2"></i><div class="text-sm">${text}</div></div>`;
const kpi = (label, val, icon, color, id = '') => `<div class="kpi" style="--c:${color}"><div class="flex items-center justify-between mb-2"><div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${color}1A;color:${color}"><i class="fas ${icon}"></i></div></div><div class="text-2xl font-bold text-slate-800" ${id ? `id="${id}"` : ''}>${val}</div><div class="text-sm text-slate-500 mt-0.5">${label}</div></div>`;

// Print (any content) — you can also choose "Save as PDF" in the browser print dialog
function printHTML(html) {
  const r = $('print-root'); r.innerHTML = html;
  setTimeout(() => { window.print(); setTimeout(() => r.innerHTML = '', 500); }, 150);
}

// ---------- Login / Logout ----------
async function handleLogin() {
  const id = $('login-id').value.trim(), pw = $('login-pass').value;
  if (!id || !pw) return toast('Enter User ID and password', 'error');
  busy('login-btn', true);
  try { await auth.signInWithEmailAndPassword(emailOf(id), pw); }
  catch (e) {
    console.error(e);
    const m = (e.code === 'auth/network-request-failed') ? 'No internet connection' :
      (e.code === 'auth/too-many-requests') ? 'Too many failed attempts, try again later' : 'Wrong User ID or password';
    toast(m, 'error');
  } finally { busy('login-btn', false); }
}
async function logout() { try { await auth.signOut(); } finally { location.hash = ''; location.reload(); } }

function boot() {
  $('today-label').textContent = fmtDate(todayStr());
  auth.onAuthStateChanged(async u => {
    if (!u) { $('app-view').classList.add('hidden'); $('login-view').classList.remove('hidden'); return; }
    try {
      const snap = await col('users').doc(u.uid).get();
      if (!snap.exists || snap.data().active === false) {
        await auth.signOut(); toast('This account is not active. Contact the admin.', 'error'); return;
      }
      S.user = { uid: u.uid, ...snap.data() };
      col('users').doc(u.uid).update({ lastLogin: FV.serverTimestamp() }).catch(() => {});
      startApp();
    } catch (e) { console.error(e); toast('Database connection problem. Check Firebase config and rules.', 'error'); await auth.signOut(); }
  });
  window.addEventListener('hashchange', route);
}

// ---------- Menu & router ----------
const MENU = [
  { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard', roles: ['admin', 'staff'] },
  { id: 'new-order', icon: 'fa-file-circle-plus', label: 'New Order', roles: ['admin', 'staff'] },
  { id: 'orders', icon: 'fa-list-check', label: 'Orders', roles: ['admin', 'staff'] },
  { id: 'customers', icon: 'fa-users', label: 'Customers', roles: ['admin', 'staff'] },
  { id: 'products', icon: 'fa-boxes-stacked', label: 'Products & Services', roles: ['admin'] },
  { id: 'daily', icon: 'fa-calendar-day', label: 'Daily Accounts', roles: ['admin'] },
  { id: 'salary', icon: 'fa-money-bill-wave', label: 'Salary', roles: ['admin'] },
  { id: 'reports', icon: 'fa-chart-line', label: 'Reports', roles: ['admin'] },
  { id: 'history', icon: 'fa-clock-rotate-left', label: 'Full History', roles: ['admin'] },
  { id: 'staff', icon: 'fa-user-shield', label: 'Staff Management', roles: ['admin'] }
];
const PAGES = {};   // each file registers its own page here: {title, sub, render(), mount(), update()}

function startApp() {
  $('login-view').classList.add('hidden'); $('app-view').classList.remove('hidden');
  $('me-avatar').textContent = initials(S.user.name); $('me-name').textContent = S.user.name;
  $('me-role').textContent = isAdmin() ? 'Admin' : 'Staff';
  $('nav').innerHTML = MENU.filter(m => m.roles.includes(S.user.role)).map(m =>
    `<div class="nav-item" id="nav-${m.id}" onclick="go('${m.id}')"><i class="fas ${m.icon}"></i>${m.label}</div>`).join('');
  subscribeAll();
  route();
}
function go(page, q = '') { location.hash = '#/' + page + (q ? '?' + q : ''); closeSidebar(); }
function route() {
  if (!S.user) return;
  const h = location.hash.replace(/^#\//, '') || 'dashboard';
  const [page, query] = h.split('?'); const params = new URLSearchParams(query || '');
  const allowed = MENU.find(m => m.id === page && m.roles.includes(S.user.role));
  if (!allowed) return go('dashboard');
  currentPage = PAGES[page]; if (!currentPage) return;
  currentPage.params = params;
  document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
  $('nav-' + page)?.classList.add('active');
  $('view').innerHTML = currentPage.render();
  const t = typeof currentPage.title === 'function' ? currentPage.title() : currentPage.title;
  $('page-title').textContent = t; $('page-sub').textContent = currentPage.sub || '';
  currentPage.mount && currentPage.mount();
  initDates($('view'));
  const v = $('view'); v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
let _rf = null;
const refreshPage = () => {
  if (_rf) return;   // many Firestore snapshots arrive together — redraw once
  _rf = setTimeout(() => { _rf = null; try { currentPage && currentPage.update && currentPage.update(); } catch (e) { console.error(e); } }, 120);
};
function toggleSidebar() { $('sidebar').classList.toggle('open'); $('sb-overlay').classList.toggle('open'); }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sb-overlay').classList.remove('open'); }

// ---------- Real-time data ----------
function listen(query, key, sorter) {
  const u = query.onSnapshot(snap => {
    $('conn-badge').className = 'px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700';
    $('conn-badge').textContent = '● Online';
    S[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (sorter) S[key].sort(sorter);
    refreshPage();
  }, err => {
    console.error(key, err);
    $('conn-badge').className = 'px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700';
    $('conn-badge').textContent = 'Connection problem';
    if (err.code === 'permission-denied') toast('Permission denied: ' + key + ' (check Firestore rules)', 'error');
  });
  unsubs.push(u);
}
const byCreatedDesc = (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
function subscribeAll() {
  unsubs.forEach(u => u()); unsubs = [];
  listen(col('products'), 'products', (a, b) => a.name.localeCompare(b.name));
  listen(col('customers'), 'customers', (a, b) => (a.name || '').localeCompare(b.name || ''));
  if (isAdmin()) {
    listen(col('orders'), 'orders', (a, b) => (b.orderNoNum || 0) - (a.orderNoNum || 0));
    listen(col('employees'), 'employees', (a, b) => a.name.localeCompare(b.name));
    listen(col('salary_payments'), 'salaryPays', (a, b) => (b.date || '').localeCompare(a.date || ''));
    listen(col('daily_records').orderBy('date', 'desc'), 'daily');
    listen(col('transactions'), 'txs');
    listen(col('users'), 'staffList', (a, b) => (a.name || '').localeCompare(b.name || ''));
  } else {
    listen(col('orders').where('staffId', '==', S.user.uid), 'orders', (a, b) => (b.orderNoNum || 0) - (a.orderNoNum || 0));
  }
}
