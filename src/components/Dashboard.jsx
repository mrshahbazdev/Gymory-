import React from 'react';
import { fmt, num, activeMembers, monthSummary, defaulters, memberExpiry, checkinsOn, today } from '../lib/model.js';

export default function Dashboard({ store, go }) {
  const m = today().slice(0, 7);
  const sum = monthSummary(store, m);
  const defs = defaulters(store, m);
  const members = activeMembers(store);
  const monthlyFee = members.reduce((t, x) => t + num(x.fee), 0);
  const expiring = members.filter(x => { const e = memberExpiry(store, x); return e && e <= addDays(today(), 10); });
  const todayCk = checkinsOn(store, today());
  return (
    <div className="panel">
      <h2 className="ptitle">Dashboard — {m}</h2>
      <div className="cards">
        <div className="pcard"><div className="clabel">Active members</div><div className="cval">{members.length}</div></div>
        <div className="pcard"><div className="clabel">Collected this month</div><div className="cval">{fmt(sum.collected, store.settings.currency)}</div><div className="muted">{sum.billCount} bills billed {fmt(sum.billed, store.settings.currency)}</div></div>
        <div className="pcard"><div className="clabel">Check-ins today</div><div className="cval">{todayCk.length}</div></div>
        <div className="pcard"><div className="clabel">Monthly fee roll</div><div className="cval">{fmt(monthlyFee, store.settings.currency)}</div></div>
        <div className="pcard" style={{ borderColor: defs.length ? '#f59e0b' : undefined }}><div className="clabel">Defaulters</div><div className="cval">{defs.length}</div><div className="muted">owe {fmt(defs.reduce((t, d) => t + d.owes, 0), store.settings.currency)}</div></div>
        <div className="pcard" style={{ borderColor: expiring.length ? '#2563eb' : undefined }}><div className="clabel">Memberships expiring ≤10 days</div><div className="cval">{expiring.length}</div></div>
      </div>

      {expiring.length > 0 && (
        <div className="pcard" style={{ marginTop: 14, borderLeft: '3px solid #2563eb' }}>
          <b>Expiring soon:</b>{' '}
          {expiring.map(x => `${x.name} (${memberExpiry(store, x)})`).join(' · ')}
        </div>
      )}

      <h3 className="ptitle" style={{ fontSize: 15, marginTop: 18 }}>Top defaulters</h3>
      <table className="grid">
        <thead><tr><th>Member</th><th>Phone</th><th>Oldest unpaid</th><th className="r">Owes</th><th></th></tr></thead>
        <tbody>
          {defs.slice(0, 8).map(d => (
            <tr key={d.member.id}>
              <td>{d.member.name}</td><td>{d.member.phone}</td>
              <td>{d.oldest}</td><td className="r">{fmt(d.owes, store.settings.currency)}</td>
              <td><button className="btn small ghost" onClick={() => go('fees')}>Collect</button></td>
            </tr>
          ))}
          {!defs.length && <tr><td colSpan="5" className="muted">Koi defaulter nahi — sab clear.</td></tr>}
        </tbody>
      </table>
      <div className="frow" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => go('fees')}>Month-end: generate fee bills</button>
        <button className="btn ghost" onClick={() => go('checkins')}>Mark check-ins</button>
        <button className="btn ghost" onClick={() => go('reports')}>Reports</button>
      </div>
    </div>
  );
}

function addDays(iso, k) { const d = new Date(iso); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); }
