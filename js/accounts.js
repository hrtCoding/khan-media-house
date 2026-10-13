// ============================================================
//  accounts.js — Dashboard, daily accounts, history, reports
// ============================================================
let chartInst = null;
const sum = (arr, f) => arr.reduce((s, x) => s + (parseFloat(f(x)) || 0), 0);
const dayStr = off => { const d = new Date(); d.setDate(d.getDate() - off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// ---------------- Dashboard (last 30 days) ----------------
PAGES['dashboard'] = {
  title: 'Dashboard', sub: 'Summary of the last 30 days',
  render() {
    const A = isAdmin();
    return `<div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm text-slate-500"><i class="fas fa-clock-rotate-left mr-1"></i> Showing the last 30 days (${fmtDate(dayStr(29))} – ${fmtDate(todayStr())})</div>
        ${A ? `<button class="btn btn-ghost btn-sm" onclick="go('history')"><i class="fas fa-list"></i> Full history (lifetime / by month)</button>` : ''}
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4" id="d-kpis"></div>
      <div class="grid lg:grid-cols-3 gap-6">
        <div class="card p-5 lg:col-span-2"><div class="font-bold mb-3">Recent Orders <span class="text-xs font-normal text-slate-400">(last 30 days)</span></div><div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Delivery</th><th>Due</th><th>Status</th></tr></thead><tbody id="d-recent"></tbody></table></div></div>
        <div class="card p-5"><div class="font-bold mb-3">${A ? 'Staff Activity' : 'To Deliver Today'}</div><div id="d-side"></div></div>
      </div>
      ${A ? `<div class="card p-5"><div class="font-bold mb-3">Order Sales & Expenses — Last 30 Days</div><div style="height:280px"><canvas id="d-chart"></canvas></div></div>` : ''}
    </div>`;
  },
  mount() { this.update(); },
  update() {
    const k = $('d-kpis'); if (!k) return; const A = isAdmin(); const t = todayStr(); const from = dayStr(29);
    const in30 = d => !!d && d >= from && d <= t;
    const O = S.orders, O30 = O.filter(o => in30(o.orderDate)), pend = O.filter(o => o.status !== 'delivered'), todayDel = pend.filter(o => o.deliveryDate === t);
    const totalDue = sum(S.customers, c => c.currentDue);
    k.innerHTML = kpi('Orders (30 days)', O30.length, 'fa-file-invoice', '#2563EB') + kpi('Today\'s Orders', O.filter(o => o.orderDate === t).length, 'fa-calendar-day', '#0891B2') +
      kpi('Pending Delivery', pend.length, 'fa-truck-fast', '#D97706') + kpi('Today\'s Delivery', todayDel.length, 'fa-box-open', '#7C3AED') +
      kpi('Total Due Amount', fmt(totalDue), 'fa-hand-holding-dollar', '#DC2626') +
      (A ? kpi('Order Sales (30 days)', fmt(sum(O30, o => o.total)), 'fa-sack-dollar', '#16A34A') +
        kpi('Daily Sales (30 days)', fmt(sum(S.daily.filter(r => r.type === 'sale' && in30(r.date)), r => r.amount)), 'fa-cart-shopping', '#0D9488') +
        kpi('Salary Paid (30 days)', fmt(sum(S.salaryPays.filter(p => in30(p.date)), p => p.amount)), 'fa-money-bill-wave', '#DB2777') +
        kpi('Expenses (30 days)', fmt(sum(S.daily.filter(r => r.type === 'expense' && in30(r.date)), r => r.amount)), 'fa-receipt', '#EA580C') : '');
    $('d-recent').innerHTML = O30.slice(0, 8).map(o => `<tr class="cursor-pointer" onclick="viewMemo('${o.id}')"><td class="font-semibold text-blue-700">${esc(o.orderNo)}</td><td>${esc(o.customerName)}</td><td>${fmtDate(o.deliveryDate)}</td><td class="${o.due > 0 ? 'text-rose-600' : 'text-green-600'}">${fmt(o.due)}</td><td>${statusBadge(o.status)}</td></tr>`).join('') || `<tr><td colspan="5">${empty('fa-inbox', 'No orders in the last 30 days')}</td></tr>`;
    const side = $('d-side');
    if (A) {
      const st = S.staffList.filter(u => u.role === 'staff');
      side.innerHTML = st.length ? st.map(u => { const m = O30.filter(o => o.staffId === u.id); const td = m.filter(o => o.orderDate === t).length;
        return `<div class="flex items-center gap-3 py-2.5 border-b border-slate-100"><div class="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">${esc(initials(u.name))}</div>
        <div class="flex-1"><div class="font-medium text-sm">${esc(u.name)}</div><div class="text-xs text-slate-400">Today: ${td} • Last 30 days: ${m.length} orders</div></div></div>`; }).join('') : empty('fa-user-shield', 'No staff yet');
    } else side.innerHTML = todayDel.length ? todayDel.map(o => `<div class="py-2 border-b border-slate-100 text-sm"><b>${esc(o.orderNo)}</b> — ${esc(o.customerName)}</div>`).join('') : empty('fa-circle-check', 'No deliveries today');
    if (A && $('d-chart')) {
      const days = [...Array(30)].map((_, i) => dayStr(29 - i));
      const sales = days.map(d => sum(O.filter(o => o.orderDate === d), o => o.total));
      const exp = days.map(d => sum(S.daily.filter(r => r.type === 'expense' && r.date === d), r => r.amount));
      chartInst && chartInst.destroy();
      chartInst = new Chart($('d-chart'), { type: 'bar', data: { labels: days.map(d => fmtDate(d).slice(0, 5)), datasets: [{ label: 'Order Sales', data: sales, backgroundColor: '#2563EB', borderRadius: 4 }, { label: 'Expenses', data: exp, backgroundColor: '#F97316', borderRadius: 4 }] }, options: { maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: 'Hind Siliguri' } } } } } });
    }
  }
};

