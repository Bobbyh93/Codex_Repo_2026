import React, { useEffect, useRef, useState } from 'react';
import { api, submissionId } from './api';
import { Icon } from './components';
import { mount as mountMonitor } from './ecg/ecg-monitor';
import { RHYTHM_GROUPS, bandLabel, sourceOptions } from './ecg/rhythms';

export const VITAL_FIELDS = [['hr', 'HR', 'bpm'], ['rr', 'RR', '/min'], ['spo2', 'SpO₂', '%'], ['sbp', 'SBP', 'mmHg'], ['dbp', 'DBP', 'mmHg'], ['temp', 'Temp', '°C']];
const LIMITS = { hr: [50, 120], rr: [8, 24], spo2: [90, 101], sbp: [90, 160], dbp: [40, 100], temp: [35, 38.5] };
const DEFAULTS = { hr: 80, rr: 16, spo2: 97, sbp: 120, dbp: 78, temp: 37, rhythm: 'nsr', transitionSeconds: 0, monitorOn: true };

export function effective(v, now) {
  if (!v) return null;
  const t = v.transition_seconds ? Math.min(1, Math.max(0, (now - Date.parse(v.applied_at)) / (v.transition_seconds * 1000))) : 1;
  const out = { ...v, progress: t };
  if (t < 1) for (const [k] of VITAL_FIELDS) { const x = v['from_' + k] + (v[k] - v['from_' + k]) * t; out[k] = k === 'temp' ? Math.round(x * 10) / 10 : Math.round(x); }
  return out;
}
// Pi time: the device clock plus the offset to the snapshot's server_now (phones and the offline Pi can disagree).
export function useServerClock(serverNow) {
  const offset = useRef(serverNow ? Date.parse(serverNow) - Date.now() : 0);
  useEffect(() => { if (serverNow) offset.current = Date.parse(serverNow) - Date.now(); }, [serverNow]);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 500); return () => clearInterval(t); }, []);
  return Date.now() + offset.current;
}

// ECG and plethysmograph traces, generated from the rhythm criteria (src/ecg) and swept
// like a bedside monitor: 25 mm/s, 6 s across the canvas. The trace runs at the HR shown on
// the readout; the rhythm's morphology, ectopy and conduction pattern come from the criteria row.
const MONITOR_THEME = { bg: '#0b1a14', minor: '#10271c', major: '#163628', trace: '#49e07a', beam: '#c8ffd9', text: '#49e07a', pleth: '#5fd3ff' };
function Traces({ hr, rhythm, on }) {
  const ecgCanvas = useRef(null), plethCanvas = useRef(null), mon = useRef(null);
  useEffect(() => {
    mon.current = mountMonitor(ecgCanvas.current, { ...sourceOptions(rhythm, hr), pleth: plethCanvas.current, theme: MONITOR_THEME, seconds: 6 });
    return () => { mon.current.destroy(); mon.current = null; };
  }, []);
  useEffect(() => {
    const m = mon.current; if (!m) return;
    const o = sourceOptions(rhythm, hr);
    if (m.getRhythm() !== o.rhythm || JSON.stringify(m.getState().extra.ectopy || null) !== JSON.stringify(o.ectopy || null)) m.setRhythm(o.rhythm, o);
    else { m.setRate(o.rate); if (o.ratio && o.ratio !== m.getExtra('ratio')) m.setExtra('ratio', o.ratio); }
  }, [hr, rhythm]);
  useEffect(() => { mon.current?.setBlank(!on); }, [on]);
  return <><canvas ref={ecgCanvas} className="trace" aria-hidden="true"/><canvas ref={plethCanvas} className="trace" aria-hidden="true"/></>;
}

function Readout({ k, label, unit, value, cls }) {
  const [lo, hi] = LIMITS[k], alarm = value != null && (value < lo || value >= hi);
  return <div className={`vital ${cls}${alarm ? ' alarm' : ''}`}><span className="vital-label">{label}<small>{unit}</small></span><strong data-testid={`vital-${k}`}>{value == null ? '--' : value}</strong></div>;
}
export function MonitorDisplay({ vitals, rhythms, now, compact = false }) {
  const v = effective(vitals, now), on = !!v?.monitor_on;
  return <div className={`monitor${compact ? ' compact' : ''}${on ? '' : ' off'}`} role="group" aria-label="Patient monitor">
    <div className="monitor-head"><span>{on ? rhythms[v.rhythm] : 'Leads off'}</span>{v && v.progress < 1 && on && <span className="trend">Trending…</span>}<span className="monitor-brand">Code Shift · Simulation monitor</span></div>
    <div className="monitor-body">
      <div className="traces"><Traces hr={v?.hr || 60} rhythm={v?.rhythm || 'nsr'} on={on}/></div>
      <div className="readouts">
        <Readout k="hr" label="HR" unit="bpm" value={on ? v.hr : null} cls="c-hr"/>
        <Readout k="spo2" label={'SpO₂'} unit="%" value={on ? v.spo2 : null} cls="c-spo2"/>
        <div className={`vital c-bp${on && (v.sbp < 90 || v.sbp >= 160) ? ' alarm' : ''}`}><span className="vital-label">NIBP<small>mmHg</small></span><strong><span data-testid="vital-sbp">{on ? v.sbp : '--'}</span>/<span data-testid="vital-dbp">{on ? v.dbp : '--'}</span></strong><em>MAP {on ? Math.round((v.sbp + 2 * v.dbp) / 3) : '--'}</em></div>
        <Readout k="rr" label="RR" unit="/min" value={on ? v.rr : null} cls="c-rr"/>
        <Readout k="temp" label="Temp" unit={'°C'} value={on ? v.temp : null} cls="c-temp"/>
      </div>
    </div>
    {!on && <div className="monitor-off-note">{vitals ? 'Monitor is off. The instructor can turn it on from the controls.' : 'No vitals have been set for this session yet.'}</div>}
  </div>;
}

