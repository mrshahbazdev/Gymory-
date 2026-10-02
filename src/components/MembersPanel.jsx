import React, { useState } from 'react';
import { uid, fmt, num, member, plan, trainer, memberOwes, memberExpiry, billsFor, billOutstanding, waLink, today } from '../lib/model.js';
import { statementHtml } from '../lib/prints.js';
import { parseMembersCsv } from '../lib/csv.js';

export default function MembersPanel({ store, update }) {
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);
  const [meas, setMeas] = useState(null); // member_id
  const [importRows, setImportRows] = useState(null);
  const [q, setQ] = useState('');
  const cur = store.settings.currency;

  const save = () => update(s => {
    if (edit.id) {
      const m = s.members.find(x => x.id === edit.id);
      Object.assign(m, edit);
    } else {
      s.counters.member = (s.counters.member || 0) + 1;
      const p = s.plans.find(x => x.id === edit.plan_id);
      s.members.push({ ...edit, id: uid('m'), code: `G-${String(s.counters.member).padStart(3, '0')}`, status: 'active', measurements: [] });
      // admission fee as first bill if plan has one
      if (num(p?.admission) > 0) {
        s.counters.bill++;
        s.bills.push({ id: uid('b'), no: s.counters.bill, member_id: s.members[s.members.length - 1].id, month: today().slice(0, 7), issued_on: today(), lines: [{ name: 'Admission fee', amount: num(p.admission) }], arrears: 0, total: num(p.admission), due_date: today(), status: 'unpaid' });
      }
    }
  }, 'save member');

  const leave = (m) => {
    if (!confirm(`${m.name} ko left/frozen mark karein?`)) return;
    update(s => { const x = s.members.find(z => z.id === m.id); x.status = 'left'; x.left_on = today(); }, 'member left');
  };

  const doImport = async () => {
    const f = await window.api.app.openFile({ filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }] });
    if (!f?.text) return;
    setImportRows(parseMembersCsv(f.text));
  };
  const applyImport = () => update(s => {
    for (const r of importRows.rows) {
      const p = (s.plans || []).find(x => x.name.toLowerCase() === String(r.planName || '').toLowerCase());
      s.counters.member = (s.counters.member || 0) + 1;
      s.members.push({ id: uid('m'), code: r.code || `G-${String(s.counters.member).padStart(3, '0')}`, name: r.name, phone: r.phone, whatsapp: r.whatsapp, cnic: r.cnic, plan_id: p?.id || '', trainer_id: '', fee: num(r.fee) || num(p?.fee), join: r.join || today(), status: 'active', measurements: [], emergency: '', note: '' });
    }
  }, `import ${importRows.rows.length} members`);

  const detail = open ? member(store, open) : null;
  const remind = (m) => {
    const owes = memberOwes(store, m.id);
    const url = waLink(m.whatsapp || m.phone, `Assalam-o-alaikum ${m.name}, aap ki ${store.settings.companyName || ''} fee outstanding ${fmt(owes, cur)} hai. Barah-e-karam jald ada karein. Shukriya.`);
    if (url) window.open(url, '_blank');
  };

  const list = (store.members || []).filter(m => !q || (m.name + ' ' + (m.code || '') + ' ' + (m.phone || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="panel">
      <h2 className="ptitle">Members — ممبرز</h2>
      <div className="frow" style={{ marginBottom: 10 }}>
        <input className="in" style={{ flex: 1 }} placeholder="Search name / code / phone" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn small ghost" onClick={() => setEdit({ plan_id: store.plans[0]?.id || '', name: '', phone: '', whatsapp: '', cnic: '', join: today(), fee: store.plans[0]?.fee || 0, trainer_id: '', emergency: '', note: '' })}>+ New member</button>
        <button className="btn small ghost" onClick={doImport}>Import CSV</button>
      </div>
      <table className="grid">
        <thead><tr><th>Code</th><th>Member</th><th>Plan</th><th>Phone</th><th>Expires</th><th className="r">Owes</th><th></th></tr></thead>
        <tbody>
          {list.map(m => {
            const owes = memberOwes(store, m.id);
            return (
              <tr key={m.id} className={m.status !== 'active' ? 'muted' : ''}>
                <td>{m.code}</td>
                <td><a href="#" onClick={e => { e.preventDefault(); setOpen(m.id); }}>{m.name}</a>{m.status !== 'active' ? ` (${m.status})` : ''}</td>
                <td>{plan(store, m.plan_id)?.name || '—'}</td><td>{m.phone}</td>
                <td>{memberExpiry(store, m) || '—'}</td>
                <td className="r" style={{ color: owes > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{owes ? fmt(owes, cur) : '✓'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small ghost" onClick={() => setMeas(m.id)}>Measure</button>
                  {m.status === 'active' && <>
                    <button className="btn small ghost" onClick={() => remind(m)}>WhatsApp</button>
                    <button className="btn small ghost" onClick={() => setEdit({ ...m })}>Edit</button>
                    <button className="btn small ghost" onClick={() => leave(m)}>Leave</button>
                  </>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {edit && (
        <div className="pcard" style={{ marginTop: 12 }}>
          <div className="frow">
            <input className="in" style={{ flex: 1 }} placeholder="Member name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            <input className="in" placeholder="Phone" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} />
            <input className="in" placeholder="WhatsApp" value={edit.whatsapp} onChange={e => setEdit({ ...edit, whatsapp: e.target.value })} />
          </div>
          <div className="frow" style={{ marginTop: 8 }}>
            <select className="in" value={edit.plan_id} onChange={e => { const p = store.plans.find(x => x.id === e.target.value); setEdit({ ...edit, plan_id: e.target.value, fee: edit.fee || p?.fee || 0 }); }}>
              <option value="">— plan —</option>
              {store.plans.map(p => <option key={p.id} value={p.id}>{p.name} ({num(p.fee).toLocaleString()})</option>)}
            </select>
            <select className="in" value={edit.trainer_id || ''} onChange={e => setEdit({ ...edit, trainer_id: e.target.value })}>
              <option value="">— trainer —</option>
              {(store.trainers || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="lbl">Monthly fee <input className="in" style={{ width: 110 }} type="number" value={edit.fee || ''} onChange={e => setEdit({ ...edit, fee: num(e.target.value) })} /></label>
            <label className="lbl">Joined <input className="in" type="date" value={edit.join || ''} onChange={e => setEdit({ ...edit, join: e.target.value })} /></label>
          </div>
          <div className="frow" style={{ marginTop: 8 }}>
            <input className="in" placeholder="CNIC" value={edit.cnic || ''} onChange={e => setEdit({ ...edit, cnic: e.target.value })} />
            <input className="in" placeholder="Emergency contact" value={edit.emergency || ''} onChange={e => setEdit({ ...edit, emergency: e.target.value })} />
            <input className="in" style={{ flex: 1 }} placeholder="Note" value={edit.note || ''} onChange={e => setEdit({ ...edit, note: e.target.value })} />
            <button className="btn small" onClick={() => { save(); setEdit(null); }}>Save</button>
            <button className="btn small ghost" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </div>
      )}

      {importRows && (
        <div className="pcard" style={{ marginTop: 12 }}>
          <b>{importRows.rows.length} members</b> parse hue — apply karein?
          {importRows.errors.map((e, i) => <div key={i} style={{ color: '#b45309', fontSize: 12 }}>⚠ {e}</div>)}
          <div className="frow" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={() => { applyImport(); setImportRows(null); }}>Apply import</button>
            <button className="btn small ghost" onClick={() => setImportRows(null)}>Cancel</button>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Columns: code, name, phone, whatsapp, cnic, plan, fee, join</div>
        </div>
      )}

      {detail && (
        <div className="pcard" style={{ marginTop: 14 }}>
          <div className="frow" style={{ justifyContent: 'space-between' }}>
            <b>{detail.code} · {detail.name} — khata & profile</b>
            <span>
              <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: statementHtml(store, detail.id), suggestedName: `statement-${detail.name}.pdf` })}>Print statement</button>
              <button className="btn small ghost" onClick={() => setOpen(null)}>Close</button>
            </span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Plan: {plan(store, detail.plan_id)?.name || '—'} · Trainer: {trainer(store, detail.trainer_id)?.name || '—'} · Joined {detail.join} · Expires {memberExpiry(store, detail) || '—'}
          </div>
          <table className="grid" style={{ marginTop: 8 }}>
            <thead><tr><th>Month</th><th className="r">Billed</th><th className="r">Paid</th><th className="r">Outstanding</th><th>Status</th></tr></thead>
            <tbody>
              {billsFor(store, detail.id).map(b => (
                <tr key={b.id}><td>{b.month}</td><td className="r">{num(b.total).toLocaleString()}</td>
                  <td className="r">{num(b.total - billOutstanding(store, b)).toLocaleString()}</td>
                  <td className="r">{billOutstanding(store, b).toLocaleString()}</td><td>{b.status}</td></tr>
              ))}
            </tbody>
          </table>
          {!!(detail.measurements || []).length && (
            <>
              <h4 style={{ margin: '10px 0 4px' }}>Measurements</h4>
              <table className="grid">
                <thead><tr><th>Date</th><th className="r">Weight</th><th className="r">Chest</th><th className="r">Waist</th><th className="r">Arms</th><th className="r">Hips</th><th>Note</th></tr></thead>
                <tbody>
                  {detail.measurements.map((x, i) => (
                    <tr key={i}><td>{x.date}</td><td className="r">{x.weight}</td><td className="r">{x.chest}</td><td className="r">{x.waist}</td><td className="r">{x.arms}</td><td className="r">{x.hips}</td><td className="muted">{x.note}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {meas && (
        <div className="pcard" style={{ marginTop: 10 }}>
          <b>New measurement — {member(store, meas)?.name}</b>
          <div className="frow" style={{ marginTop: 8 }}>
            <input className="in" type="date" defaultValue={today()} id="ms-date" />
            {['weight', 'chest', 'waist', 'arms', 'hips'].map(f => <input key={f} className="in" style={{ width: 80 }} type="number" placeholder={f} id={'ms-' + f} />)}
            <input className="in" style={{ flex: 1 }} placeholder="Note" id="ms-note" />
            <button className="btn small" onClick={() => {
              const g = id => document.getElementById(id)?.value;
              update(s => { const m = s.members.find(x => x.id === meas); m.measurements = m.measurements || []; m.measurements.push({ date: g('ms-date') || today(), weight: num(g('ms-weight')), chest: num(g('ms-chest')), waist: num(g('ms-waist')), arms: num(g('ms-arms')), hips: num(g('ms-hips')), note: g('ms-note') || '' }); }, 'measurement');
              setMeas(null);
            }}>Save</button>
            <button className="btn small ghost" onClick={() => setMeas(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
