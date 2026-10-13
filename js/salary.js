// ============================================================
//  salary.js — Employee salary and money-taken records (admin only)
//  Salary − money taken = remaining salary
// ============================================================
let salMonth = thisMonth();

function salaryFor(emp, ym) {
  let amt = 0;
  [...(emp.salaryHistory || [])].sort((a, b) => a.from.localeCompare(b.from)).forEach(h => { if (h.from <= ym) amt = h.amount; });
  return amt;
}
const paysOf = id => S.salaryPays.filter(p => p.employeeId === id);
// Total salary earned up to month ym
function earnedUpTo(emp, ym) { return sum(monthsRange(emp.joinMonth, ym), m => salaryFor(emp, m)); }
function takenUpTo(emp, ym) { return sum(paysOf(emp.id).filter(p => p.forMonth <= ym), p => p.amount); }
function salaryRow(emp, ym) {
  const salary = salaryFor(emp, ym);
  const pm = prevMonth(ym);
  const carry = emp.joinMonth <= pm ? earnedUpTo(emp, pm) - takenUpTo(emp, pm) : 0;
  const taken = sum(paysOf(emp.id).filter(p => p.forMonth === ym), p => p.amount);
  return { salary, carry, taken, balance: carry + salary - taken };
}

PAGES['salary'] = {
  title: 'Salary Management', sub: 'Employee salary, money taken and remaining salary',
  render() {
    return `<div class="max-w-7xl mx-auto space-y-5">
      <div class="card p-4 flex flex-wrap items-center gap-3">
        <button class="btn btn-ghost btn-sm" onclick="salMonth=prevMonth(salMonth);PAGES.salary.update()"><i class="fas fa-chevron-left"></i></button>
        <input id="sal-month" type="month" class="inp !w-auto font-semibold" value="${salMonth}" onchange="salMonth=this.value||thisMonth();PAGES.salary.update()">
        <button class="btn btn-ghost btn-sm" onclick="salMonth=nextMonth(salMonth);PAGES.salary.update()"><i class="fas fa-chevron-right"></i></button>
        <div id="sal-label" class="font-bold text-slate-700"></div>
        <div class="flex-1"></div>
        <button class="btn btn-primary" onclick="employeeForm()"><i class="fas fa-user-plus"></i> Add Employee</button>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" id="sal-kpis"></div>
      <div class="card p-4"><div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Employee</th><th>Monthly Salary</th><th>Carry Forward</th><th>Taken This Month</th><th>Remaining Salary</th><th></th></tr></thead><tbody id="sal-body"></tbody></table></div></div>
      <div class="text-xs text-slate-500 px-1">Note: "Carry Forward" = salary from previous months that is still unpaid (negative if more advance was taken). Remaining Salary = Carry Forward + this month's salary − money taken this month.</div></div>`;
  },
  mount() { this.update(); },
  update() {
    const b = $('sal-body'); if (!b) return; const ym = salMonth;
    $('sal-month').value = ym; $('sal-label').textContent = monthLabel(ym);
    const emps = S.employees;
    const rows = emps.map(e => ({ e, ...salaryRow(e, ym) }));
    $('sal-kpis').innerHTML = kpi('Employees', bn(emps.length), 'fa-users', '#2563EB') + kpi('Total Salary This Month', fmt(sum(rows, r => r.salary)), 'fa-money-bill-wave', '#16A34A') +
      kpi('Taken This Month', fmt(sum(rows, r => r.taken)), 'fa-hand-holding-dollar', '#DB2777') + kpi('Total Remaining Salary', fmt(sum(rows, r => r.balance)), 'fa-scale-balanced', '#D97706');
    b.innerHTML = rows.length ? rows.map(({ e, salary, carry, taken, balance }) => `<tr>
      <td><div class="font-semibold">${esc(e.name)}</div><div class="text-xs text-slate-400">${esc(e.designation || '')}${e.phone ? ' • ' + bn(esc(e.phone)) : ''}</div></td>
      <td>${e.joinMonth > ym ? '<span class="text-xs text-slate-400">Not joined yet</span>' : fmt(salary)}</td>
      <td class="${carry < 0 ? 'text-rose-600' : ''}">${fmt(carry)}</td>
      <td class="text-pink-600 font-semibold">${fmt(taken)}</td>
      <td><b class="${balance < 0 ? 'text-rose-600' : balance === 0 ? 'text-green-600' : 'text-slate-800'}">${fmt(Math.abs(balance))}</b>${balance < 0 ? '<div class="text-xs text-rose-500">Overdrawn</div>' : balance === 0 ? '<div class="text-xs text-green-600">Settled</div>' : ''}</td>
      <td class="whitespace-nowrap"><button class="btn btn-primary btn-sm" onclick="payForm('${e.id}')"><i class="fas fa-plus"></i> Add Payment</button>
        <button class="btn btn-ghost btn-sm" onclick="empDetail('${e.id}')" title="Details / history"><i class="fas fa-list"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="employeeForm('${e.id}')" title="Edit"><i class="fas fa-pen"></i></button></td></tr>`).join('')
      : `<tr><td colspan="6">${empty('fa-user-tie', 'No employees yet. Click "Add Employee".')}</td></tr>`;
  }
};