export function DocumentVitals({ state, refresh, connected }) {
  const { session, vitals } = state, [docMsg, setDocMsg] = useState(''), [busy, setBusy] = useState(false);
  const now = useServerClock(state.server_now), v = effective(vitals, now), on = !!v?.monitor_on;
  async function documentVitals() { setBusy(true); setDocMsg(''); try { await api('entries', { action: 'VITALS_RECORDED', submissionId: submissionId() }); setDocMsg('Vitals documented to the evidence timeline.'); refresh(); } catch (e) { setDocMsg(e.message); } finally { setBusy(false); } }
  return <div className="doc-vitals"><div><strong>Monitor now</strong><small>{on ? `HR ${v.hr} · RR ${v.rr} · SpO₂ ${v.spo2}% · BP ${v.sbp}/${v.dbp} · T ${v.temp} · ${state.rhythms[v.rhythm]}` : vitals ? 'Monitor off' : 'No vitals set yet'}</small></div><button className="secondary" disabled={busy || !connected || !on || session.status !== 'active'} onClick={documentVitals}>{busy ? 'Saving…' : 'Document vitals'}</button>{docMsg && <p className={docMsg.startsWith('Vitals') ? 'success' : 'error'} role="status">{docMsg}</p>}</div>;
}
export function Monitor({ state, refresh, connected }) {
  const { session, vitals, rhythms, scenario } = state;
  const now = useServerClock(state.server_now);
  const panel = useRef(null);
  return <><div className="page-heading heading-row"><div><h1>Patient monitor</h1><p>Release scenario events and set what the group sees on the room display. Every change is recorded.</p></div><div className="preset-row"><a className="secondary link-button" href="/display" target="_blank" rel="noopener">Open room display <Icon name="arrow"/></a><button className="secondary" onClick={() => panel.current?.requestFullscreen?.()}>Fullscreen here</button></div></div>
    <div className="monitor-grid"><div className="monitor-panel" ref={panel}><MonitorDisplay vitals={vitals} rhythms={rhythms} now={now}/></div>
    <aside className="monitor-side"><Events state={state} refresh={refresh} connected={connected} now={now}/><Controls vitals={vitals} rhythms={rhythms} presets={scenario.facilitator?.monitorPresets || []} session={session} connected={connected} refresh={refresh}/></aside></div></>;
}

