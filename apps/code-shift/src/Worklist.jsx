import React, { useState } from 'react';
import { api, formatTime } from './api';
import { Icon } from './components';
import { useServerClock } from './Monitor';

// The "Brain": one timeline of everything due in the visit. Students tap a task done; the instructor confirms or flags.
const KIND_ICON = { med: 'pill', order: 'setup', result: 'chart', nursing: 'user', reassess: 'monitor' };
const hhmm = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export function Worklist({ state, refresh, connected, setPage }) {
  const { worklist = [], session, actor } = state, instructor = actor.role === 'instructor';
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [showDone, setShowDone] = useState(instructor);
  const active = session.status === 'active' && connected, now = useServerClock(state.server_now);   // due times are Pi time
  async function post(url, body, key) { setBusy(key); setMsg(''); try { await api(url, body); refresh(); } catch (e) { setMsg(e.message); } finally { setBusy(''); } }
  const open = worklist.filter(t => t.status === 'open'), done = worklist.filter(t => t.status !== 'open');
  const bucket = t => { const m = (Date.parse(t.due_at) - now) / 60000; return m < -15 ? 'overdue' : m <= 15 ? 'now' : m <= 60 ? 'soon' : 'later'; };
  const groups = [['overdue', 'Overdue'], ['now', 'Now'], ['soon', 'Next hour'], ['later', 'Later']];
  const action = t => {
    if (t.kind === 'med') return <button className="primary small" disabled={!active} onClick={() => setPage('meds')}>Open MAR<Icon name="arrow"/></button>;
    if (instructor) return null; // students complete and acknowledge; the instructor confirms or flags what they did
    if (t.kind === 'order') return <button className="primary small" disabled={!active || busy === t.key} onClick={() => post('orders/ack', { orderId: t.order_id }, t.key)}>Acknowledge</button>;
    return <button className="primary small" disabled={!active || busy === t.key} onClick={() => post('tasks/done', { key: t.key }, t.key)}>{busy === t.key ? 'Saving…' : t.kind === 'result' ? 'Reviewed' : 'Done'}</button>;
  };
  return <><div className="page-heading compact"><h1>{instructor ? 'Worklist' : 'My worklist'}</h1><p>{open.length ? `${open.length} open · ${open.filter(t => bucket(t) === 'overdue').length} overdue` : 'Nothing open right now'}</p></div>
    {msg && <p className="error" role="alert">{msg}</p>}
    {groups.map(([b, title]) => { const list = open.filter(t => bucket(t) === b); return list.length ? <section key={b} className={`panel wl-${b}`}><h4 className="section-label">{title} <em>{list.length}</em></h4><div className="task-list">{list.map(t => <article key={t.key} className={`task ${t.kind}`}><div className="task-time">{hhmm(t.due_at)}</div><div className="task-main"><Icon name={KIND_ICON[t.kind] || 'chart'}/><div><strong>{t.title}</strong><small>{t.category}{b === 'overdue' ? ` · ${Math.round((now - Date.parse(t.due_at)) / 60000)} min overdue` : ''}</small></div></div>{action(t)}</article>)}</div></section> : null; })}
    <section className="panel"><div className="section-heading"><h4 className="section-label">Completed <em>{done.length}</em></h4><button type="button" className="text-button" onClick={() => setShowDone(s => !s)}>{showDone ? 'Hide' : 'Show'}</button></div>
      {showDone && (done.length ? <div className="task-list">{done.slice().reverse().map(t => <article key={t.key} className={`task done st-${t.status}`}><div className="task-time">{t.done_at ? hhmm(t.done_at) : ''}</div><div className="task-main"><Icon name={t.status === 'flagged' ? 'lock' : 'check'}/><div><strong>{t.title}</strong><small>{t.done_name} · {t.status === 'confirmed' ? `confirmed by ${t.reviewed_name}` : t.status === 'flagged' ? `flagged by ${t.reviewed_name}` : 'awaiting instructor review'}{t.due_at && t.done_at && Date.parse(t.done_at) - Date.parse(t.due_at) > 5 * 60000 ? ` · ${Math.round((Date.parse(t.done_at) - Date.parse(t.due_at)) / 60000)} min late` : ''}</small></div></div>{instructor && t.status === 'done' && <span className="preset-row"><button className="secondary small" disabled={busy === t.key} onClick={() => post('tasks/review', { key: t.key, status: 'confirmed' }, t.key)}>Confirm</button><button className="danger small" disabled={busy === t.key} onClick={() => post('tasks/review', { key: t.key, status: 'flagged', note: 'Not observed or not performed correctly' }, t.key)}>Flag</button></span>}</article>)}</div> : <p className="muted">No completed tasks yet.</p>)}
    </section></>;
}