function employeeForm(id) {
  const e = id ? S.employees.find(x => x.id === id) : null;
  openModal(`${modalHead(e ? 'Edit Employee' : 'Add New Employee')}<div class="p-5 space-y-3">
    <div><label class="lbl">Name *</label><input id="em-name" class="inp" value="${esc(e?.name || '')}"></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Designation / Role</label><input id="em-desg" class="inp" placeholder="e.g. Designer" value="${esc(e?.designation || '')}"></div>
      <div><label class="lbl">Mobile</label><input id="em-phone" class="inp" value="${esc(e?.phone || '')}"></div></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Monthly Salary (৳) *</label><input id="em-sal" type="number" min="0" class="inp" value="${e ? salaryFor(e, thisMonth()) || '' : ''}"></div>
      <div><label class="lbl">${e ? 'New salary effective from' : 'Joining month'}</label><input id="em-month" type="month" class="inp" value="${e ? thisMonth() : thisMonth()}" ${e ? '' : ''}></div></div>
    ${e ? '<div class="text-xs text-slate-500">If you change the salary, the new amount applies from the selected month; earlier months stay unchanged.</div>' : ''}
    <div class="flex gap-2 pt-2"><button id="em-btn" class="btn btn-primary flex-1" onclick="saveEmployee('${id || ''}')">Save</button>${e ? `<button class="btn btn-danger" onclick="deleteEmployee('${id}')"><i class="fas fa-trash"></i></button>` : ''}</div></div>`);
}
async function saveEmployee(id) {
  const name = $('em-name').value.trim(), sal = num($('em-sal').value), month = $('em-month').value;
  if (!name) return toast('Enter name', 'error'); if (!(sal >= 0) || $('em-sal').value === '') return toast('Enter salary amount', 'error'); if (!month) return toast('Select a month', 'error');
  const base = { name, designation: $('em-desg').value.trim(), phone: en($('em-phone').value).trim() };
  busy('em-btn', true);
  try {
    if (id) {
      const e = S.employees.find(x => x.id === id); const hist = [...(e.salaryHistory || [])];
      if (salaryFor(e, month) !== sal) { const i = hist.findIndex(h => h.from === month); if (i >= 0) hist[i].amount = sal; else hist.push({ from: month, amount: sal }); }
      await col('employees').doc(id).update({ ...base, salaryHistory: hist });
    } else await col('employees').add({ ...base, joinMonth: month, salaryHistory: [{ from: month, amount: sal }], createdAt: FV.serverTimestamp() });
    toast('Saved'); closeModal();
  } catch (e) { toast(e.message, 'error'); busy('em-btn', false); }
}
async function deleteEmployee(id) {
  const e = S.employees.find(x => x.id === id); if (!confirm(`Delete ${e.name} and all their salary records?`)) return;
  try { const b = db.batch(); paysOf(id).forEach(p => b.delete(col('salary_payments').doc(p.id))); b.delete(col('employees').doc(id)); await b.commit(); closeModal(); toast('Deleted', 'info'); } catch (er) { toast(er.message, 'error'); }
}

