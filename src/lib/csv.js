import { num } from './model.js';

const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function csvText(rows) {
  return rows.map(r => r.map(q).join(',')).join('\n');
}

export function membersCsv(store) {
  const rows = [['code', 'name', 'phone', 'whatsapp', 'cnic', 'plan', 'fee', 'join', 'status']];
  for (const m of store.members || []) {
    const p = (store.plans || []).find(x => x.id === m.plan_id);
    rows.push([m.code || '', m.name, m.phone || '', m.whatsapp || '', m.cnic || '', p?.name || '', m.fee || 0, m.join || '', m.status || 'active']);
  }
  return csvText(rows);
}

export function parseMembersCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const errors = [], rows = [];
  const start = /name/i.test(lines[0] || '') ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
    const [code, name, phone, whatsapp, cnic, planName, fee, join] = cells;
    if (!name) { errors.push(`Row ${i + 1}: name missing — skipped`); continue; }
    rows.push({ code, name, phone, whatsapp, cnic, planName, fee: num(fee), join });
  }
  return { rows, errors };
}
