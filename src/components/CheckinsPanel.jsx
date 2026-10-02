import React, { useState } from 'react';
import { uid, activeMembers, checkinsOn, hasCheckedIn, memberCheckins, today, nowTime, ym } from '../lib/model.js';
import { attendanceHtml } from '../lib/prints.js';

export default function CheckinsPanel({ store, update }) {
  const [date, setDate] = useState(today());
  const [q, setQ] = useState('');
  const list = activeMembers(store).filter(m => !q || (m.name + ' ' + (m.code || '')).toLowerCase().includes(q.toLowerCase()));
  const cks = checkinsOn(store, date).sort((a, b) => a.time.localeCompare(b.time));
  const month = ym(date);

  const mark = (m) => update(s => {
    s.checkins.push({ id: uid('c'), member_id: m.id, date, time: nowTime() });
  }, `check-in ${m.name}`);

  return (
    <div className="panel">
      <div className="frow" style={{ alignItems: 'center' }}>
        <h2 className="ptitle" style={{ margin: 0, flex: 1 }}>Check-ins — {date}</h2>
        <input className="in" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button className="btn ghost" onClick={() => window.api.export.pdf({ html: attendanceHtml(store, month), suggestedName: `attendance-${month}.pdf` })}>Print register ({month})</button>
      </div>
      <input className="in" style={{ width: 320, margin: '10px 0' }} placeholder="Search member / code…" value={q} onChange={e => setQ(e.target.value)} />
      <table className="grid">
        <thead><tr><th>Code</th><th>Member</th><th className="r">This month</th><th>Today</th><th></th></tr></thead>
        <tbody>
          {list.map(m => {
            const inside = hasCheckedIn(store, m.id, date);
            return (
              <tr key={m.id}>
                <td>{m.code}</td><td>{m.name}</td>
                <td className="r">{memberCheckins(store, m.id, month)}</td>
                <td>{inside ? <span className="tag ok">in</span> : '—'}</td>
                <td>{!inside && <button className="btn small" onClick={() => mark(m)}>Check in</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3 className="ptitle" style={{ fontSize: 14, marginTop: 16 }}>Log — {date} ({cks.length})</h3>
      <table className="grid">
        <tbody>
          {cks.map(c => <tr key={c.id}><td>{c.time}</td><td>{(store.members || []).find(m => m.id === c.member_id)?.name}</td></tr>)}
          {!cks.length && <tr><td className="muted">No check-ins.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