function payForm(id) {
  const e = S.employees.find(x => x.id === id); const r = salaryRow(e, salMonth);
  openModal(`${modalHead('Record Payment', `${esc(e.name)} • ${monthLabel(salMonth)}`)}<div class="p-5 space-y-3">
    <div class="grid grid-cols-3 gap-2 text-center text-sm"><div class="rounded-lg bg-slate-50 p-2"><div class="text-xs text-slate-500">Salary</div><b>${fmt(r.salary)}</b></div><div class="rounded-lg bg-pink-50 p-2"><div class="text-xs text-slate-500">Taken</div><b>${fmt(r.taken)}</b></div><div class="rounded-lg bg-amber-50 p-2"><div class="text-xs text-slate-500">Remaining</div><b>${fmt(r.balance)}</b></div></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Date</label><input id="py-date" type="date" class="inp" value="${todayStr()}"></div>
      <div><label class="lbl">Deduct from month</label><input id="py-month" type="month" class="inp" value="${salMonth}"></div></div>
    <div><label class="lbl">Amount Taken (৳) *</label><input id="py-amt" type="number" min="0" class="inp text-lg font-semibold" autofocus></div>
    <div><label class="lbl">Type</label><select id="py-type" class="inp"><option value="advance">Advance / Pocket money</option><option value="salary">Salary payment</option></select></div>
    <div><label class="lbl">Note</label><input id="py-note" class="inp" placeholder="Optional"></div>
    <div class="text-xs text-slate-500">This amount will be deducted from salary automatically.</div>
    <button id="py-btn" class="btn btn-primary w-full" onclick="savePay('${id}')"><i class="fas fa-check"></i> Save</button></div>`);
}
async function savePay(id) {
  const e = S.employees.find(x => x.id === id); const amount = num($('py-amt').value), date = $('py-date').value, forMonth = $('py-month').value;
  if (!(amount > 0) || !date || !forMonth) return toast('Enter date, month and a valid amount', 'error');
  const r = salaryRow(e, forMonth);
  if (amount > r.balance && !confirm(`This amount is more than the remaining salary (${fmt(r.balance)}). Save anyway?`)) return;
  busy('py-btn', true);
  try { await col('salary_payments').add({ employeeId: id, employeeName: e.name, amount, date, forMonth, type: $('py-type').value, note: $('py-note').value.trim(), createdBy: S.user.name, createdAt: FV.serverTimestamp() }); toast('Saved — deducted from salary'); closeModal(); }
  catch (er) { toast(er.message, 'error'); busy('py-btn', false); }
}
async function deletePay(id, empId) {
  if (!confirm('Delete this entry? Remaining salary will be recalculated.')) return;
  try { await col('salary_payments').doc(id).delete(); toast('Deleted', 'info'); setTimeout(() => empDetail(empId), 300); } catch (e) { toast(e.message, 'error'); }
}
function empDetail(id) {
  const e = S.employees.find(x => x.id === id); const months = monthsRange(e.joinMonth, thisMonth() > salMonth ? thisMonth() : salMonth).reverse();
  const mrows = months.map(m => { const r = salaryRow(e, m); return `<tr><td>${monthLabel(m)}</td><td>${fmt(r.salary)}</td><td>${fmt(r.taken)}</td><td class="${r.balance < 0 ? 'text-rose-600' : ''} font-semibold">${fmt(r.balance)}</td></tr>`; }).join('');
  const pays = paysOf(id).sort((a, b) => b.date.localeCompare(a.date));
  openModal(`${modalHead(esc(e.name), esc(e.designation || 'Employee'))}<div class="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
    <div><div class="font-bold mb-2">Month-wise Summary</div><div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Month</th><th>Salary</th><th>Taken</th><th>Remaining (incl. carry)</th></tr></thead><tbody>${mrows}</tbody></table></div></div>
    <div><div class="font-bold mb-2">Payment History</div>${pays.length ? pays.map(p => `<div class="flex items-center gap-3 py-2 border-b border-slate-100"><div class="flex-1"><div class="text-sm font-medium">${fmtDate(p.date)} <span class="badge bg-slate-100 text-slate-600">${p.type === 'advance' ? 'Advance' : 'Salary'}</span></div><div class="text-xs text-slate-400">${monthLabel(p.forMonth)}${p.note ? ' • ' + esc(p.note) : ''}</div></div><b class="text-pink-600">${fmt(p.amount)}</b><button class="btn btn-danger btn-sm" onclick="deletePay('${p.id}','${id}')"><i class="fas fa-trash"></i></button></div>`).join('') : empty('fa-receipt', 'No entries')}</div></div>
    <div class="p-4 border-t border-slate-100 flex justify-end gap-2"><button class="btn btn-ghost" onclick="closeModal()">Close</button><button class="btn btn-ok" onclick="printSlip('${id}')"><i class="fas fa-print"></i> Print ${monthLabel(salMonth)} Slip</button></div>`, true);
}
function printSlip(id) {
  const e = S.employees.find(x => x.id === id); const r = salaryRow(e, salMonth); const pays = paysOf(id).filter(p => p.forMonth === salMonth).sort((a, b) => a.date.localeCompare(b.date));
  printHTML(`<div class="memo"><div class="memo-head"><h1>${esc(BUSINESS.name)}</h1><div>Salary Slip — ${monthLabel(salMonth)}</div></div>
    <div style="margin-bottom:10px"><b>Name:</b> ${esc(e.name)} &nbsp; <b>Designation:</b> ${esc(e.designation || '—')}</div>
    <table><thead><tr><th>Date</th><th>Type / Note</th><th class="r">Amount</th></tr></thead><tbody>${pays.map(p => `<tr><td>${fmtDate(p.date)}</td><td>${p.type === 'advance' ? 'Advance' : 'Salary'} ${esc(p.note || '')}</td><td class="r">${fmt(p.amount)}</td></tr>`).join('') || '<tr><td colspan="3">No money taken this month</td></tr>'}</tbody>
    <tfoot><tr><td colspan="2" class="r">Monthly Salary</td><td class="r">${fmt(r.salary)}</td></tr><tr><td colspan="2" class="r">Carry Forward</td><td class="r">${fmt(r.carry)}</td></tr><tr><td colspan="2" class="r">Total Taken</td><td class="r">${fmt(r.taken)}</td></tr><tr><td colspan="2" class="r"><b>Remaining Salary</b></td><td class="r"><b>${fmt(r.balance)}</b></td></tr></tfoot></table>
    <div class="memo-sign"><div>Employee's Signature</div><div>Authorized Signature</div></div></div>`);
}