// ---------------- Daily accounts ----------------
PAGES['daily'] = {
  title: 'Daily Accounts', sub: 'Daily sales and expenses',
  render() {
    const f = (t, c, ic, lbl) => `<div class="card p-5"><div class="font-bold mb-3"><i class="fas ${ic} ${c} mr-2"></i>${lbl}</div><div class="space-y-3">
      <input id="${t}-date" type="date" class="inp" value="${todayStr()}"><input id="${t}-amt" type="number" min="0" class="inp" placeholder="Amount">
      <input id="${t}-note" class="inp" placeholder="${t === 'sale' ? 'Description (optional)' : 'Reason for expense *'}"><button id="${t}-btn" class="btn btn-primary w-full" onclick="addDaily('${t === 'sale' ? 'sale' : 'expense'}')">Save</button></div></div>`;
    return `<div class="max-w-6xl mx-auto grid lg:grid-cols-3 gap-6"><div class="space-y-6">${f('sale', 'text-blue-600', 'fa-cart-shopping', 'Daily Sales')}${f('exp', 'text-rose-600', 'fa-receipt', 'Daily Expenses')}</div>
      <div class="card p-4 lg:col-span-2"><div class="flex gap-3 mb-3 items-center"><input id="dd-date" type="date" class="inp !w-auto" onchange="PAGES.daily.update()"><button class="btn btn-ghost btn-sm" onclick="$('dd-date')._flatpickr.clear();PAGES.daily.update()">Show all</button></div>
      <div class="grid grid-cols-3 gap-3 mb-4 text-center" id="dd-sum"></div><div id="dd-list"></div></div></div>`;
  },
  mount() { this.update(); },
  update() {
    const l = $('dd-list'); if (!l) return; const d = $('dd-date').value; const list = S.daily.filter(r => !d || r.date === d);
    const s = sum(list.filter(r => r.type === 'sale'), r => r.amount), e = sum(list.filter(r => r.type === 'expense'), r => r.amount);
    $('dd-sum').innerHTML = `<div class="rounded-xl bg-blue-50 p-3"><div class="text-xs text-slate-500">Sales</div><b class="text-blue-700">${fmt(s)}</b></div><div class="rounded-xl bg-rose-50 p-3"><div class="text-xs text-slate-500">Expenses</div><b class="text-rose-700">${fmt(e)}</b></div><div class="rounded-xl bg-green-50 p-3"><div class="text-xs text-slate-500">Net</div><b class="${s - e >= 0 ? 'text-green-700' : 'text-rose-700'}">${fmt(s - e)}</b></div>`;
    l.innerHTML = list.length ? list.map(dailyRow).join('') : empty('fa-calendar', 'No records');
  }
};
function dailyRow(r) {
  const s = r.type === 'sale';
  return `<div class="flex items-center gap-3 py-2.5 border-b border-slate-100"><div class="w-8 h-8 rounded-lg ${s ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center"><i class="fas ${s ? 'fa-cart-shopping' : 'fa-receipt'}"></i></div>
    <div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">${esc(r.reason)}</div><div class="text-xs text-slate-400">${fmtDate(r.date)}</div></div>
    <b class="${s ? 'text-blue-600' : 'text-rose-600'}">${s ? '+' : '−'}${fmt(r.amount)}</b><button class="text-slate-300 hover:text-rose-500" onclick="deleteDaily('${r.id}')"><i class="fas fa-circle-xmark"></i></button></div>`;
}
async function addDaily(type) {
  const p = type === 'sale' ? 'sale' : 'exp'; const date = $(p + '-date').value, amount = num($(p + '-amt').value), note = $(p + '-note').value.trim();
  if (!date || !(amount > 0)) return toast('Enter date and a valid amount', 'error');
  if (type === 'expense' && !note) return toast('Enter the reason for the expense', 'error');
  busy(p + '-btn', true);
  try { await col('daily_records').add({ date, type, amount, reason: note || 'Daily sales', createdAt: FV.serverTimestamp() }); $(p + '-amt').value = ''; $(p + '-note').value = ''; toast('Saved'); }
  catch (e) { toast(e.message, 'error'); } finally { busy(p + '-btn', false, 'Save'); }
}
async function deleteDaily(id) { if (confirm('Delete this record?')) col('daily_records').doc(id).delete().catch(e => toast(e.message, 'error')); }

