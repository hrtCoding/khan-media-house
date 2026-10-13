// ============================================================
//  people.js — Customers, products & services, staff management
// ============================================================

// ---------------- Customers ----------------
function ordersOf(c) { const n = S.orders.filter(o => o.customerId === c.id).length; return isAdmin() ? Math.max(n, c.orderCount || 0) : (c.orderCount || 0); }
PAGES['customers'] = {
  title: 'Customers', sub: 'Customer and due information',
  render() {
    return `<div class="grid lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <div class="card p-5 h-fit"><div class="font-bold mb-4"><i class="fas fa-user-plus text-blue-600 mr-2"></i>New Customer</div>
        <div class="space-y-3">
          <div><label class="lbl">Name *</label><input id="nc-name" class="inp"></div>
          <div><label class="lbl">Mobile *</label><input id="nc-phone" class="inp" inputmode="tel" placeholder="01XXXXXXXXX"></div>
          <div><label class="lbl">Address</label><input id="nc-addr" class="inp"></div>
          ${isAdmin() ? `<div><label class="lbl">Previous Due (৳)</label><input id="nc-due" type="number" min="0" class="inp" placeholder="0"></div>` : ''}
          <button id="nc-btn" class="btn btn-primary w-full" onclick="addCustomer()"><i class="fas fa-plus"></i> Add Customer</button>
        </div></div>
      <div class="card p-4 lg:col-span-2">
        <div class="flex gap-3 mb-3"><input id="cl-search" class="inp" placeholder="🔍 Search name or mobile…" oninput="PAGES.customers.update()">
          ${isAdmin() ? `<button class="btn btn-ghost" onclick="printCustomerList()"><i class="fas fa-print"></i> Print List</button>` : ''}</div>
        <div class="text-sm text-slate-500 mb-2" id="cl-count"></div>
        <div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Name</th><th>Mobile</th><th>Past Orders</th><th>Due</th></tr></thead><tbody id="cl-body"></tbody></table></div>
      </div></div>`;
  },
  mount() { this.update(); },
  update() {
    const b = $('cl-body'); if (!b) return; const q = norm($('cl-search').value);
    const list = S.customers.filter(c => !q || norm(c.name + ' ' + c.phone).includes(q));
    $('cl-count').textContent = `Total ${bn(list.length)} customers`;
    b.innerHTML = list.length ? list.map(c => `<tr class="cursor-pointer" onclick="openCustomer('${c.id}')">
      <td><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">${esc(initials(c.name))}</div><b>${esc(c.name)}</b></div></td>
      <td>${bn(esc(c.phone || '—'))}</td><td>${bn(ordersOf(c))}</td>
      <td><span class="font-semibold ${c.currentDue > 0 ? 'text-rose-600' : 'text-green-600'}">${fmt(c.currentDue)}</span></td></tr>`).join('')
      : `<tr><td colspan="4">${empty('fa-users', 'No customers yet')}</td></tr>`;
  }
};
async function addCustomer() {
  const name = $('nc-name').value.trim(), phone = en($('nc-phone').value).replace(/[\s-]/g, ''), address = $('nc-addr').value.trim();
  const due = isAdmin() ? num($('nc-due').value) : 0;
  if (!name) return toast('Enter name', 'error');
  if (!/^(\+?88)?01\d{9}$/.test(phone)) return toast('Enter a valid mobile number', 'error');
  if (findCustomerByPhone(phone)) return toast('A customer with this number already exists', 'error');
  busy('nc-btn', true);
  try {
    const ref = await col('customers').add({ name, phone, address, currentDue: due, orderCount: 0, createdBy: S.user.uid, createdByName: S.user.name, createdAt: FV.serverTimestamp() });
    if (due > 0) await col('transactions').add({ customerId: ref.id, date: todayStr(), type: 'add_due', amount: due, description: 'Previous due', createdAt: FV.serverTimestamp() });
    ['nc-name', 'nc-phone', 'nc-addr', 'nc-due'].forEach(i => $(i) && ($(i).value = ''));
    toast('Customer added');
  } catch (e) { toast(e.message, 'error'); } finally { busy('nc-btn', false); }
}
function printCustomerList() {
  const rows = S.customers.map((c, i) => `<tr><td>${bn(i + 1)}</td><td>${esc(c.name)}</td><td>${bn(esc(c.phone))}</td><td class="r">${fmt(c.currentDue)}</td></tr>`).join('');
  const total = S.customers.reduce((s, c) => s + (c.currentDue || 0), 0);
  printHTML(`<div class="memo"><div class="memo-head"><h1>${esc(BUSINESS.name)}</h1><div>Customer List — ${fmtDate(todayStr())}</div></div>
    <table><thead><tr><th>SL</th><th>Name</th><th>Mobile</th><th class="r">Due</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="3" class="r"><b>Total Due</b></td><td class="r"><b>${fmt(total)}</b></td></tr></tfoot></table></div>`);
}
let openCust = null;
function openCustomer(id, tab) {
  const c = S.customers.find(x => x.id === id); if (!c) return; openCust = id;
  const head = modalHead(esc(c.name), `${bn(esc(c.phone || ''))}${c.address ? ' • ' + esc(c.address) : ''}`);
  const dueBox = `<div class="m-4 mx-5 mt-4 p-4 rounded-xl bg-rose-50 flex justify-between items-center"><span class="text-slate-600">Current Due</span><b class="text-2xl text-rose-600">${fmt(c.currentDue)}</b></div>`;
  if (!isAdmin()) {
    openModal(head + dueBox + `<div class="p-5 text-sm text-slate-600">Past orders: <b>${bn(ordersOf(c))}</b></div>
      <div class="p-5 pt-0"><button class="btn btn-primary w-full" onclick="closeModal();go('new-order','cust=${c.id}')"><i class="fas fa-file-circle-plus"></i> New order for this customer</button></div>`);
    return;
  }
  const T = tab || 'history';
  const tabs = [['history', 'Transactions'], ['due', 'Add Due'], ['pay', 'Receive Payment'], ['edit', 'Edit']];
  let body = '';
  if (T === 'history') {
    const txs = S.txs.filter(t => t.customerId === id).sort((a, b) => (b.date || '').localeCompare(a.date || '') || byCreatedDesc(a, b));
    body = txs.length ? txs.map(t => { const p = t.type === 'payment'; return `<div class="flex items-center gap-3 py-2.5 border-b border-slate-100">
      <div class="w-8 h-8 rounded-lg ${p ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'} flex items-center justify-center"><i class="fas ${p ? 'fa-arrow-down' : 'fa-arrow-up'}"></i></div>
      <div class="flex-1 min-w-0"><div class="text-sm font-medium">${esc(t.description || (p ? 'Payment' : 'Due added'))}</div><div class="text-xs text-slate-400">${fmtDate(t.date)}</div></div>
      <div class="font-bold ${p ? 'text-green-600' : 'text-amber-600'}">${p ? '−' : '+'}${fmt(t.amount)}</div>
      ${t.orderId ? '' : `<button class="btn btn-danger btn-sm" onclick="deleteTx('${t.id}')"><i class="fas fa-trash"></i></button>`}</div>`; }).join('') : empty('fa-receipt', 'No transactions');
  } else if (T === 'due' || T === 'pay') {
    const p = T === 'pay';
    body = `<div class="space-y-3"><div><label class="lbl">Date</label><input id="tx-date" type="date" class="inp" value="${todayStr()}"></div>
      <div><label class="lbl">Amount (৳)</label><input id="tx-amt" type="number" min="0" class="inp"></div>
      <div><label class="lbl">Description</label><input id="tx-desc" class="inp" placeholder="${p ? 'e.g. Cash received' : 'e.g. Old due'}"></div>
      <button id="tx-btn" class="btn btn-primary w-full" onclick="addTx('${id}','${p ? 'payment' : 'add_due'}')">${p ? 'Receive Payment' : 'Add Due'}</button></div>`;
  } else {
    body = `<div class="space-y-3"><div><label class="lbl">Name</label><input id="ec-name" class="inp" value="${esc(c.name)}"></div>
      <div><label class="lbl">Mobile</label><input id="ec-phone" class="inp" value="${esc(c.phone || '')}"></div>
      <div><label class="lbl">Address</label><input id="ec-addr" class="inp" value="${esc(c.address || '')}"></div>
      <div class="flex gap-2"><button class="btn btn-primary flex-1" onclick="saveCustomer('${id}')">Save</button>
      <button class="btn btn-danger" onclick="deleteCustomer('${id}')"><i class="fas fa-trash"></i> Delete Customer</button></div></div>`;
  }
  openModal(head + dueBox + `<div class="flex border-b border-slate-100 mt-3 px-3">${tabs.map(([k, l]) => `<div class="tabbtn ${k === T ? 'active' : ''}" onclick="openCustomer('${id}','${k}')">${l}</div>`).join('')}</div><div class="p-5 max-h-[50vh] overflow-y-auto">${body}</div>`);
}
async function addTx(cid, type) {
  const amt = num($('tx-amt').value), date = $('tx-date').value, desc = $('tx-desc').value.trim();
  if (!(amt > 0) || !date) return toast('Enter date and a valid amount', 'error');
  busy('tx-btn', true);
  try {
    const b = db.batch(); b.set(col('transactions').doc(), { customerId: cid, date, type, amount: amt, description: desc, createdAt: FV.serverTimestamp() });
    b.update(col('customers').doc(cid), { currentDue: FV.increment(type === 'payment' ? -amt : amt) }); await b.commit();
    toast('Saved'); setTimeout(() => openCustomer(cid, 'history'), 400);
  } catch (e) { toast(e.message, 'error'); busy('tx-btn', false); }
}
async function deleteTx(id) {
  const t = S.txs.find(x => x.id === id); if (!t || !confirm('Delete this transaction? The due balance will be adjusted.')) return;
  const b = db.batch(); b.delete(col('transactions').doc(id));
  b.update(col('customers').doc(t.customerId), { currentDue: FV.increment(t.type === 'payment' ? t.amount : -t.amount) });
  try { await b.commit(); toast('Deleted', 'info'); setTimeout(() => openCustomer(t.customerId, 'history'), 300); } catch (e) { toast(e.message, 'error'); }
}
async function saveCustomer(id) {
  const name = $('ec-name').value.trim(); if (!name) return toast('Enter name', 'error');
  try {
    const d = { name, phone: en($('ec-phone').value).trim(), address: $('ec-addr').value.trim() };
    await col('customers').doc(id).update(d); toast('Updated'); closeModal();
  } catch (e) { toast(e.message, 'error'); }
}
async function deleteCustomer(id) {
  if (!confirm('Delete the customer and all their transactions? (Orders will be kept)')) return;
  try {
    const b = db.batch(); S.txs.filter(t => t.customerId === id).forEach(t => b.delete(col('transactions').doc(t.id))); b.delete(col('customers').doc(id));
    await b.commit(); closeModal(); toast('Customer deleted', 'info');
  } catch (e) { toast(e.message, 'error'); }
}

