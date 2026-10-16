import React, { useState } from 'react';
import { api, submissionId, formatTime } from './api';
import { Icon } from './components';

// Choice-based SBAR provider communication (no free text). Students pick a situation and a
// recommendation from the scenario's list; the instructor answers as the provider from reply choices.
export function Provider({ state, refresh, connected }) {
  const { entries, actor, session, scenario } = state, instructor = actor.role === 'instructor', script = scenario.providerScript || { situations: [], recommendations: [], replies: [] };
  const [situation, setSituation] = useState(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const messages = entries.filter(e => e.action === 'PROVIDER_MESSAGE'), replies = id => entries.filter(e => e.action === 'PROVIDER_REPLY' && e.linked_id === id);
  const active = session.status === 'active' && connected;
  async function send(recommendationId) { setBusy(true); setMsg(''); try { await api('provider', { situationId: situation, recommendationId, submissionId: submissionId() }); setSituation(null); refresh(); } catch (e) { setMsg(e.message); } finally { setBusy(false); } }
  async function reply(messageId, replyId) { setBusy(true); setMsg(''); try { await api('provider/reply', { messageId, replyId, submissionId: submissionId() }); refresh(); } catch (e) { setMsg(e.message); } finally { setBusy(false); } }
  const pending = messages.filter(m => !replies(m.id).length);
  return <><div className="page-heading compact"><h1>Provider</h1><p>{instructor ? 'Answer the team as the provider. Tap a reply.' : 'Call the provider with SBAR. Tap the situation, then your recommendation.'}</p></div>
    {!instructor && active && (situation == null ? <section className="panel"><h4 className="section-label">Situation</h4><div className="choice-list">{script.situations.map(s => <button key={s.id} type="button" className="choice" onClick={() => setSituation(s.id)}><strong>{s.title}</strong><span>{s.text}</span></button>)}</div></section>
      : <section className="panel"><button type="button" className="text-button" onClick={() => setSituation(null)}>← Change situation</button><p className="lead"><strong>{script.situations.find(s => s.id === situation)?.title}.</strong> {script.situations.find(s => s.id === situation)?.text}</p><h4 className="section-label">Recommendation</h4><div className="choice-list">{script.recommendations.map(r => <button key={r.id} type="button" className="choice" disabled={busy} onClick={() => send(r.id)}><strong>{r.title}</strong>{r.text && <span>{r.text}</span>}</button>)}</div></section>)}
    {msg && <p className="error" role="alert">{msg}</p>}
    {instructor && pending.length > 0 && <section className="panel pending"><h4 className="section-label">Waiting for the provider</h4>{pending.map(m => <article className="thread" key={m.id}><div className="event-heading"><strong>{m.actor_name}</strong><small>{formatTime(m.recorded_at)}</small></div><p>{m.text}</p><div className="choice-list">{script.replies.map(r => <button key={r.id} type="button" className="choice reply-choice" disabled={busy || !connected || session.status === 'ended'} onClick={() => reply(m.id, r.id)}><strong>{r.title}</strong>{r.text && <span>{r.text}</span>}</button>)}</div></article>)}</section>}
    <section className="panel"><h4 className="section-label">Calls this shift</h4>{messages.length ? messages.slice().reverse().map(m => <article className="thread" key={m.id}><div className="event-heading"><strong>{m.actor_name}</strong><small>{formatTime(m.recorded_at)}</small></div><p>{m.text}</p>{replies(m.id).map(r => <div className="reply" key={r.id}><div className="event-heading"><strong>Provider</strong><small>{formatTime(r.recorded_at)}</small></div><p>{r.text}</p></div>)}{!replies(m.id).length && <p className="muted">Waiting for the provider…</p>}</article>) : <p className="muted">No calls yet.</p>}</section></>;
}
