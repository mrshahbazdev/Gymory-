// Print HTML: fee bill (A5), payment receipt (A5), member statement,
// defaulter list, monthly collection register, attendance register (A4).
import { fmt, num, member, plan, billPaid, billOutstanding, ym } from './model.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const monthName = m => { const d = new Date(m + '-01'); return d.toLocaleString('en', { month: 'long', year: 'numeric' }); };
const baseCss = extra => `
  body{font:10pt 'Segoe UI',sans-serif;color:#111}
  .co-name{font-size:13pt;font-weight:700;text-align:center}
  .co-sub{text-align:center;font-size:8.5pt;color:#444;margin-bottom:5mm}
  table{width:100%;border-collapse:collapse} td{padding:1.8mm;border-bottom:1px solid #e2e8f0}
  .r{text-align:right}.big{font-size:12pt;font-weight:700}
  .sign{display:flex;justify-content:space-between;margin:14mm 2mm 0;font-size:8pt;color:#444}
  .sign span{border-top:1px solid #555;padding-top:1mm;min-width:26mm;text-align:center}
  .foot{margin-top:8mm;text-align:center;font-size:8pt;color:#666}
  .ur{direction:rtl;font-family:'Jameel Noori Nastaleeq','Urdu Typesetting',serif}
  ${extra || ''}`;
