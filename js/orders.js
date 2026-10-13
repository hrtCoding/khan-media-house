// ============================================================
//  orders.js — New order, order list, cash memo
// ============================================================
const UNITS = ['Pcs', 'Copy', 'Book', 'Set', 'Ream', 'Sq ft', 'Ft', 'Page'];
const r2 = n => Math.round((parseFloat(n) || 0) * 100) / 100;

// Default rate of a product (a variation can have its own rate)
function priceFor(prodName, variation) {
  const p = S.products.find(x => x.name === prodName); if (!p) return 0;
  const vp = variation && p.varPrices ? num(p.varPrices[variation]) : 0;
  return vp > 0 ? vp : num(p.price);
}
const prodOptions = sel => `<option value="">— Select product —</option>` + S.products.map(p =>
  `<option value="${esc(p.name)}" ${sel === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
const custOptions = sel => `<option value="">— New customer (type details below) —</option>` + S.customers.map(c =>
  `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.name)} — ${esc(c.phone || '')}${c.currentDue > 0 ? ' — Due ' + fmt(c.currentDue) : ''}</option>`).join('');

// ---------------- New order / Edit order ----------------
function itemRowHTML(it = {}) {
  const prod = S.products.find(p => p.name === it.product);
  const vars = prod?.variations || [];
  const varOpts = vars.length
    ? `<option value="">— Variation —</option>` + vars.map(v => `<option value="${esc(v)}" ${it.variation === v ? 'selected' : ''}>${esc(v)}</option>`).join('')
    : `<option value="">— None —</option>`;
  const manual = (it.manual || (it.price && !it.rate)) ? '1' : '';
  return `<div class="item-row grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-slate-50 border border-slate-200" data-manual="${manual}">
    <div class="col-span-12 sm:col-span-4"><label class="lbl">Product / Service</label><select class="inp f-product">${prodOptions(it.product)}</select></div>
    <div class="col-span-12 sm:col-span-3"><label class="lbl">Variation</label><select class="inp f-var" ${vars.length ? '' : 'disabled'}>${varOpts}</select></div>
    <div class="col-span-10 sm:col-span-4"><label class="lbl">Size <span class="font-normal text-slate-400">(optional)</span></label><input class="inp f-size" placeholder="e.g. 3x4 ft" value="${esc(it.size || '')}"></div>
    <div class="col-span-2 sm:col-span-1 text-right"><button type="button" class="btn btn-danger btn-sm f-del" title="Delete"><i class="fas fa-trash"></i></button></div>
    <div class="col-span-12 sm:col-span-5"><label class="lbl">Quantity</label>
      <div class="flex gap-1"><input class="inp f-qty" type="number" min="0" step="any" placeholder="0" value="${it.qty ?? ''}">
      <select class="inp f-unit !px-1 !w-[90px]">${UNITS.map(u => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
    <div class="col-span-6 sm:col-span-3"><label class="lbl">Rate (৳) / unit</label><input class="inp f-rate" type="number" min="0" step="any" placeholder="0" value="${it.rate ?? ''}"></div>
    <div class="col-span-6 sm:col-span-4"><label class="lbl">Amount (৳)</label><input class="inp f-price font-semibold" type="number" min="0" step="any" placeholder="0" value="${it.price ?? ''}"></div>
  </div>`;
}

// Amount = quantity × rate (only when both are filled). Typing an amount by hand overrides it.
function autoAmount(row, force) {
  const q = num(row.querySelector('.f-qty').value), r = num(row.querySelector('.f-rate').value);
  const price = row.querySelector('.f-price');
  if (q > 0 && r > 0) { row.dataset.manual = ''; price.value = r2(q * r); }
  else if (force && row.dataset.manual !== '1') price.value = '';
}
function setRate(row) {
  const rate = priceFor(row.querySelector('.f-product').value, row.querySelector('.f-var').value);
  row.querySelector('.f-rate').value = rate || '';
  autoAmount(row, true); calcOrder();
}

PAGES['new-order'] = {
  title: () => S.editOrderId ? 'Edit Order' : 'New Order',
  sub: 'Enter customer details and order information',
  render() {
    S.editOrderId = this.params.get('edit') || null;
    if (S.editOrderId && !isAdmin()) { S.editOrderId = null; }
    const o = S.editOrderId ? S.orders.find(x => x.id === S.editOrderId) : null;
    this.editing = o || null;
    const pre = !o && this.params.get('cust') ? S.customers.find(c => c.id === this.params.get('cust')) : null;
    const c = o ? { name: o.customerName, phone: o.phone, address: o.address } : (pre || {});
    const items = o ? o.items : [{}];
    const paidNow = o ? ((o.advance || 0) + (o.prevPaid || 0)) : '';
    return `<div class="grid lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
    <div class="lg:col-span-2 space-y-6">
      ${o ? `<div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm"><i class="fas fa-pen mr-1"></i> Editing order no. <b>${esc(o.orderNo)}</b></div>` : ''}
      <div class="card p-5">
        <div class="font-bold text-slate-800 mb-4"><i class="fas fa-user text-blue-600 mr-2"></i>Customer Information</div>
        <div class="grid sm:grid-cols-2 gap-4">
          ${o ? '' : `<div class="sm:col-span-2"><label class="lbl">Select existing customer</label><select id="o-cust-select" class="inp">${custOptions(pre?.id)}</select></div>`}
          <div><label class="lbl">Mobile Number *</label><input id="o-phone" class="inp" list="cust-phones" inputmode="tel" placeholder="01XXXXXXXXX" value="${esc(c.phone || '')}" ${o ? 'disabled' : ''}>
            <datalist id="cust-phones">${S.customers.map(x => `<option value="${esc(x.phone)}">${esc(x.name)}</option>`).join('')}</datalist></div>
          <div><label class="lbl">Customer Name *</label><input id="o-name" class="inp" placeholder="Enter name" value="${esc(c.name || '')}" ${o ? 'disabled' : ''}></div>
          <div class="sm:col-span-2"><label class="lbl">Address</label><input id="o-address" class="inp" placeholder="Enter address" value="${esc(c.address || '')}" ${o ? 'disabled' : ''}></div>
        </div>
        <div id="o-cust-hint" class="mt-3 text-sm"></div>
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="font-bold text-slate-800"><i class="fas fa-print text-blue-600 mr-2"></i>Order Items</div>
          <button type="button" class="btn btn-ghost btn-sm" onclick="addItemRow()"><i class="fas fa-plus"></i> Add another item</button>
        </div>
        <div id="items-box" class="space-y-3">${items.map(itemRowHTML).join('')}</div>
        ${S.products.length ? '' : `<div class="mt-3 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">No products yet. ${isAdmin() ? 'Add products from the "Products & Services" menu.' : 'Ask the admin to add products.'}</div>`}
        <div class="mt-3 text-xs text-slate-400">Amount fills automatically (quantity × rate). You can also type the amount by hand.</div>
      </div>
      <div class="card p-5">
        <div class="font-bold text-slate-800 mb-3"><i class="fas fa-note-sticky text-blue-600 mr-2"></i>Note / Details</div>
        <textarea id="o-note" class="inp" rows="6" placeholder="Design instructions, colour, paper type, special requirements, etc.…">${esc(o?.note || '')}</textarea>
      </div>
    </div>
    <div class="space-y-6">
      <div class="card p-5 lg:sticky lg:top-24">
        <div class="font-bold text-slate-800 mb-4"><i class="fas fa-calendar-check text-blue-600 mr-2"></i>Date & Payment</div>
        <div class="space-y-4">
          <div><label class="lbl">Order Date (automatic)</label><input class="inp" disabled value="${fmtDate(o?.orderDate || todayStr())}"></div>
          <div><label class="lbl">Delivery Date *</label><input id="o-delivery" type="date" class="inp" min="${o ? '' : todayStr()}" value="${o?.deliveryDate || ''}"></div>
          <div class="rounded-xl bg-blue-50 p-4 space-y-2">
            <div class="flex justify-between text-sm"><span class="text-slate-600">Order Total</span><b id="o-total">${fmt(o?.total || 0)}</b></div>
            <div class="flex justify-between text-sm"><span class="text-slate-600">Previous Due</span><b id="o-prev" class="text-amber-600">${fmt(o?.prevDue || 0)}</b></div>
            <div class="flex justify-between border-t border-blue-200 pt-2"><span class="text-slate-700 font-semibold">Grand Total</span><b id="o-grand" class="text-lg">${fmt(0)}</b></div>
            <div><label class="lbl">Paid Now (৳)</label><input id="o-advance" type="number" min="0" step="any" class="inp" placeholder="0" value="${paidNow}"></div>
            <div class="flex justify-between border-t border-blue-200 pt-2"><span class="text-slate-600">Remaining Due</span><b id="o-due" class="text-xl text-rose-600">${fmt(0)}</b></div>
          </div>
          <button id="o-save" class="btn btn-primary w-full py-3 text-base" onclick="saveOrder()"><i class="fas fa-floppy-disk"></i> ${o ? 'Save Changes' : 'Save Order & Create Memo'}</button>
        </div>
      </div>
    </div>
  </div>`;
  },
  mount() {
    const box = $('items-box');
    box.addEventListener('input', e => {
      const row = e.target.closest('.item-row'); if (!row) return; const t = e.target;
      if (t.classList.contains('f-qty') || t.classList.contains('f-rate')) autoAmount(row);
      else if (t.classList.contains('f-price')) row.dataset.manual = '1';
      calcOrder();
    });
    box.addEventListener('change', e => {
      const row = e.target.closest('.item-row'); if (!row) return;
      if (e.target.classList.contains('f-product')) {
        const p = S.products.find(x => x.name === e.target.value); const v = row.querySelector('.f-var');
        const vars = p?.variations || [];
        v.disabled = !vars.length;
        v.innerHTML = vars.length ? `<option value="">— Variation —</option>` + vars.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('') : `<option value="">— None —</option>`;
        setRate(row);
      } else if (e.target.classList.contains('f-var')) setRate(row);
    });
    box.addEventListener('click', e => {
      const b = e.target.closest('.f-del'); if (!b) return;
      if (box.children.length > 1) { b.closest('.item-row').remove(); calcOrder(); } else toast('At least one item is required', 'info');
    });
    $('o-advance').addEventListener('input', calcOrder);
    $('o-phone').addEventListener('input', matchCustomer);
    const cs = $('o-cust-select');
    if (cs) cs.addEventListener('change', () => {
      const c = S.customers.find(x => x.id === cs.value);
      $('o-phone').value = c?.phone || ''; $('o-name').value = c?.name || ''; $('o-address').value = c?.address || '';
      matchCustomer();
    });
    calcOrder(); matchCustomer();
  },
  // keep dropdowns / previous due live when data arrives, without wiping what the user typed
  update() {
    if (!$('items-box')) return;
    document.querySelectorAll('#items-box .f-product').forEach(sel => {
      if (sel.options.length !== S.products.length + 1) { const cur = sel.value; sel.innerHTML = prodOptions(cur); sel.value = cur; }
    });
    const cs = $('o-cust-select');
    if (cs && cs.options.length !== S.customers.length + 1) { const cur = cs.value; cs.innerHTML = custOptions(cur); cs.value = cur; }
    calcOrder();
  }
};
function addItemRow() { $('items-box').insertAdjacentHTML('beforeend', itemRowHTML()); }
function readItems() {
  return [...document.querySelectorAll('#items-box .item-row')].map(r => ({
    product: r.querySelector('.f-product').value,
    variation: r.querySelector('.f-var').value || '',
    size: r.querySelector('.f-size').value.trim(),
    qty: num(r.querySelector('.f-qty').value),
    unit: r.querySelector('.f-unit').value,
    rate: num(r.querySelector('.f-rate').value),
    price: num(r.querySelector('.f-price').value),
    manual: r.dataset.manual === '1'
  }));
}
function findCustomerByPhone(p) { const k = en(p).replace(/\D/g, ''); return k ? S.customers.find(c => en(c.phone).replace(/\D/g, '') === k) : null; }
// Due the customer already owes before this order
function prevDueNow() {
  if (S.editOrderId) { const o = S.orders.find(x => x.id === S.editOrderId); return o ? (o.prevDue || 0) : 0; }
  const c = findCustomerByPhone($('o-phone').value); return c ? (c.currentDue || 0) : 0;
}
function calcOrder() {
  if (!$('o-total')) return;
  const total = r2(readItems().reduce((s, i) => s + i.price, 0));
  const prev = prevDueNow(), grand = r2(total + prev), adv = num($('o-advance').value);
  $('o-total').textContent = fmt(total); $('o-prev').textContent = fmt(prev); $('o-grand').textContent = fmt(grand);
  const due = r2(grand - adv); const el = $('o-due');
  el.textContent = fmt(due); el.className = 'text-xl font-bold ' + (due < 0 ? 'text-amber-600' : 'text-rose-600');
}
function matchCustomer() {
  if (S.editOrderId) return;
  const c = findCustomerByPhone($('o-phone').value); const hint = $('o-cust-hint');
  const cs = $('o-cust-select'); if (cs) cs.value = c ? c.id : '';
  if (c) {
    $('o-name').value = c.name; if (c.address) $('o-address').value = c.address;
    hint.innerHTML = `<div class="p-3 rounded-lg bg-green-50 text-green-800 border border-green-200"><i class="fas fa-circle-check mr-1"></i> Existing customer — previous due: <b>${fmt(c.currentDue)}</b> (added to this bill)</div>`;
  } else hint.innerHTML = $('o-phone').value.length > 5 ? `<div class="text-slate-500"><i class="fas fa-user-plus mr-1"></i> Will be added as a new customer</div>` : '';
  calcOrder();
}

async function nextOrderNo() {
  const ref = col('counters').doc('orders');
  return db.runTransaction(async t => { const s = await t.get(ref); const n = (s.exists ? s.data().last : 0) + 1; t.set(ref, { last: n }); return n; });
}

async function saveOrder() {
  const editing = S.editOrderId ? S.orders.find(o => o.id === S.editOrderId) : null;
  const name = $('o-name').value.trim(), phone = en($('o-phone').value).replace(/[\s-]/g, ''), address = $('o-address').value.trim();
  const delivery = $('o-delivery').value, note = $('o-note').value.trim(), adv = num($('o-advance').value);
  const items = readItems();
  if (!phone || !/^(\+?88)?01\d{9}$/.test(phone)) return toast('Enter a valid mobile number (11 digits)', 'error');
  if (!name) return toast('Enter customer name', 'error');
  if (!delivery) return toast('Enter delivery date', 'error');
  if (items.some(i => !i.product)) return toast('Select a product in every row', 'error');
  for (const i of items) {
    const p = S.products.find(x => x.name === i.product);
    if (p?.variations?.length && !i.variation) return toast(`"${i.product}" — select a variation`, 'error');
    if (!(i.qty > 0)) return toast('Enter quantity', 'error');
    if (!(i.price > 0)) return toast('Enter an amount for every item', 'error');
  }
  const total = r2(items.reduce((s, i) => s + i.price, 0));
  const cust = editing ? null : findCustomerByPhone(phone);
  const prev = editing ? (editing.prevDue || 0) : (cust ? (cust.currentDue || 0) : 0);
  const grand = r2(total + prev);
  if (adv < 0 || adv > grand) return toast('Paid amount cannot be more than the grand total', 'error');
  // Payment goes to this order first; anything extra reduces the previous due
  const applied = r2(Math.min(adv, total)), extra = r2(adv - applied), due = r2(total - applied);
  busy('o-save', true);
  try {
    if (editing) {
      const delta = r2((due - (editing.due || 0)) - (extra - (editing.prevPaid || 0)));
      const b = db.batch();
      b.update(col('orders').doc(editing.id), { items, total, advance: applied, prevPaid: extra, due, note, deliveryDate: delivery, updatedAt: FV.serverTimestamp(), updatedBy: S.user.name });
      if (editing.customerId) {
        if (delta) b.update(col('customers').doc(editing.customerId), { currentDue: FV.increment(delta) });
        const tref = col('transactions').doc('order_' + editing.id);
        if (due > 0) b.set(tref, { customerId: editing.customerId, date: editing.orderDate, type: 'add_due', amount: due, description: `Order ${editing.orderNo}`, orderId: editing.id, createdAt: FV.serverTimestamp() });
        else b.delete(tref);
        const pref = col('transactions').doc('prevpay_' + editing.id);
        if (extra > 0) b.set(pref, { customerId: editing.customerId, date: editing.orderDate, type: 'payment', amount: extra, description: `Paid with order ${editing.orderNo}`, orderId: editing.id, createdAt: FV.serverTimestamp() });
        else b.delete(pref);
      }
      await b.commit();
      toast('Order updated'); go('orders'); return;
    }
    // ---- New order ----
    const b = db.batch(); let custId;
    if (cust) { custId = cust.id; b.update(col('customers').doc(custId), { currentDue: FV.increment(r2(due - extra)), orderCount: FV.increment(1), ...(address && !cust.address ? { address } : {}) }); }
    else {
      const cr = col('customers').doc(); custId = cr.id;
      b.set(cr, { name, phone, address, currentDue: due, orderCount: 1, createdBy: S.user.uid, createdByName: S.user.name, createdAt: FV.serverTimestamp() });
    }
    const n = await nextOrderNo(); const orderNo = 'KMH-' + String(n).padStart(4, '0');
    const oref = col('orders').doc();
    b.set(oref, {
      orderNo, orderNoNum: n, customerId: custId, customerName: cust ? cust.name : name, phone: cust ? cust.phone : phone, address: address || cust?.address || '',
      items, total, advance: applied, prevPaid: extra, prevDue: prev, due, note, orderDate: todayStr(), deliveryDate: delivery, status: 'pending',
      staffId: S.user.uid, staffName: S.user.name, createdAt: FV.serverTimestamp()
    });
    if (due > 0) b.set(col('transactions').doc('order_' + oref.id), { customerId: custId, date: todayStr(), type: 'add_due', amount: due, description: `Order ${orderNo}`, orderId: oref.id, createdAt: FV.serverTimestamp() });
    if (extra > 0) b.set(col('transactions').doc('prevpay_' + oref.id), { customerId: custId, date: todayStr(), type: 'payment', amount: extra, description: `Paid with order ${orderNo}`, orderId: oref.id, createdAt: FV.serverTimestamp() });
    await b.commit();
    toast(`Order ${orderNo} saved`);
    const saved = { id: oref.id, orderNo, customerName: cust ? cust.name : name, phone: cust ? cust.phone : phone, address, items, total, advance: applied, prevPaid: extra, prevDue: prev, due, note, orderDate: todayStr(), deliveryDate: delivery, status: 'pending', staffName: S.user.name };
    go('orders'); showMemo(saved);
  } catch (e) { console.error(e); toast('Save failed: ' + e.message, 'error'); }
  finally { busy('o-save', false); }
}

// ---------------- Cash memo ----------------
function memoHTML(o) {
  const B = window.BUSINESS;
  const prev = o.prevDue || 0, paid = (o.advance || 0) + (o.prevPaid || 0), grand = r2(o.total + prev), balance = r2(grand - paid);
  const sub = t => `<div style="font-size:12px;color:#475569">${t}</div>`;
  const rows = o.items.map((it, i) => `<tr><td>${i + 1}</td><td><b>${esc(it.product)}</b>${it.variation ? sub(esc(it.variation)) : ''}${it.size ? sub('Size: ' + esc(it.size)) : ''}</td><td>${it.qty} ${esc(it.unit || '')}</td><td class="r">${it.rate ? fmt(it.rate) : '—'}</td><td class="r">${fmt(it.price)}</td></tr>`).join('');
  const foot = (label, val, bold, color) => `<tr><td colspan="4" class="r">${bold ? `<b>${label}</b>` : label}</td><td class="r">${bold ? `<b${color ? ` style="color:${color}"` : ''}>${val}</b>` : val}</td></tr>`;
  return `<div class="memo">
    <div class="memo-head"><h1>${esc(B.name)}</h1><div style="font-size:13px;color:#334155">${esc(B.tagline)}</div><div style="font-size:13px;color:#334155">Location: ${esc(B.address)}</div><div style="font-size:13px;color:#334155">Mobile: ${esc(B.phone)}</div></div>
    <div style="text-align:center"><span class="memo-title">Cash Memo / Invoice</span></div>
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      <div><b>Order No:</b> ${esc(o.orderNo)}</div>
      <div><b>Date:</b> ${fmtDate(o.orderDate)}</div>
      <div><b>Delivery Date:</b> ${fmtDate(o.deliveryDate)}</div>
    </div>
    <div style="border:1px solid #334155;padding:8px 10px;margin-bottom:12px;border-radius:4px">
      <div><b>Customer Name:</b> ${esc(o.customerName)}</div>
      <div><b>Mobile:</b> ${esc(o.phone)}</div>
      ${o.address ? `<div><b>Address:</b> ${esc(o.address)}</div>` : ''}
    </div>
    <table><thead><tr><th style="width:40px">SL</th><th>Description</th><th style="width:110px">Quantity</th><th class="r" style="width:100px">Rate</th><th class="r" style="width:120px">Amount</th></tr></thead><tbody>${rows}</tbody>
      <tfoot>
        ${foot(prev ? 'Order Total' : 'Total', fmt(o.total), true)}
        ${prev ? foot('Previous Due', fmt(prev)) + foot('Grand Total', fmt(grand), true) : ''}
        ${foot(prev ? 'Paid' : 'Advance Paid', fmt(paid))}
        ${foot('Due', fmt(balance), true, '#B91C1C')}
      </tfoot></table>
    ${o.note ? `<div style="margin-top:12px"><b>Note:</b><div style="white-space:pre-wrap;border:1px dashed #94A3B8;padding:8px;border-radius:4px;margin-top:4px">${esc(o.note)}</div></div>` : ''}
    <div style="margin-top:12px"><b>Received By:</b> ${esc(o.staffName)}</div>
    <div class="memo-sign"><div>Customer's Signature</div><div>Authorized Signature</div></div>
    <div style="text-align:center;font-size:12px;color:#64748B;margin-top:14px">Thank you — please visit again!</div>
  </div>`;
}
function showMemo(o) {
  window._memoOrder = o;
  openModal(`${modalHead('Cash Memo', esc(o.orderNo))}
    <div class="p-4 overflow-x-auto bg-slate-100">${memoHTML(o)}</div>
    <div class="p-4 flex flex-wrap gap-2 justify-end border-t border-slate-100">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-ok" onclick="printHTML(memoHTML(window._memoOrder))"><i class="fas fa-print"></i> Print</button>
      <button id="pdf-btn" class="btn btn-primary" onclick="downloadMemoPDF()"><i class="fas fa-file-pdf"></i> Save PDF</button>
    </div>`, true);
}
function viewMemo(id) { const o = S.orders.find(x => x.id === id); if (o) showMemo(o); }
async function downloadMemoPDF() {
  const o = window._memoOrder; busy('pdf-btn', true);
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff';
  holder.innerHTML = memoHTML(o); document.body.appendChild(holder);
  try {
    await document.fonts.ready;
    const canvas = await html2canvas(holder.firstElementChild, { scale: 2, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
    let w = 190, h = canvas.height * w / canvas.width; if (h > 277) { h = 277; w = canvas.width * h / canvas.height; }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (210 - w) / 2, 10, w, h);
    pdf.save(`memo-${o.orderNo}.pdf`); toast('PDF saved');
  } catch (e) { console.error(e); toast('PDF creation failed. Use Print and choose "Save as PDF".', 'error'); }
  finally { holder.remove(); busy('pdf-btn', false); }
}

// ---------------- Order list ----------------
PAGES['orders'] = {
  title: 'Orders', sub: '',
  render() {
    return `<div class="card p-4 max-w-7xl mx-auto">
      <div class="flex flex-wrap gap-3 mb-4">
        <input id="ol-search" class="inp flex-1 min-w-[200px]" placeholder="🔍 Search order no. / name / mobile / product…" oninput="PAGES.orders.update()">
        <select id="ol-status" class="inp !w-auto" onchange="PAGES.orders.update()"><option value="">All statuses</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <input id="ol-date" type="date" class="inp !w-auto" title="Delivery date" onchange="PAGES.orders.update()">
        <button class="btn btn-primary" onclick="go('new-order')"><i class="fas fa-plus"></i> New Order</button>
      </div>
      <div class="text-sm text-slate-500 mb-2" id="ol-count"></div>
      <div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Order No</th><th>Customer</th><th>Product</th><th>Order Date</th><th>Delivery</th><th>Total</th><th>Due</th><th>Staff</th><th>Status</th><th></th></tr></thead><tbody id="ol-body"></tbody></table></div>
    </div>`;
  },
  mount() { this.update(); },
  update() {
    const body = $('ol-body'); if (!body) return;
    const q = norm($('ol-search').value), st = $('ol-status').value, dt = $('ol-date').value;
    const list = S.orders.filter(o =>
      (!st || o.status === st) && (!dt || o.deliveryDate === dt) &&
      (!q || norm([o.orderNo, o.customerName, o.phone, ...o.items.map(i => i.product + ' ' + i.variation + ' ' + (i.size || ''))].join(' ')).includes(q)));
    $('ol-count').textContent = `Total ${list.length} orders`;
    if (!list.length) { body.innerHTML = `<tr><td colspan="10">${empty('fa-inbox', 'No orders found')}</td></tr>`; return; }
    body.innerHTML = list.map(o => {
      const first = o.items[0]; const more = o.items.length > 1 ? ` <span class="badge bg-slate-100 text-slate-600">+${o.items.length - 1}</span>` : '';
      const late = o.status !== 'delivered' && o.deliveryDate < todayStr();
      const stCell = isAdmin()
        ? `<select class="inp !py-1 !px-2 !text-xs !w-auto" onchange="setStatus('${o.id}',this.value)">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`
        : statusBadge(o.status);
      return `<tr>
        <td class="font-semibold text-blue-700">${esc(o.orderNo)}</td>
        <td><div class="font-medium">${esc(o.customerName)}</div><div class="text-xs text-slate-400">${esc(o.phone)}</div></td>
        <td>${esc(first.product)}${first.variation ? `<div class="text-xs text-slate-400">${esc(first.variation)}</div>` : ''}${first.size ? `<div class="text-xs text-slate-400">Size: ${esc(first.size)}</div>` : ''}${more}</td>
        <td>${fmtDate(o.orderDate)}</td>
        <td class="${late ? 'text-rose-600 font-semibold' : ''}">${fmtDate(o.deliveryDate)}${late ? '<div class="text-xs">Overdue</div>' : ''}</td>
        <td class="font-semibold">${fmt(o.total)}</td>
        <td class="${o.due > 0 ? 'text-rose-600 font-semibold' : 'text-green-600'}">${fmt(o.due)}</td>
        <td>${esc(o.staffName)}</td><td>${stCell}</td>
        <td class="whitespace-nowrap">
          <button class="btn btn-ghost btn-sm" title="View memo" onclick="viewMemo('${o.id}')"><i class="fas fa-eye"></i></button>
          ${isAdmin() ? `<button class="btn btn-ok btn-sm" title="Edit" onclick="go('new-order','edit=${o.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-danger btn-sm" title="Delete" onclick="deleteOrder('${o.id}')"><i class="fas fa-trash"></i></button>` : ''}
        </td></tr>`;
    }).join('');
  }
};
async function setStatus(id, status) {
  try { await col('orders').doc(id).update({ status }); toast('Status updated'); } catch (e) { toast(e.message, 'error'); }
}
async function deleteOrder(id) {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  if (!confirm(`Delete order ${o.orderNo}? The customer's due will be adjusted automatically.`)) return;
  try {
    const b = db.batch(); b.delete(col('orders').doc(id)); b.delete(col('transactions').doc('order_' + id)); b.delete(col('transactions').doc('prevpay_' + id));
    if (o.customerId && S.customers.some(c => c.id === o.customerId)) b.update(col('customers').doc(o.customerId), { currentDue: FV.increment(r2((o.prevPaid || 0) - (o.due || 0))), orderCount: FV.increment(-1) });
    await b.commit(); toast('Order deleted', 'info');
  } catch (e) { toast(e.message, 'error'); }
}
