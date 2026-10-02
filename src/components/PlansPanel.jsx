import React, { useState } from 'react';
import { uid, fmt, num, today } from '../lib/model.js';

export default function PlansPanel({ store, update }) {
  const [p, setP] = useState(null);
  const [t, setT] = useState(null);
  const cur = store.settings.currency;

  return (
    <div className="panel">
      <h2 className="ptitle">Membership plans</h2>
      <table className="grid" style={{ marginBottom: 10 }}>
        <thead><tr><th>Plan</th><th className="r">Months</th><th className="r">Fee</th><th className="r">Admission</th><th className="r">Members</th><th></th></tr></thead>
        <tbody>
          {(store.plans || []).map(x => (
            <tr key={x.id} className={x.active === false ? 'muted' : ''}>
              <td>{x.name}{x.active === false ? ' (inactive)' : ''}</td>
              <td className="r">{x.months}</td>
              <td className="r">{fmt(x.fee, cur)}</td><td className="r">{fmt(x.admission, cur)}</td>
              <td className="r">{(store.members || []).filter(m => m.plan_id === x.id && m.status === 'active').length}</td>
              <td>
                <button className="btn small ghost" onClick={() => setP({ ...x })}>Edit</button>
                <button className="btn small ghost" onClick={() => update(s => { const y = s.plans.find(z => z.id === x.id); y.active = y.active === false ? true : false; }, 'toggle plan')}>{x.active === false ? 'Enable' : 'Disable'}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn small ghost" onClick={() => setP({ name: '', months: 1, fee: 0, admission: 0, active: true })}>+ New plan</button>
      {p && (
        <div className="pcard" style={{ marginTop: 10 }}>
          <div className="frow">
            <input className="in" style={{ flex: 1 }} placeholder="Plan name" value={p.name} onChange={e => setP({ ...p, name: e.target.value })} />
            <label className="lbl">Months <input className="in" style={{ width: 90 }} type="number" min="1" value={p.months} onChange={e => setP({ ...p, months: num(e.target.value) || 1 })} /></label>
            <label className="lbl">Fee <input className="in" style={{ width: 110 }} type="number" value={p.fee} onChange={e => setP({ ...p, fee: num(e.target.value) })} /></label>
            <label className="lbl">Admission <input className="in" style={{ width: 110 }} type="number" value={p.admission} onChange={e => setP({ ...p, admission: num(e.target.value) })} /></label>
            <button className="btn small" onClick={() => {
              if (!p.name) return;
              update(s => { if (p.id) Object.assign(s.plans.find(z => z.id === p.id), p); else s.plans.push({ ...p, id: uid('p') }); }, 'save plan');
              setP(null);
            }}>Save</button>
            <button className="btn small ghost" onClick={() => setP(null)}>✕</button>
          </div>
        </div>
      )}

      <h2 className="ptitle" style={{ marginTop: 22 }}>Trainers</h2>
      <table className="grid" style={{ marginBottom: 10 }}>
        <thead><tr><th>Name</th><th>Phone</th><th className="r">Members</th><th></th></tr></thead>
        <tbody>
          {(store.trainers || []).map(x => (
            <tr key={x.id}>
              <td>{x.name}</td><td>{x.phone}</td>
              <td className="r">{(store.members || []).filter(m => m.trainer_id === x.id && m.status === 'active').length}</td>
              <td>
                <button className="btn small ghost" onClick={() => setT({ ...x })}>Edit</button>
                <button className="icon" onClick={() => { if (confirm('Remove trainer? Members keep their records.')) update(s => s.trainers = s.trainers.filter(z => z.id !== x.id), 'remove trainer'); }}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn small ghost" onClick={() => setT({ name: '', phone: '' })}>+ Trainer</button>
      {t && (
        <div className="pcard" style={{ marginTop: 10 }}>
          <div className="frow">
            <input className="in" style={{ flex: 1 }} placeholder="Trainer name" value={t.name} onChange={e => setT({ ...t, name: e.target.value })} />
            <input className="in" placeholder="Phone" value={t.phone} onChange={e => setT({ ...t, phone: e.target.value })} />
            <button className="btn small" onClick={() => {
              if (!t.name) return;
              update(s => { if (t.id) Object.assign(s.trainers.find(z => z.id === t.id), t); else s.trainers.push({ ...t, id: uid('tr') }); }, 'save trainer');
              setT(null);
            }}>Save</button>
            <button className="btn small ghost" onClick={() => setT(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
