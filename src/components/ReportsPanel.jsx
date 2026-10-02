import React from 'react';
import { fmt, num, monthSummary, defaulters, addMonths, memberExpiry, memberCheckins, activeMembers, today } from '../lib/model.js';
import { defaultersHtml, collectionHtml, attendanceHtml } from '../lib/prints.js';

export default function ReportsPanel({ store }) {
  const cur = store.settings.currency;
  const m0 = today().slice(0, 7);
  const months = [...Array(6)].map((_, i) => addMonths(m0, -i)).reverse();
  const defs = defaulters(store, m0);
  const trend = months.map(m => ({ m, ...monthSummary(store, m) }));
  const mems = activeMembers(store);
  const perPlan = (store.plans || []).map(p => ({
    p, count: mems.filter(m => m.plan_id === p.id).length,
    roll: mems.filter(m => m.plan_id === p.id).reduce((t, m) => t + num(m.fee), 0)
  }));
  const topAttenders = mems.map(m => ({ m, days: memberCheckins(store, m.id, m0) })).sort((a, b) => b.days - a.days).slice(0, 10);
  const expiring = mems.filter(x => { const e = memberExpiry(store, x); const soon = new Date(today()); soon.setDate(soon.getDate() + 30); return e && e <= soon.toISOString().slice(0, 10); });

  return (
    <div className="panel">
      <h2 className="ptitle">Reports</h2>
      <div className="frow" style={{ marginBottom: 14 }}>
        <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: defaultersHtml(store, m0, defs), suggestedName: `defaulters-${m0}.pdf` })}>Print defaulters</button>
        <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: collectionHtml(store, m0), suggestedName: `collection-${m0}.pdf` })}>Print collection register</button>
        <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: attendanceHtml(store, m0), suggestedName: `attendance-${m0}.pdf` })}>Print attendance</button>
      </div>

      <h3 className="ptitle" style={{ fontSize: 14 }}>6-month trend</h3>
      <table className="grid">
        <thead><tr><th>Month</th><th className="r">Billed</th><th className="r">Collected</th><th className="r">Expenses</th><th className="r">Net</th><th className="r">Rate</th></tr></thead>
        <tbody>
          {trend.map(t => (
            <tr key={t.m}>
              <td>{t.m}</td><td className="r">{t.billed.toLocaleString()}</td><td className="r">{t.collected.toLocaleString()}</td>
              <td className="r">{t.expenses.toLocaleString()}</td>
              <td className="r"><b>{(t.collected - t.expenses).toLocaleString()}</b></td>
              <td className="r">{t.billed ? Math.round(t.collected / t.billed * 100) + '%' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ fontSize: 14 }}>Per plan — {m0}</h3>
      <table className="grid">
        <thead><tr><th>Plan</th><th className="r">Members</th><th className="r">Monthly roll</th></tr></thead>
        <tbody>
          {perPlan.map(({ p, count, roll }) => (
            <tr key={p.id}><td>{p.name}</td><td className="r">{count}</td><td className="r">{fmt(roll, cur)}</td></tr>
          ))}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ fontSize: 14 }}>Top attenders — {m0}</h3>
      <table className="grid">
        <thead><tr><th>Member</th><th className="r">Days this month</th></tr></thead>
        <tbody>
          {topAttenders.map(({ m, days }) => <tr key={m.id}><td>{m.name}</td><td className="r">{days}</td></tr>)}
          {!topAttenders.length && <tr><td colSpan="2" className="muted">No members.</td></tr>}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ fontSize: 14 }}>Memberships expiring in 30 days</h3>
      <table className="grid">
        <thead><tr><th>Member</th><th>Phone</th><th>Expires</th></tr></thead>
        <tbody>
          {expiring.map(m => <tr key={m.id}><td>{m.name}</td><td>{m.phone}</td><td>{memberExpiry(store, m)}</td></tr>)}
          {!expiring.length && <tr><td colSpan="3" className="muted">None expiring soon.</td></tr>}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ fontSize: 14 }}>Defaulters</h3>
      <table className="grid">
        <thead><tr><th>Member</th><th>Phone</th><th>Oldest unpaid</th><th className="r">Owes</th></tr></thead>
        <tbody>
          {defs.map(d => (
            <tr key={d.member.id}><td>{d.member.name}</td><td>{d.member.phone}</td><td>{d.oldest}</td>
              <td className="r" style={{ color: '#dc2626', fontWeight: 600 }}>{fmt(d.owes, cur)}</td></tr>
          ))}
          {!defs.length && <tr><td colSpan="4" className="muted">Koi defaulter nahi.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