// ---------------- Full history ----------------
const HIST_CATS = [
  ['orders', 'Orders', 'fa-file-invoice', '#2563EB'],
  ['sales', 'Daily Sales', 'fa-cart-shopping', '#16A34A'],
  ['expenses', 'Daily Expenses', 'fa-receipt', '#EA580C'],
  ['payments', 'Customer Payments Received', 'fa-hand-holding-dollar', '#0891B2'],
  ['dues', 'Manual Due Entries', 'fa-book', '#D97706'],
  ['salary', 'Salary Payments', 'fa-money-bill-wave', '#DB2777']
];
PAGES['history'] = {
  title: 'Full History', sub: 'All records by category — lifetime or by month',
  f: { period: 'month', month: thisMonth(), from: '', to: '', cats: { orders: true, sales: true, expenses: true, payments: true, dues: true, salary: true } },
  render() {
    const f = this.f;
    return `<div class="max-w-5xl mx-auto space-y-5">
      <div class="card p-4 space-y-4">
        <div class="flex flex-wrap gap-3 items-end">
          <div><label class="lbl">Period</label><select id="hf-period" class="inp !w-auto" onchange="PAGES.history.setPeriod(this.value)">
            ${[['30d', 'Last 30 days'], ['month', 'Pick a month'], ['range', 'Custom range'], ['all', 'All time (lifetime)']].map(([k, l]) => `<option value="${k}" ${f.period === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div id="hf-month-box" class="${f.period === 'month' ? '' : 'hidden'}"><label class="lbl">Month</label><input id="hf-month" type="month" class="inp" value="${f.month}" onchange="PAGES.history.f.month=this.value||thisMonth();PAGES.history.paint()"></div>
          <div id="hf-range-box" class="${f.period === 'range' ? 'flex' : 'hidden'} gap-3">
            <div><label class="lbl">From</label><input id="hf-from" type="date" class="inp" value="${f.from}" onchange="PAGES.history.f.from=this.value;PAGES.history.paint()"></div>
            <div><label class="lbl">To</label><input id="hf-to" type="date" class="inp" value="${f.to}" onchange="PAGES.history.f.to=this.value;PAGES.history.paint()"></div>
          </div>
        </div>
        <div><div class="lbl">Show categories <span class="font-normal text-slate-400">(untick to hide)</span></div>
          <div class="flex flex-wrap gap-2">${HIST_CATS.map(([k, l, ic, c]) => `<label class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer text-sm select-none"><input type="checkbox" class="accent-blue-600" ${f.cats[k] ? 'checked' : ''} onchange="PAGES.history.f.cats['${k}']=this.checked;PAGES.history.paint()"><i class="fas ${ic}" style="color:${c}"></i>${l}</label>`).join('')}</div></div>
      </div>
      <div id="hist-body" class="space-y-5"></div></div>`;
  },
  mount() { this.paint(); },
  update() { this.paint(); },
  setPeriod(v) {
    this.f.period = v; $('hf-month-box').classList.toggle('hidden', v !== 'month');
    const r = $('hf-range-box'); r.classList.toggle('hidden', v !== 'range'); r.classList.toggle('flex', v === 'range');
    this.paint();
  },
  inPeriod(d) {
    if (!d) return false; const f = this.f;
    if (f.period === 'all') return true;
    if (f.period === '30d') return d >= dayStr(29) && d <= todayStr();
    if (f.period === 'month') return d.startsWith(f.month);
    return (!f.from || d >= f.from) && (!f.to || d <= f.to);
  },
  paint() {
    const b = $('hist-body'); if (!b) return;
    const inP = d => this.inPeriod(d), byDate = (a, c) => (c.date || '').localeCompare(a.date || '');
    const custName = id => S.customers.find(c => c.id === id)?.name || 'Deleted customer';
    const row = (title, sub, amt, color, extra = '') => `<div class="flex items-center gap-3 py-2.5 border-b border-slate-100 ${extra}"><div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">${title}</div><div class="text-xs text-slate-400">${sub}</div></div><b class="${color}">${fmt(amt)}</b></div>`;
    const C = {
      orders: { list: S.orders.filter(o => inP(o.orderDate)).sort((a, c) => (c.orderDate || '').localeCompare(a.orderDate || '') || (c.orderNoNum || 0) - (a.orderNoNum || 0)), amt: o => o.total,
        html: o => row(`${esc(o.orderNo)} — ${esc(o.customerName)}`, `${fmtDate(o.orderDate)} • ${statusBadge(o.status)}${o.due > 0 ? ` • Due ${fmt(o.due)}` : ''}`, o.total, 'text-blue-700', `cursor-pointer" onclick="viewMemo('${o.id}')`) },
      sales: { list: S.daily.filter(r => r.type === 'sale' && inP(r.date)), amt: r => r.amount, html: dailyRow },
      expenses: { list: S.daily.filter(r => r.type === 'expense' && inP(r.date)), amt: r => r.amount, html: dailyRow },
      payments: { list: S.txs.filter(t => t.type === 'payment' && inP(t.date)).sort(byDate), amt: t => t.amount,
        html: t => row(esc(custName(t.customerId)), `${fmtDate(t.date)}${t.description ? ' • ' + esc(t.description) : ''}`, t.amount, 'text-cyan-700') },
      dues: { list: S.txs.filter(t => t.type === 'add_due' && !t.orderId && inP(t.date)).sort(byDate), amt: t => t.amount,
        html: t => row(esc(custName(t.customerId)), `${fmtDate(t.date)}${t.description ? ' • ' + esc(t.description) : ''}`, t.amount, 'text-amber-600') },
      salary: { list: S.salaryPays.filter(p => inP(p.date)).sort(byDate), amt: p => p.amount,
        html: p => row(esc(p.employeeName), `${fmtDate(p.date)} • ${monthLabel(p.forMonth)} • ${p.type === 'advance' ? 'Advance' : 'Salary'}${p.note ? ' • ' + esc(p.note) : ''}`, p.amount, 'text-pink-600') }
    };
    const on = HIST_CATS.filter(([k]) => this.f.cats[k]);
    if (!on.length) { b.innerHTML = `<div class="card p-4">${empty('fa-square-check', 'Tick at least one category above')}</div>`; return; }
    const kpis = on.map(([k, l, ic, c]) => kpi(`${l} (${C[k].list.length})`, fmt(sum(C[k].list, C[k].amt)), ic, c)).join('');
    const cards = on.map(([k, l, ic, c]) => `<div class="card p-4"><div class="flex items-center justify-between mb-2"><div class="font-bold"><i class="fas ${ic} mr-2" style="color:${c}"></i>${l} <span class="text-xs font-normal text-slate-400">(${C[k].list.length})</span></div><b>${fmt(sum(C[k].list, C[k].amt))}</b></div>
      ${C[k].list.length ? C[k].list.map(C[k].html).join('') : empty(ic, 'No records in this period')}</div>`).join('');
    b.innerHTML = `<div class="grid grid-cols-2 lg:grid-cols-3 gap-4">${kpis}</div>${cards}`;
  }
};

// ---------------- Reports ----------------
PAGES['reports'] = {
  title: 'Reports', sub: 'Income, expenses and orders summary by date',
  render() {
    const first = thisMonth() + '-01';
    return `<div class="max-w-5xl mx-auto space-y-5"><div class="card p-4 flex flex-wrap gap-3 items-end">
      <div><label class="lbl">From Date</label><input id="rp-from" type="date" class="inp" value="${first}" onchange="PAGES.reports.update()"></div>
      <div><label class="lbl">To Date</label><input id="rp-to" type="date" class="inp" value="${todayStr()}" onchange="PAGES.reports.update()"></div>
      <button class="btn btn-ghost" onclick="window.print()"><i class="fas fa-print"></i> Print</button></div>
      <div id="rp-body" class="space-y-5"></div></div>`;
  },
  mount() { this.update(); },
  update() {
    const el = $('rp-body'); if (!el) return; const f = $('rp-from').value, t = $('rp-to').value;
    const inR = d => d && d >= f && d <= t;
    const O = S.orders.filter(o => inR(o.orderDate));
    const sales = sum(O, o => o.total), adv = sum(O, o => o.advance), dueNew = sum(O, o => o.due);
    const collected = sum(S.txs.filter(x => x.type === 'payment' && inR(x.date)), x => x.amount);
    const dSale = sum(S.daily.filter(r => r.type === 'sale' && inR(r.date)), r => r.amount);
    const exp = sum(S.daily.filter(r => r.type === 'expense' && inR(r.date)), r => r.amount);
    const sal = sum(S.salaryPays.filter(p => inR(p.date)), p => p.amount);
    const income = adv + collected + dSale, out = exp + sal;
    const byStaff = {}; O.forEach(o => { (byStaff[o.staffName] ||= { n: 0, t: 0 }); byStaff[o.staffName].n++; byStaff[o.staffName].t += o.total; });
    const byProd = {}; O.forEach(o => o.items.forEach(i => { (byProd[i.product] ||= { n: 0, t: 0 }); byProd[i.product].n++; byProd[i.product].t += i.price; }));
    const tb = (obj, h) => `<table class="tbl"><thead><tr><th>${h}</th><th>Orders/Items</th><th>Total</th></tr></thead><tbody>${Object.entries(obj).sort((a, b) => b[1].t - a[1].t).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${bn(v.n)}</td><td>${fmt(v.t)}</td></tr>`).join('') || `<tr><td colspan="3" class="text-slate-400">No data</td></tr>`}</tbody></table>`;
    el.innerHTML = `<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">${kpi('Number of Orders', bn(O.length), 'fa-file-invoice', '#2563EB')}${kpi('Total Order Sales', fmt(sales), 'fa-sack-dollar', '#16A34A')}${kpi('New Due Created', fmt(dueNew), 'fa-hand-holding-dollar', '#DC2626')}${kpi('Due Collected', fmt(collected), 'fa-circle-check', '#0891B2')}</div>
      <div class="card p-5"><div class="font-bold mb-3">Cash Income & Expenses (approx.)</div><div class="grid sm:grid-cols-2 gap-6 text-sm">
        <div class="space-y-2"><div class="flex justify-between"><span>Order Advances</span><b>${fmt(adv)}</b></div><div class="flex justify-between"><span>Due Collected</span><b>${fmt(collected)}</b></div><div class="flex justify-between"><span>Daily Sales</span><b>${fmt(dSale)}</b></div><div class="flex justify-between border-t pt-2"><span>Total Income</span><b class="text-green-700">${fmt(income)}</b></div></div>
        <div class="space-y-2"><div class="flex justify-between"><span>Daily Expenses</span><b>${fmt(exp)}</b></div><div class="flex justify-between"><span>Staff Salary/Advance</span><b>${fmt(sal)}</b></div><div class="flex justify-between border-t pt-2"><span>Total Expenses</span><b class="text-rose-700">${fmt(out)}</b></div></div></div>
        <div class="mt-4 p-4 rounded-xl ${income - out >= 0 ? 'bg-green-50 text-green-800' : 'bg-rose-50 text-rose-800'} flex justify-between text-lg"><span>${income - out >= 0 ? 'Profit' : 'Loss'}</span><b>${fmt(Math.abs(income - out))}</b></div></div>
      <div class="grid md:grid-cols-2 gap-5"><div class="card p-4"><div class="font-bold mb-2">Orders by Staff</div>${tb(byStaff, 'Staff')}</div><div class="card p-4"><div class="font-bold mb-2">Sales by Product</div>${tb(byProd, 'Product')}</div></div>`;
  }
};