const head = (store, label) => {
  const s = store.settings;
  return `<div class="co-name">${esc(s.companyName || 'Gym')}</div>
    <div class="co-sub" style="padding-top:${num(s.letterheadOffset)}mm">${esc(s.companyAddress || '')} ${s.companyPhone ? ' · ' + esc(s.companyPhone) : ''}</div>
    <div style="text-align:center;font-weight:600;margin-bottom:4mm">${esc(label)}</div>`;
};
const foot = store => `<div class="foot">${esc(store.settings.receiptFooter || '')}</div>`;
const doc = (title, css, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${baseCss(css)}</style></head><body>${body}</body></html>`;

export function billHtml(store, b) {
  const m = member(store, b.member_id) || {};
  const paid = billPaid(store, b), out = billOutstanding(store, b);
  const rows = (b.lines || []).map(l => `<tr><td>${esc(l.name)}</td><td class="r">${num(l.amount).toLocaleString()}</td></tr>`).join('');
  return doc(`Fee bill #${b.no}`, '', `${head(store, 'Fee Bill — ' + monthName(b.month))}
    <table>
      <tr><td><b>Bill #${b.no}</b></td><td class="r">Issued: ${esc(b.issued_on)} · Due: ${esc(b.due_date)}</td></tr>
      <tr><td colspan="2">Member: <b>${esc(m.name)}</b> ${m.code ? '(' + esc(m.code) + ')' : ''} ${m.phone ? '· ' + esc(m.phone) : ''}</td></tr>
    </table>
    <table style="margin-top:4mm">
      ${rows}
      ${num(b.arrears) ? `<tr><td>Previous arrears</td><td class="r">${num(b.arrears).toLocaleString()}</td></tr>` : ''}
      <tr><td><b>Total</b></td><td class="r big">${fmt(b.total, store.settings.currency)}</td></tr>
      <tr><td>Paid</td><td class="r">${paid.toLocaleString()}</td></tr>
      <tr><td><b>Balance</b></td><td class="r"><b>${fmt(out, store.settings.currency)}</b></td></tr>
    </table>
    ${out === 0 ? '<div class="big" style="text-align:center;margin-top:6mm;color:#16a34a">PAID</div>' : ''}
    <div class="sign"><span>Member signature</span><span>Authorized</span></div>
    ${foot(store)}`);
}

export function receiptHtml(store, r) {
  const m = member(store, r.member_id) || {};
  const b = r.bill_id ? (store.bills || []).find(x => x.id === r.bill_id) : null;
  return doc(`Receipt #${r.no}`, '', `${head(store, 'Fee Receipt')}
    <table>
      <tr><td><b>Receipt #${r.no}</b>${r.status === 'void' ? ' — VOID' : ''}</td><td class="r">Date: ${esc(r.date)}</td></tr>
      <tr><td colspan="2">Received from: <b>${esc(m.name)}</b> ${m.code ? '(' + esc(m.code) + ')' : ''}</td></tr>
      <tr><td>${b ? 'Against bill #' + b.no + ' (' + monthName(b.month) + ')' : 'On account'}</td><td class="r">Mode: ${esc(r.mode)}${r.ref ? ' · ' + esc(r.ref) : ''}</td></tr>
      <tr><td><b>Amount</b></td><td class="r big">${fmt(r.amount, store.settings.currency)}</td></tr>
    </table>
    <div class="sign"><span>Received by: ${esc(r.by || '')}</span><span>Signature</span></div>
    ${foot(store)}`);
}

export function statementHtml(store, memberId) {
  const m = member(store, memberId) || {};
  const bills = (store.bills || []).filter(b => b.member_id === memberId);
  const receipts = (store.receipts || []).filter(r => r.member_id === memberId);
  const rows = bills.map(b => `<tr><td>${b.month}</td><td>Bill #${b.no}${b.status === 'void' ? ' (void)' : ''}</td>
    <td class="r">${num(b.total).toLocaleString()}</td><td class="r">${billPaid(store, b).toLocaleString()}</td>
    <td class="r">${billOutstanding(store, b).toLocaleString()}</td></tr>`).join('');
  const owes = bills.reduce((t, b) => t + billOutstanding(store, b), 0);
  return doc(`Statement — ${m.name}`, '', `${head(store, 'Member Statement')}
    <table><tr><td><b>${esc(m.name)}</b> ${m.code ? '(' + esc(m.code) + ')' : ''}</td><td class="r">${esc(m.phone || '')} · Plan: ${esc(plan(store, m.plan_id)?.name || '—')}</td></tr></table>
    <table style="margin-top:4mm"><tr><th style="text-align:left">Month</th><th style="text-align:left">Bill</th><th class="r">Billed</th><th class="r">Paid</th><th class="r">Due</th></tr>${rows}
    <tr><td colspan="4"><b>Total due</b></td><td class="r"><b>${fmt(owes, store.settings.currency)}</b></td></tr></table>
    <table style="margin-top:4mm"><tr><th style="text-align:left">Date</th><th style="text-align:left">Receipt</th><th class="r">Amount</th><th style="text-align:left">Mode</th></tr>
    ${receipts.map(r => `<tr><td>${r.date}</td><td>#${r.no}${r.status === 'void' ? ' (void)' : ''}</td><td class="r">${r.status === 'void' ? '—' : num(r.amount).toLocaleString()}</td><td>${esc(r.mode)}</td></tr>`).join('')}</table>
    ${foot(store)}`);
}

export function defaultersHtml(store, month, defs) {
  return doc(`Defaulters ${month}`, '', `${head(store, 'Defaulter List — ' + monthName(month))}
    <table><tr><th style="text-align:left">Member</th><th style="text-align:left">Phone</th><th style="text-align:left">Oldest unpaid</th><th class="r">Owes</th></tr>
    ${defs.map(d => `<tr><td>${esc(d.member.name)}${d.member.code ? ' (' + esc(d.member.code) + ')' : ''}</td><td>${esc(d.member.phone || '')}</td><td>${d.oldest}</td><td class="r">${fmt(d.owes, store.settings.currency)}</td></tr>`).join('')}
    ${!defs.length ? '<tr><td colspan="4">No defaulters.</td></tr>' : ''}</table>
    ${foot(store)}`);
}

export function collectionHtml(store, month) {
  const receipts = (store.receipts || []).filter(r => ym(r.date) === month).sort((a, b) => a.no - b.no);
  const tot = receipts.filter(r => r.status !== 'void').reduce((t, r) => t + num(r.amount), 0);
  return doc(`Collection ${month}`, '', `${head(store, 'Fee Collection Register — ' + monthName(month))}
    <table><tr><th>#</th><th style="text-align:left">Date</th><th style="text-align:left">Member</th><th style="text-align:left">Mode</th><th class="r">Amount</th><th style="text-align:left">By</th></tr>
    ${receipts.map(r => { const m = member(store, r.member_id) || {}; return `<tr${r.status === 'void' ? ' style="color:#999"' : ''}><td>${r.no}</td><td>${r.date}</td><td>${esc(m.name)}</td><td>${esc(r.mode)}</td><td class="r">${r.status === 'void' ? 'VOID' : num(r.amount).toLocaleString()}</td><td>${esc(r.by || '')}</td></tr>`; }).join('')}
    <tr><td colspan="4"><b>Total collected</b></td><td class="r"><b>${fmt(tot, store.settings.currency)}</b></td><td></td></tr></table>
    ${foot(store)}`);
}

export function attendanceHtml(store, month) {
  const days = new Date(month + '-01'); const dim = new Date(days.getFullYear(), days.getMonth() + 1, 0).getDate();
  const mems = (store.members || []).filter(m => m.status !== 'left');
  const headCells = [...Array(dim)].map((_, i) => `<th style="min-width:6mm">${i + 1}</th>`).join('');
  const rows = mems.map(m => {
    const set = new Set((store.checkins || []).filter(c => c.member_id === m.id && ym(c.date) === month).map(c => Number(c.date.slice(8, 10))));
    const cells = [...Array(dim)].map((_, i) => `<td style="text-align:center">${set.has(i + 1) ? '✓' : ''}</td>`).join('');
    return `<tr><td>${esc(m.name)}</td>${cells}<td class="r">${set.size}</td></tr>`;
  }).join('');
  return doc(`Attendance ${month}`, 'td,th{padding:0.8mm;font-size:7.5pt} th{text-align:center}', `${head(store, 'Attendance Register — ' + monthName(month))}
    <table><tr><th style="text-align:left">Member</th>${headCells}<th>Days</th></tr>${rows}</table>
    ${foot(store)}`);
}