// ---------------- Products & Services ----------------
const DEFAULT_PRODUCTS = [
  ['Visiting Card', []], ['Cash Memo', []], ['Leaflet', []], ['Poster', []],
  ['PVC', ['PVC 3mm', 'PVC 5mm', 'PVC 8mm']],
  ['Vinyl', ['Vinyl', 'Vinyl with 3mm Board', 'Vinyl with 5mm Board', 'Vinyl with 8mm Board']],
  ['Honeycomb Sticker', ['Honeycomb Sticker with 3mm Board', 'Honeycomb Sticker with 5mm Board', 'Honeycomb Sticker with 8mm Board']],
  ['Lighting Signboard', []]
];
PAGES['products'] = {
  title: 'Products & Services', sub: 'Name and variations only — price is entered when placing an order',
  render() {
    return `<div class="max-w-5xl mx-auto space-y-5">
      <div class="card p-5 flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-[220px]"><label class="lbl">New Product / Service Name</label><input id="np-name" class="inp" placeholder="e.g. Sticker" onkeyup="if(event.key==='Enter')addProduct()"></div>
        <div class="w-40"><label class="lbl">Default Price (৳)</label><input id="np-price" type="number" min="0" step="any" class="inp" placeholder="0" onkeyup="if(event.key==='Enter')addProduct()"></div>
        <button class="btn btn-primary" onclick="addProduct()"><i class="fas fa-plus"></i> Add Product</button>
        <button class="btn btn-ghost" onclick="seedProducts()" title="Add the sample products all at once"><i class="fas fa-wand-magic-sparkles"></i> Add Default Products</button>
      </div><div id="pl" class="grid md:grid-cols-2 gap-4"></div></div>`;
  },
  mount() { this.update(); },
  update() {
    const el = $('pl'); if (!el) return;
    el.innerHTML = S.products.length ? S.products.map(p => `<div class="card p-4">
      <div class="flex items-center justify-between mb-3"><div class="font-bold text-slate-800"><i class="fas fa-box text-blue-600 mr-2"></i>${esc(p.name)}</div>
        <div class="flex gap-1"><button class="btn btn-ghost btn-sm" onclick="renameProduct('${p.id}')"><i class="fas fa-pen"></i></button><button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button></div></div>
      <div class="flex items-center gap-2 mb-3"><label class="text-xs font-semibold text-slate-500 whitespace-nowrap">Default price (৳)</label><input id="pp-${p.id}" type="number" min="0" step="any" class="inp !py-1 !w-28" placeholder="0" value="${p.price || ''}" onchange="setProductPrice('${p.id}')"></div>
      <div class="flex flex-wrap gap-2 mb-3">${(p.variations || []).map(v => { const vp = num((p.varPrices || {})[v]); const ev = encodeURIComponent(v); return `<span class="chip">${esc(v)}${vp > 0 ? ` · ${fmt(vp)}` : ''}<button style="color:#2563EB" title="Set price for this variation" onclick="setVariationPrice('${p.id}',decodeURIComponent('${ev}'))"><i class="fas fa-tag"></i></button><button onclick="removeVariation('${p.id}',decodeURIComponent('${ev}'))"><i class="fas fa-xmark"></i></button></span>`; }).join('') || '<span class="text-xs text-slate-400">No variations</span>'}</div>
      <div class="flex gap-2"><input id="nv-${p.id}" class="inp !py-1.5" placeholder="New variation" onkeyup="if(event.key==='Enter')addVariation('${p.id}')"><button class="btn btn-ghost btn-sm" onclick="addVariation('${p.id}')">Add</button></div></div>`).join('')
      : `<div class="md:col-span-2">${empty('fa-boxes-stacked', 'No products yet. Add one above.')}</div>`;
  }
};
async function addProduct() {
  const name = $('np-name').value.trim().replace(/\s+/g, ' '); if (!name) return toast('Enter product name', 'error');
  if (S.products.some(p => norm(p.name) === norm(name))) return toast('This product already exists', 'error');
  try { await col('products').add({ name, price: num($('np-price').value), variations: [], createdAt: FV.serverTimestamp() }); $('np-name').value = ''; $('np-price').value = ''; toast('Product added'); } catch (e) { toast(e.message, 'error'); }
}
async function seedProducts() {
  if (!confirm('Add the sample products? (Ones that already exist will be skipped)')) return;
  const b = db.batch(); let n = 0;
  DEFAULT_PRODUCTS.forEach(([name, v]) => { if (!S.products.some(p => norm(p.name) === norm(name))) { b.set(col('products').doc(), { name, variations: v, createdAt: FV.serverTimestamp() }); n++; } });
  if (!n) return toast('All of them already exist', 'info');
  try { await b.commit(); toast(`${bn(n)} products added`); } catch (e) { toast(e.message, 'error'); }
}
async function addVariation(id) {
  const p = S.products.find(x => x.id === id); const v = $('nv-' + id).value.trim().replace(/\s+/g, ' '); if (!v) return;
  if ((p.variations || []).some(x => norm(x) === norm(v))) return toast('This variation already exists', 'error');
  try { await col('products').doc(id).update({ variations: FV.arrayUnion(v) }); } catch (e) { toast(e.message, 'error'); }
}
async function removeVariation(id, v) {
  if (!confirm(`Delete "${v}"?`)) return;
  const p = S.products.find(x => x.id === id); const m = { ...(p?.varPrices || {}) }; delete m[v];
  col('products').doc(id).update({ variations: FV.arrayRemove(v), varPrices: m }).catch(e => toast(e.message, 'error'));
}
async function setProductPrice(id) {
  const val = num($('pp-' + id).value);
  try { await col('products').doc(id).update({ price: val }); toast(val > 0 ? 'Default price saved' : 'Default price cleared', 'info'); } catch (e) { toast(e.message, 'error'); }
}
async function setVariationPrice(id, v) {
  const p = S.products.find(x => x.id === id); const cur = num((p.varPrices || {})[v]) || '';
  const inp = prompt(`Price (৳) for "${v}" — leave empty to use the product's default price:`, cur); if (inp === null) return;
  const val = num(inp); const m = { ...(p.varPrices || {}) };
  if (val > 0) m[v] = val; else delete m[v];
  try { await col('products').doc(id).update({ varPrices: m }); } catch (e) { toast(e.message, 'error'); }
}
async function renameProduct(id) {
  const p = S.products.find(x => x.id === id); const n = (prompt('New name:', p.name) || '').trim().replace(/\s+/g, ' ');
  if (!n || n === p.name) return; if (S.products.some(x => x.id !== id && norm(x.name) === norm(n))) return toast('A product with this name already exists', 'error');
  col('products').doc(id).update({ name: n }).catch(e => toast(e.message, 'error'));
}
async function deleteProduct(id) { if (confirm('Delete this product? (Old orders will not be affected)')) col('products').doc(id).delete().catch(e => toast(e.message, 'error')); }

