// Gymory document model — offline gym/fitness center register:
// members → membership plans → monthly fee bills, receipts, check-ins,
// trainers, body measurements, expenses.
// Same ledger rules as the rest of the family: gap-free bill/receipt
// numbers, voided rows kept (never deleted), a paid bill is never
// rewritten — arrears roll into the NEXT bill.

export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 10);
export const fmt = (n, cur = 'Rs') => `${cur} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const today = () => new Date().toISOString().slice(0, 10);
export const nowTime = () => new Date().toTimeString().slice(0, 5);
export const ym = iso => (iso || '').slice(0, 7);
export const addMonths = (m, k) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export const ROLES = {
  owner: 'Owner — full access',
  manager: 'Manager — bills, receipts & members, no user management',
  collector: 'Collector — receive fees & mark check-ins only',
  clerk: 'Clerk — member records only'
};

export function emptyStore() {
  return {
    version: 1,
    members: [],      // {id, code, name, father, phone, whatsapp, cnic, join, plan_id, trainer_id, fee, status:'active'|'frozen'|'left', left_on, emergency, note, measurements:[{date,weight,chest,waist,arms,hips,note}]}
    plans: [],        // {id, name, months, fee, admission, active}
    trainers: [],     // {id, name, phone, share}
    bills: [],        // {id, no, member_id, month, issued_on, lines:[{name,amount}], arrears, total, due_date, status:'unpaid'|'partial'|'paid'|'void', void_reason}
    receipts: [],     // {id, no, member_id, bill_id|null, date, amount, mode, ref, status:'received'|'void', void_reason, voided_on, by}
    checkins: [],     // {id, member_id, date, time}
    expenses: [],     // {id, date, head, amount, note, by}
    auditLog: [],
    settings: defaultSettings(),
    counters: { bill: 0, receipt: 0, member: 0 },
    updatedAt: Date.now()
  };
}

export function defaultSettings() {
  return {
    companyName: '', companyAddress: '', companyPhone: '',
    currency: 'Rs',
    dueDay: 10,
    lateFee: 0,
    receiptFooter: 'Barah-e-karam receipt sambhal kar rakhein.',
    letterheadOffset: 0,
    users: [],
    backupFolder: '', lastBackupAt: '',
    syncFolder: '', syncAuto: true, syncCode: '', hostOn: false,
    uiUrdu: false, printUrdu: true,
    firstRunDone: false, consent: null
  };
}

// ---------- lookups ----------
export const plan = (s, id) => (s.plans || []).find(p => p.id === id) || null;
export const member = (s, id) => (s.members || []).find(m => m.id === id) || null;
export const trainer = (s, id) => (s.trainers || []).find(t => t.id === id) || null;
export const bill = (s, id) => (s.bills || []).find(b => b.id === id) || null;
export const activeMembers = s => (s.members || []).filter(m => m.status === 'active');
export const memberLabel = (s, m) => m ? `${m.code ? m.code + ' · ' : ''}${m.name}` : '';

// ---------- money flows ----------
export function receiptsFor(s, memberId) { return (s.receipts || []).filter(r => r.member_id === memberId && r.status !== 'void'); }
export function billsFor(s, memberId) { return (s.bills || []).filter(b => b.member_id === memberId && b.status !== 'void'); }

export function billPaid(s, b) {
  return receiptsFor(s, b.member_id).filter(r => r.bill_id === b.id).reduce((t, r) => t + num(r.amount), 0);
}
export function billOutstanding(s, b) {
  if (b.status === 'void') return 0;
  return Math.max(0, num(b.total) - billPaid(s, b));
}
export function refreshBillStatus(b, paid) {
  if (b.status === 'void') return b;
  b.status = paid <= 0 ? 'unpaid' : paid >= num(b.total) ? 'paid' : 'partial';
  return b;
}

export function memberArrears(s, memberId, beforeMonth) {
  return billsFor(s, memberId)
    .filter(b => b.month < beforeMonth)
    .reduce((t, b) => t + billOutstanding(s, b), 0);
}

export function memberOwes(s, memberId) {
  return billsFor(s, memberId).reduce((x, b) => x + billOutstanding(s, b), 0);
}

// membership expiry: join + plan months (or last paid month) — shows pending
export function memberExpiry(s, m) {
  const p = plan(s, m.plan_id);
  const months = num(m.plan_months || p?.months || 1);
  const base = m.renewed_on || m.join;
  if (!base) return '';
  const d = new Date(base); d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ---------- month-end: generate fee bills ----------
export function generateMonthBills(store, month) {
  const made = [], skipped = [];
  for (const m of activeMembers(store)) {
    if ((store.bills || []).some(b => b.member_id === m.id && b.month === month && b.status !== 'void')) {
      skipped.push(m.name); continue;
    }
    const p = plan(store, m.plan_id);
    const arrears = memberArrears(store, m.id, month);
    const lines = [{ name: `Fee ${month} — ${p?.name || 'membership'}`, amount: num(m.fee ?? p?.fee) }];
    if (arrears > 0 && num(store.settings.lateFee) > 0) lines.push({ name: 'Late fee', amount: num(store.settings.lateFee) });
    const total = lines.reduce((x, l) => x + num(l.amount), 0) + arrears;
    store.counters.bill = (store.counters.bill || 0) + 1;
    const b = {
      id: uid('b'), no: store.counters.bill, member_id: m.id, month,
      issued_on: today(), lines, arrears, total,
      due_date: `${month}-${String(store.settings.dueDay || 10).padStart(2, '0')}`,
      status: 'unpaid'
    };
    store.bills.push(b); made.push(b);
  }
  return { made, skipped };
}

export function receivePayment(store, { member_id, bill_id, amount, mode, ref, date }, by) {
  store.counters.receipt = (store.counters.receipt || 0) + 1;
  const r = {
    id: uid('r'), no: store.counters.receipt, member_id, bill_id: bill_id || null,
    date: date || today(), amount: num(amount), mode: mode || 'cash', ref: ref || '',
    status: 'received', by: by || ''
  };
  store.receipts.push(r);
  if (bill_id) { const b = bill(store, bill_id); if (b) refreshBillStatus(b, billPaid(store, b)); }
  return r;
}

export function voidReceipt(store, receiptId, reason) {
  const r = (store.receipts || []).find(x => x.id === receiptId);
  if (!r || r.status === 'void') return null;
  r.status = 'void'; r.void_reason = reason || ''; r.voided_on = today();
  if (r.bill_id) { const b = bill(store, r.bill_id); if (b) refreshBillStatus(b, billPaid(store, b)); }
  return r;
}

export function voidBill(store, billId, reason) {
  const b = bill(store, billId);
  if (!b || b.status === 'void' || billPaid(store, b) > 0) return null;
  b.status = 'void'; b.void_reason = reason || '';
  return b;
}

// ---------- check-ins ----------
export function checkinsOn(s, date) { return (s.checkins || []).filter(c => c.date === date); }
export function hasCheckedIn(s, memberId, date) { return checkinsOn(s, date).some(c => c.member_id === memberId); }
export function memberCheckins(s, memberId, month) { return (s.checkins || []).filter(c => c.member_id === memberId && ym(c.date) === month).length; }

// ---------- reports ----------
export function monthSummary(store, month) {
  const bills = (store.bills || []).filter(b => b.month === month && b.status !== 'void');
  const receipts = (store.receipts || []).filter(r => ym(r.date) === month && r.status !== 'void');
  const expenses = (store.expenses || []).filter(e => ym(e.date) === month);
  return {
    billed: bills.reduce((t, b) => t + num(b.total), 0),
    collected: receipts.reduce((t, r) => t + num(r.amount), 0),
    expenses: expenses.reduce((t, e) => t + num(e.amount), 0),
    billCount: bills.length
  };
}

export function defaulters(store, asOfMonth) {
  const out = [];
  for (const m of activeMembers(store)) {
    const owes = billsFor(store, m.id).filter(b => b.month <= asOfMonth).reduce((x, b) => x + billOutstanding(store, b), 0);
    if (owes > 0) out.push({ member: m, owes, oldest: billsFor(store, m.id).find(b => billOutstanding(store, b) > 0)?.month || '' });
  }
  return out.sort((a, b) => b.owes - a.owes);
}

export function waLink(phone, text) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  const intl = d.startsWith('92') ? d : d.startsWith('0') ? '92' + d.slice(1) : d;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

// ---------- sample data ----------
export function sampleStore() {
  const s = emptyStore();
  s.settings.companyName = 'Fitness First Gym';
  s.settings.companyAddress = 'Main Bazaar, Gujranwala';
  s.settings.companyPhone = '055-5550100';
  s.plans = [
    { id: 'pl1', name: 'Monthly', months: 1, fee: 3000, admission: 1000, active: true },
    { id: 'pl2', name: 'Quarterly', months: 3, fee: 8000, admission: 1000, active: true },
    { id: 'pl3', name: 'Half-yearly', months: 6, fee: 15000, admission: 0, active: true }
  ];
  s.trainers = [
    { id: 'tr1', name: 'Coach Nadeem', phone: '0300-1234567', share: 0 },
    { id: 'tr2', name: 'Coach Sana', phone: '0321-7654321', share: 0 }
  ];
  const mem = (id, code, name, phone, planId, fee, join, status = 'active') => ({
    id, code, name, father: '', phone, whatsapp: phone, cnic: '', join,
    plan_id: planId, trainer_id: '', fee, status, left_on: '', emergency: '', note: '',
    measurements: [{ date: join, weight: 78, chest: 40, waist: 34, arms: 13, hips: 38, note: 'starting' }]
  });
  s.members = [
    { ...mem('m1', 'G-001', 'Ali Raza', '0300-1112233', 'pl1', 3000, '2025-08-01'), trainer_id: 'tr1' },
    { ...mem('m2', 'G-002', 'Usman Tariq', '0321-5556677', 'pl1', 3000, '2025-11-15'), trainer_id: 'tr1' },
    { ...mem('m3', 'G-003', 'Fatima Noor', '0333-8889900', 'pl2', 8000, '2026-01-05'), trainer_id: 'tr2' },
    { ...mem('m4', 'G-004', 'Bilal Hussain', '0345-7778889', 'pl1', 3000, '2026-02-10'), trainer_id: 'tr2' },
    mem('m5', 'G-005', 'Hamza Sheikh', '0301-9990011', 'pl3', 15000, '2026-03-01')
  ];
  s.counters.member = 5;
  const m0 = addMonths(today().slice(0, 7), -1);
  const m1 = today().slice(0, 7);
  const mkBill = (memId, month, no, fee, arrears, status) => {
    const b = { id: uid('b'), no, member_id: memId, month, issued_on: month + '-01', lines: [{ name: `Fee ${month}`, amount: fee }], arrears, total: fee + arrears, due_date: month + '-10', status };
    s.bills.push(b); return b;
  };
  let n = 0;
  const b1 = mkBill('m1', m0, ++n, 3000, 0, 'paid');
  const b2 = mkBill('m2', m0, ++n, 3000, 0, 'partial');
  const b3 = mkBill('m3', m0, ++n, 8000, 0, 'paid');
  const b4 = mkBill('m4', m0, ++n, 3000, 0, 'paid');
  const b5 = mkBill('m5', m0, ++n, 15000, 0, 'paid');
  s.counters.bill = n;
  const rc = (mem, bill_, amt, date, mode) => { s.counters.receipt++; s.receipts.push({ id: uid('r'), no: s.counters.receipt, member_id: mem, bill_id: bill_, date, amount: amt, mode: mode || 'cash', ref: '', status: 'received', by: 'owner' }); };
  rc('m1', b1.id, 3000, m0 + '-05'); rc('m2', b2.id, 2000, m0 + '-07');
  rc('m3', b3.id, 8000, m0 + '-03', 'online'); rc('m4', b4.id, 3000, m0 + '-04'); rc('m5', b5.id, 15000, m0 + '-02');
  mkBill('m1', m1, ++n, 3000, 0, 'paid'); rc('m1', s.bills[s.bills.length - 1].id, 3000, m1 + '-04');
  mkBill('m2', m1, ++n, 3000, 1000, 'unpaid');
  mkBill('m4', m1, ++n, 3000, 0, 'unpaid');
  s.counters.bill = n; // m3/m5 paid upfront on quarterly/half-yearly plans
  // a few check-ins today + yesterday
  const ck = (memId, d, t) => s.checkins.push({ id: uid('c'), member_id: memId, date: d, time: t });
  ck('m1', today(), '07:12'); ck('m3', today(), '07:40'); ck('m4', today(), '18:05');
  ck('m1', addMonths(today(), 0) === today() ? today() : today(), '07:10');
  s.expenses = [{ id: uid('e'), date: m0 + '-12', head: 'Equipment repair — treadmill', amount: 6500, note: '', by: 'owner' }];
  s.settings.firstRunDone = false;
  return s;
}
