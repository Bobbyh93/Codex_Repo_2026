import React, { useState } from 'react';
import { api, submissionId, formatTime } from './api';
import { Icon } from './components';

// Head-to-toe / focused assessment documentation. Most of the assessment is verbalized at the
// bedside; here the student records, per system, WDL (within defined limits) or the findings,
// in a few taps. The server attaches the monitor values at the time and writes an evidence entry.
export const SYSTEMS = [
  ['neuro', 'Neurological', 'LOC, orientation, speech, pupils, strength'],
  ['cardiac', 'Cardiovascular', 'Rhythm, heart sounds, pulses, cap refill, edema, chest pain'],
  ['resp', 'Respiratory', 'Rate, effort, breath sounds, SpO₂, cough, oxygen'],
  ['gi', 'Gastrointestinal', 'Abdomen, bowel sounds, nausea, last BM, diet'],
  ['gu', 'Genitourinary', 'Output, bladder, catheter'],
  ['skin', 'Integumentary', 'Color, temperature, moisture, wounds, IV site'],
  ['msk', 'Musculoskeletal', 'Mobility, ROM, fall risk'],
  ['pain', 'Pain', 'Location, 0-10, quality, radiation, relief'],
  ['psych', 'Psychosocial / safety', 'Mood, anxiety, support, bed low, call light, ID band'],
];
export function Assessment({ state, refresh, connected }) {
  const { entries, session, actor, scenario } = state, priority = scenario.priorityAssessments || [];
  const [type, setType] = useState('head_to_toe'), [findings, setFindings] = useState({}), [wdl, setWdl] = useState({}), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [open, setOpen] = useState(false);
  const canDocument = session.status === 'active' && connected;
  const past = entries.filter(e => e.action === 'ASSESSMENT_RECORDED');
  const systems = type === 'head_to_toe' ? SYSTEMS : SYSTEMS.filter(([k]) => priority.includes(k) || findings[k] || wdl[k]);
  const touched = SYSTEMS.filter(([k]) => wdl[k] || (findings[k] || '').trim());
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      await api('assessments', { type, systems: touched.map(([k]) => ({ system: k, wdl: !!wdl[k] && !(findings[k] || '').trim(), findings: (findings[k] || '').trim() })), submissionId: submissionId() });
      setFindings({}); setWdl({}); setOpen(false); setMsg('Assessment documented.'); refresh();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  return <div className="assessment">
    {!open ? <div className="preset-row"><button className="primary" disabled={!canDocument} onClick={() => { setType('head_to_toe'); setOpen(true); }}>Document head-to-toe<Icon name="arrow"/></button><button className="secondary" disabled={!canDocument} onClick={() => { setType('focused'); setOpen(true); }}>Focused reassessment</button></div>
    : <form onSubmit={submit} className="assess-form">
      <div className="section-heading"><h4>{type === 'head_to_toe' ? 'Head-to-toe assessment' : 'Focused reassessment'}</h4><button type="button" className="text-button" onClick={() => setOpen(false)}>Cancel</button></div>
      <p className="muted">Tap WDL for systems within defined limits, or write the findings you verbalized. {priority.length ? 'Priority systems for this patient are marked.' : ''} Monitor values at the time are attached automatically.</p>
      {systems.map(([k, name, hint]) => <div key={k} className={`system ${priority.includes(k) ? 'priority' : ''} ${wdl[k] ? 'is-wdl' : ''}`}>
        <div className="system-head"><strong>{name}{priority.includes(k) && <span className="prio">priority</span>}</strong><label className="check"><input type="checkbox" checked={!!wdl[k]} onChange={e => setWdl(w => ({ ...w, [k]: e.target.checked }))}/> WDL</label></div>
        <textarea rows={wdl[k] ? 1 : 2} value={findings[k] || ''} onChange={e => setFindings(f => ({ ...f, [k]: e.target.value }))} maxLength={1000} placeholder={wdl[k] ? 'Optional note' : hint}/>
      </div>)}
      {type === 'focused' && <p className="muted">Other systems: {SYSTEMS.filter(([k]) => !systems.some(([s]) => s === k)).map(([k, name]) => <button key={k} type="button" className="text-button" onClick={() => setFindings(f => ({ ...f, [k]: f[k] || ' ' }))}>{name}</button>)}</p>}
      <div className="form-footer"><small>{touched.length} of {SYSTEMS.length} systems addressed. Saved to the evidence timeline.</small><button className="primary" disabled={busy || !touched.length}>{busy ? 'Saving…' : 'Document assessment'}<Icon name="arrow"/></button></div>
      {msg && <p className="error" role="alert">{msg}</p>}
    </form>}
    {msg === 'Assessment documented.' && !open && <p className="success" role="status">{msg}</p>}
    <h4 className="assess-title">Documented assessments</h4>
    {past.length ? past.slice().reverse().map(a => <article className="assess-entry" key={a.id}><div className="event-heading"><strong>{a.actor_name}</strong><small>{formatTime(a.recorded_at)}{a.linked_id ? ` · reassessment of #${a.linked_id}` : ''}</small></div><p>{a.text}</p></article>) : <div className="empty">No assessments documented yet.</div>}
  </div>;
}