// ---------------- Staff management ----------------
let _creds = {}; let _secApp = null;
function secondaryAuth() { if (!_secApp) _secApp = firebase.initializeApp(window.firebaseConfig, 'secondary'); return _secApp.auth(); }
async function loadCreds() { try { const s = await col('staff_credentials').get(); _creds = {}; s.docs.forEach(d => _creds[d.id] = d.data().password); PAGES.staff.update(); } catch (e) { console.error(e); } }
PAGES['staff'] = {
  title: 'Staff Management', sub: 'Only the admin can create and manage staff accounts',
  render() {
    return `<div class="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      <div class="card p-5 h-fit"><div class="font-bold mb-4"><i class="fas fa-user-plus text-blue-600 mr-2"></i>New Staff Account</div>
        <div class="space-y-3">
          <div><label class="lbl">Staff Name</label><input id="sf-name" class="inp" placeholder="e.g. Rahim"></div>
          <div><label class="lbl">User ID</label><input id="sf-id" class="inp" autocapitalize="none" placeholder="rahim01"><div class="text-xs text-slate-400 mt-1">Lowercase English letters, numbers, . _ - (3–20 characters)</div></div>
          <div><label class="lbl">Password</label><input id="sf-pw" class="inp" placeholder="At least 6 characters"></div>
          <button id="sf-btn" class="btn btn-primary w-full" onclick="createStaff()"><i class="fas fa-user-check"></i> Create Account</button>
        </div></div>
      <div class="card p-4 lg:col-span-2"><div class="font-bold mb-3">Staff List</div><div id="sf-list"></div></div></div>`;
  },
  mount() { this.update(); loadCreds(); },
  update() {
    const el = $('sf-list'); if (!el) return;
    const list = S.staffList.filter(u => u.role === 'staff');
    el.innerHTML = list.length ? list.map(u => {
      const mine = S.orders.filter(o => o.staffId === u.id);
      return `<div class="flex flex-wrap items-center gap-3 py-3 border-b border-slate-100">
      <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">${esc(initials(u.name))}</div>
      <div class="flex-1 min-w-[150px]"><div class="font-semibold">${esc(u.name)}</div>
        <div class="text-xs text-slate-500">ID: <code class="bg-slate-100 px-1 rounded">${esc(u.userId)}</code> • Password: <code class="bg-slate-100 px-1 rounded">${esc(_creds[u.id] ?? '…')}</code></div>
        <div class="text-xs text-slate-400">Orders: ${bn(mine.length)}${u.lastLogin ? ' • Last login: ' + fmtDate(u.lastLogin.toDate().toISOString().slice(0, 10)) : ''}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="changeStaffPw('${u.id}')"><i class="fas fa-key"></i> Password</button>
      <button class="btn btn-danger btn-sm" onclick="deleteStaff('${u.id}')"><i class="fas fa-trash"></i></button></div>`;
    }).join('') : empty('fa-user-shield', 'No staff yet');
  }
};
async function createStaff() {
  const name = $('sf-name').value.trim(), uid = $('sf-id').value.trim().toLowerCase(), pw = $('sf-pw').value;
  if (!name) return toast('Enter name', 'error');
  if (!/^[a-z0-9._-]{3,20}$/.test(uid)) return toast('Invalid User ID', 'error');
  if (pw.length < 6) return toast('Password must be at least 6 characters', 'error');
  if (S.staffList.some(u => u.userId === uid)) return toast('This User ID already exists', 'error');
  busy('sf-btn', true);
  try {
    const a = secondaryAuth(); const cr = await a.createUserWithEmailAndPassword(emailOf(uid), pw); const id = cr.user.uid; await a.signOut();
    const b = db.batch();
    b.set(col('users').doc(id), { name, userId: uid, role: 'staff', active: true, createdAt: FV.serverTimestamp() });
    b.set(col('staff_credentials').doc(id), { password: pw }); await b.commit();
    _creds[id] = pw; ['sf-name', 'sf-id', 'sf-pw'].forEach(i => $(i).value = ''); toast(`Account created for ${name}`);
  } catch (e) { console.error(e); toast(e.code === 'auth/email-already-in-use' ? 'This User ID is already in use' : 'Failed: ' + e.message, 'error'); }
  finally { busy('sf-btn', false); }
}
async function changeStaffPw(id) {
  const u = S.staffList.find(x => x.id === id); const np = prompt(`New password for ${u.name} (at least 6 characters):`); if (!np) return;
  if (np.length < 6) return toast('Password is too short', 'error');
  try {
    const a = secondaryAuth(); const cr = await a.signInWithEmailAndPassword(emailOf(u.userId), _creds[id]);
    await cr.user.updatePassword(np); await a.signOut();
    await col('staff_credentials').doc(id).set({ password: np }); _creds[id] = np; PAGES.staff.update(); toast('Password changed');
  } catch (e) { console.error(e); toast('Password change failed: ' + e.message, 'error'); }
}
async function deleteStaff(id) {
  const u = S.staffList.find(x => x.id === id); if (!confirm(`Delete ${u.name}'s account? Their old orders will be kept.`)) return;
  try { const a = secondaryAuth(); const cr = await a.signInWithEmailAndPassword(emailOf(u.userId), _creds[id]); await cr.user.delete(); } catch (e) { console.warn('Auth delete skipped', e); }
  try { const b = db.batch(); b.delete(col('users').doc(id)); b.delete(col('staff_credentials').doc(id)); await b.commit(); toast('Staff deleted', 'info'); } catch (e) { toast(e.message, 'error'); }
}