function Events({ state, refresh, connected, now }) {
  const { scenario, session, released = [] } = state, [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [open, setOpen] = useState(null);
  const releasedAt = title => released.filter(e => e.text.startsWith(title + ' \u00B7 '));
  const elapsed = Math.round((now - Date.parse(session.started_at)) / 60000);
  async function release(ev) { setBusy(ev.id); setMsg(''); try { await api('events/release', { eventId: ev.id, submissionId: submissionId() }); setOpen(null); refresh(); } catch (e) { setMsg(e.message); } finally { setBusy(''); } }
  if (!scenario.events?.length) return null;
  return <section className="panel events"><div className="section-heading"><h3>Scenario events</h3><small>{elapsed} min elapsed</small></div><p className="muted">Release in order as the team progresses. Students see the result on the chart; the cue is for you. Events with vitals change the monitor.</p>
    {scenario.events.map(ev => { const done = releasedAt(ev.title); return <div key={ev.id} className={`event ${done.length ? 'released' : ''}`}><div className="event-row"><div><strong>{ev.title}</strong><small>~{ev.suggestedMinute} min{ev.vitals ? ' \u00B7 changes monitor' : ''}{done.length ? ` \u00B7 released ${new Date(done[0].recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</small></div><button type="button" className={done.length ? 'secondary small' : 'primary small'} disabled={!connected || session.status === 'ended' || busy === ev.id} onClick={() => setOpen(open === ev.id ? null : ev.id)}>{done.length ? 'Again' : 'Release'}</button></div>
      {open === ev.id && <div className="event-detail"><p><b>Students will see:</b> {ev.studentText}</p>{ev.cue && <p><b>Cue:</b> {ev.cue}</p>}{ev.vitals && <p><b>Monitor:</b> HR {ev.vitals.hr} \u00B7 RR {ev.vitals.rr} \u00B7 SpO\u2082 {ev.vitals.spo2}% \u00B7 BP {ev.vitals.sbp}/{ev.vitals.dbp} \u00B7 {state.rhythms[ev.vitals.rhythm]}{ev.vitals.transitionSeconds ? ` over ${ev.vitals.transitionSeconds} s` : ''}</p>}<div className="preset-row"><button type="button" className="primary small" disabled={busy === ev.id} onClick={() => release(ev)}>{busy === ev.id ? 'Releasing\u2026' : 'Release now'}</button><button type="button" className="text-button" onClick={() => setOpen(null)}>Cancel</button></div></div>}
    </div>; })}
    {msg && <p className="error" role="alert">{msg}</p>}
  </section>;
}
const formFrom = v => v ? { hr: v.hr, rr: v.rr, spo2: v.spo2, sbp: v.sbp, dbp: v.dbp, temp: v.temp, rhythm: v.rhythm, transitionSeconds: 0, monitorOn: !!v.monitor_on } : DEFAULTS;
function Controls({ vitals, rhythms, presets, session, connected, refresh }) {
  const [form, setForm] = useState(() => formFrom(vitals)), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const pending = useRef(null);
  useEffect(() => { if (!vitals) return; if (pending.current && vitals.submission_id === pending.current.submissionId) { pending.current = null; setMsg('Monitor updated.'); } setForm(formFrom(vitals)); }, [vitals?.id]);   // a new monitor row (event release, another device) resyncs the form, so the next Apply does not post stale values; our own lost-response row counts as applied
  const set = (k, value) => setForm(f => ({ ...f, [k]: value }));
  async function apply(e) {
    e.preventDefault(); setBusy(true); setMsg('');
    const payload = { ...form, submissionId: submissionId() };
    for (const [k] of VITAL_FIELDS) payload[k] = Number(payload[k]);
    if (!pending.current || JSON.stringify({ ...pending.current, submissionId: 0 }) !== JSON.stringify({ ...payload, submissionId: 0 })) pending.current = payload;
    try { await api('vitals', pending.current); pending.current = null; setMsg('Monitor updated.'); setForm(f => ({ ...f, transitionSeconds: 0 })); refresh(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  const ended = session.status === 'ended';
  const [showForm, setShowForm] = useState(!vitals);
  return <form className="panel controls" onSubmit={apply}>
    <div className="section-heading"><h3>Monitor controls</h3><label className="toggle"><input type="checkbox" checked={form.monitorOn} onChange={e => set('monitorOn', e.target.checked)}/> Monitor on</label></div>
    {presets.length > 0 && <div className="presets"><h4>Scenario presets</h4><p className="muted">Tap a preset, then Apply. Edit values first if you need to.</p><div className="preset-row">{presets.map(p => <button type="button" className="secondary" key={p.name} onClick={() => setForm(f => ({ ...f, ...p.values, monitorOn: true }))}>{p.name}</button>)}</div></div>}
    <button type="button" className="text-button" onClick={() => setShowForm(f => !f)}>{showForm ? 'Hide manual vitals' : 'Adjust vitals manually'}</button>
    {showForm && <>
    <div className="vital-inputs">{VITAL_FIELDS.map(([k, label, unit]) => <div className="vital-input" key={k}><label htmlFor={`vital-${k}`}>{label}</label><input id={`vital-${k}`} type="number" inputMode="decimal" step={k === 'temp' ? 0.1 : 1} value={form[k]} onChange={e => set(k, e.target.value)} required aria-describedby={`unit-${k}`}/><small id={`unit-${k}`}>{unit}</small></div>)}</div>
    <label>Rhythm<select value={form.rhythm} onChange={e => set('rhythm', e.target.value)}>{RHYTHM_GROUPS.map(group => <optgroup key={group.node} label={group.node}>{group.items.filter(([k]) => rhythms[k]).map(([k]) => <option key={k} value={k}>{rhythms[k]}{bandLabel(k) ? ` · ${bandLabel(k)}` : ''}</option>)}</optgroup>)}</select></label>
    <label>Trend to these values over<select value={form.transitionSeconds} onChange={e => set('transitionSeconds', Number(e.target.value))}><option value={0}>Immediately</option><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={300}>5 minutes</option></select></label>
    </>}
    <button className="primary wide" disabled={busy || !connected || ended}>{busy ? 'Applying…' : 'Apply to monitor'}<Icon name="arrow"/></button>
    {ended && <p className="muted">The session has ended; the monitor is frozen.</p>}
    {msg && <p className={msg === 'Monitor updated.' ? 'success' : 'error'} role="status">{msg}</p>}
  </form>;
}
