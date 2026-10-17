import React, { useState } from 'react';
import { api, formatTime } from './api';
import { Icon } from './components';

// Active Orders, Epic-style: grouped by category, new provider orders on top needing acknowledgement.
const CATS = ['Medications', 'Labs', 'Diagnostics', 'Nursing', 'Protocols'];
export function Orders({ state, refresh, connected }) {
  const { orders = [], session } = state, [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [cat, setCat] = useState('all');
  const fresh = orders.filter(o => o.source !== 'standing' && !o.acknowledged), active = session.status === 'active' && connected, canAck = state.actor.role === 'student';
  async function ack(o) { setBusy(o.id); setMsg(''); try { await api('orders/ack', { orderId: o.id }); refresh(); } catch (e) { setMsg(e.message); } finally { setBusy(''); } }
  const shown = orders.filter(o => cat === 'all' || o.category === cat);
  return <><div className="page-heading compact"><h1>Active orders</h1><p>{fresh.length ? `${fresh.length} new order${fresh.length > 1 ? 's' : ''} to acknowledge` : 'All orders acknowledged'}</p></div>
    {fresh.length > 0 && <section className="panel pending"><h4 className="section-label">New orders</h4>{fresh.map(o => <article key={o.id} className="order-card new"><div className="order-main"><span className="order-cat">{o.category}</span><strong>{o.text}</strong><small>{o.placed_by} · {formatTime(o.placed_at)}</small></div>{canAck && <button className="primary small" disabled={!active || busy === o.id} onClick={() => ack(o)}>{busy === o.id ? 'Saving…' : 'Acknowledge'}</button>}</article>)}{msg && <p className="error" role="alert">{msg}</p>}</section>}
    <div className="chips-row" role="group" aria-label="Category"><button type="button" className={`chip ${cat === 'all' ? 'selected' : ''}`} onClick={() => setCat('all')}>All</button>{CATS.map(c => <button key={c} type="button" className={`chip ${cat === c ? 'selected' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
    {CATS.filter(c => cat === 'all' || c === cat).map(c => { const list = shown.filter(o => o.category === c); return list.length ? <section key={c} className="panel"><h4 className="section-label">{c}</h4><div className="order-list">{list.map(o => <article key={o.id} className={`order-card ${o.source !== 'standing' ? 'provider' : ''}`}><div className="order-main"><strong>{o.text}</strong><small>{o.group !== 'New orders' ? o.group + ' · ' : ''}{o.placed_by}{o.source !== 'standing' ? ` · ${formatTime(o.placed_at)}` : ''}{o.acknowledged_name ? ` · acknowledged by ${o.acknowledged_name}` : ''}</small></div>{canAck && o.source !== 'standing' && !o.acknowledged && <button className="secondary small" disabled={!active || busy === o.id} onClick={() => ack(o)}>Acknowledge</button>}</article>)}</div></section> : null; })}
  </>;
}
