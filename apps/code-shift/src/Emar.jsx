import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, submissionId, formatTime } from './api';
import { Icon } from './components';
import { Scanner, cameraAvailable } from './Scanner';

const STATUS = { due: 'Due', available: 'Available', given: 'Given', held: 'Held', refused: 'Refused' };
const ALERT = { ALREADY_GIVEN: 'Already given', TOO_EARLY: 'Too early', MAX_DOSES: 'Max doses', HOLD_RULE: 'Hold rule' };

export function Emar({ state, refresh, connected }) {
  const { medications, scenario, session, actor } = state, instructor = actor.role === 'instructor';
  const [giving, setGiving] = useState(null), [msg, setMsg] = useState('');
  const canDocument = session.status === 'active' && connected, scanRequired = !!session.scan_required;
  const WINDOWS = [['overdue', 'Overdue'], ['due', 'Due now'], ['upcoming', 'Upcoming'], ['prn', 'PRN'], ['continuous', 'Continuous'], ['complete', 'Completed']];
  const GLYPH = { overdue: '\u26A0', due: '\u23F0', upcoming: '\u25CB', prn: '\u2605', continuous: '\u221E', complete: '\u2713' };
  const [pass, setPass] = useState(null), [passScanning, setPassScanning] = useState(false), [passMsg, setPassMsg] = useState(''), [open, setOpen] = useState(null);
  const passFresh = pass && Date.now() - Date.parse(pass.at) < 10 * 60000;
  const identify = useCallback(async text => { setPassScanning(false); setPassMsg(''); try { const r = await api('meds/scan', { attemptId: 'pass-' + submissionId(), medId: medications[0]?.id, kind: 'patient', code: text, source: 'camera' }); if (r.matched) setPass({ code: text, at: new Date().toISOString(), patient: r.patient }); else setPassMsg(r.alert); } catch (e) { setPassMsg(e.message); } }, [medications]);
  async function post(url, body) { setMsg(''); try { await api(url, body); refresh(); } catch (e) { setMsg(e.message); } }
  const live = giving && medications.find(m => m.id === giving.id);
  const windowOf = m => m.window || (m.kind === 'prn' ? 'prn' : 'due');
  return <div className="emar">
    <section className={`panel identify-card ${passFresh ? 'ok' : ''}`}>{passFresh ? <div className="identify-row"><span><strong>{pass.patient?.name || scenario.patient.name}</strong><small>Wristband verified {new Date(pass.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · valid 10 min</small></span><button type="button" className="text-button" onClick={() => setPass(null)}>End med pass</button></div>
      : <div className="identify-row"><span><strong>Identify the patient</strong><small>Scan the wristband once to open the MAR for this med pass; each medication then needs only its label scanned. {scanRequired ? 'Scanning is required in this session.' : 'Manual entry is allowed in this session, with a reason.'}</small></span>{cameraAvailable() ? <button type="button" className="primary" disabled={!canDocument} onClick={() => setPassScanning(true)}>Scan wristband<Icon name="arrow"/></button> : <small className="muted">Camera unavailable: the Give flow will ask for the wristband.</small>}</div>}
      {passScanning && <Scanner label="Scan wristband" hint="Point the camera at the patient wristband." onResult={identify} onClose={() => setPassScanning(false)}/>}
      {passMsg && <p className="error" role="alert">{passMsg}</p>}
    </section>
    {WINDOWS.map(([w, title]) => { const meds = medications.filter(m => windowOf(m) === w); return meds.length ? <div key={w} className={`emar-group win-${w}`}><h4 className="section-label"><span className="glyph">{GLYPH[w]}</span>{title} <em>{meds.length}</em></h4><div className="med-list">{meds.map(m => <article key={m.id} className={`med-card st-${m.status} win-${windowOf(m)}`} aria-label={`${m.name} ${m.dose}`}>
      <div className="med-main">
        <button type="button" className="med-title-btn" aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)}><div className="med-title"><strong>{m.name}</strong> <span>{m.dose} · {m.route}</span></div></button>
        <div className="med-meta"><span className={`status ${m.status}`}>{STATUS[m.status] || m.status}{m.givenCount > 0 ? ` ×${m.givenCount}` : ''}</span><span>{w === 'prn' ? m.frequency : w === 'continuous' ? 'Infusing' : w === 'complete' ? (m.last_given_at ? 'Given ' + new Date(m.last_given_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '') : m.next_due ? (w === 'overdue' ? 'Was due ' : 'Due ') + new Date(m.next_due).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Due now'}</span></div>
        {m.holdRule && <small className="hold-rule">Hold for SBP below {m.holdRule.sbpBelow}</small>}
        {m.alerts?.map(a => <small key={a.code} className="alert-chip">{ALERT[a.code] || a.code}: {a.text}</small>)}
        {(m.last || m.mismatchCount > 0 || m.blockedCount > 0 || m.manualCount > 0) && <small className="last">{m.last && `${m.last.actor_name} · ${formatTime(m.last.recorded_at)}${m.last.verification && m.last.verification !== 'none' ? ' · ' + m.last.verification : ''}`}{m.last?.scan_order === 'med_first' && <b className="blocked"> · Scanned out of order</b>}{m.mismatchCount > 0 && <b className="blocked"> · {m.mismatchCount} scan alert{m.mismatchCount > 1 ? 's' : ''}</b>}{m.blockedCount > 0 && <b className="blocked"> · {m.blockedCount} blocked attempt{m.blockedCount > 1 ? 's' : ''}</b>}{m.manualCount > 0 && <b className="hold-rule"> · {m.manualCount} manual</b>}</small>}
        {open === m.id && <dl className="order-detail"><dt>Order</dt><dd>{m.name} {m.dose} {m.route} {m.frequency}</dd><dt>Source</dt><dd>{m.order_source}</dd>{m.prn && <><dt>Indication</dt><dd>{m.prn.indication}{m.prn.minIntervalMin ? ` · q${m.prn.minIntervalMin} min` : ''}{m.prn.maxDoses ? ` · max ${m.prn.maxDoses} in ${m.prn.windowMin} min` : ''}</dd></>}{m.holdRule && <><dt>Hold</dt><dd>SBP below {m.holdRule.sbpBelow}</dd></>}<dt>Last given</dt><dd>{m.last_given_at ? formatTime(m.last_given_at) : 'Not yet'}</dd>{m.next_due && <><dt>Next due</dt><dd>{formatTime(m.next_due)}</dd></>}</dl>}
      </div>
      <button className="primary give" disabled={!canDocument} onClick={() => setGiving(m)}>Give<Icon name="arrow"/></button>
    </article>)}</div></div> : null; })}
    {instructor && <div className="emar-group orders-admin"><h4>Scanning policy</h4><p className="muted">{scanRequired ? 'Students must scan both codes. Turn this off only if phones cannot use the camera; every manual entry will then need a reason and is flagged.' : 'Manual entry is allowed. Turn scanning back on to enforce the bedside habit.'}</p><button type="button" className={scanRequired ? 'primary small' : 'secondary small'} disabled={session.status === 'ended' || !connected} onClick={() => post('session-settings', { scanRequired: !scanRequired })}>{scanRequired ? '✓ Scanning required' : 'Require scanning'}</button></div>}
    {instructor && <div className="emar-group orders-admin"><h4>Activate sim-day orders</h4><p className="muted">These are the "to be assigned day of SIM" medications. Activating one adds it to the eMAR and records the order change.</p><div className="preset-row">{scenario.medications.filter(m => m.kind === 'assignable').map(m => { const on = medications.some(a => a.id === m.id); return <button key={m.id} type="button" className={on ? 'primary small' : 'secondary small'} disabled={session.status === 'ended' || !connected} onClick={() => post('meds/orders', { medId: m.id, active: !on })}>{on ? '✓ ' : '+ '}{m.name} {m.dose}</button>; })}</div></div>}
    {instructor && <BarcodeRegistry state={state} refresh={refresh} connected={connected}/>}
    {msg && <p className="error" role="alert">{msg}</p>}
    {!canDocument && <p className="muted">Medication documentation is available while the session is active and connected.</p>}
    {giving && <GiveDialog med={live || giving} patient={scenario.patient} scanRequired={scanRequired} pass={passFresh ? pass : null} onClose={() => setGiving(null)} onDone={() => { setGiving(null); refresh(); }}/>}
  </div>;
}

// Scan-first flow with immediate verification: each read is checked by the server as it happens,
// a wrong item alerts right away (and is recorded), alerts are reviewed before the decision.
function GiveDialog({ med, patient, scanRequired, pass, onClose, onDone }) {
  const camera = cameraAvailable(), attemptId = useRef(submissionId()).current, [serverAlerts, setServerAlerts] = useState([]);
  const alerts = [...(med.alerts || []), ...serverAlerts.filter(a => !(med.alerts || []).some(m => m.code === a.code))];
  const [outcome, setOutcome] = useState('given'), [step, setStep] = useState(pass ? 'med' : 'patient');
  const [codes, setCodes] = useState({ patient: pass ? pass.code : '', med: '' }), [stamps, setStamps] = useState(pass ? { patient: pass.at } : {}), [source, setSource] = useState({ patient: pass ? 'camera' : '', med: '' }), [verified, setVerified] = useState(pass ? { patient: { patient: pass.patient } } : {});
  const [scanning, setScanning] = useState(camera), [manual, setManual] = useState(false), [draft, setDraft] = useState(''), [checking, setChecking] = useState(false), [scanAlert, setScanAlert] = useState('');
  const [manualReason, setManualReason] = useState(''), [reason, setReason] = useState(''), [ack, setAck] = useState(false), [overrideReason, setOverrideReason] = useState('');
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [indication, setIndication] = useState(med.prn?.indication || ''), [indicationValue, setIndicationValue] = useState('');
  const prnLike = med.kind === 'prn' || med.kind === 'stat';
  const needsMed = outcome === 'given';
  const advance = useCallback(kind => { if (kind === 'patient' && needsMed) { setStep('med'); setScanning(camera && !manual); } else { setStep('confirm'); setScanning(false); } }, [needsMed, camera, manual]);
  async function autoDocument(medCode, medAt) {
    setBusy(true); setStep('confirm'); setScanning(false);
    try { setResult(await api('meds', { medId: med.id, action: 'given', patientCode: codes.patient, medCode, verification: 'camera', patientScannedAt: stamps.patient, medScannedAt: medAt, attemptId, indication: med.prn?.indication || (med.kind === 'stat' ? med.frequency : undefined), submissionId: submissionId() })); }
    catch (e) { if (e.status === 409 && Array.isArray(e.data?.alerts)) { setServerAlerts(e.data.alerts); setAck(false); setResult(null); setCodes(c => ({ ...c, med: medCode })); setStamps(t => ({ ...t, med: medAt })); setSource(s => ({ ...s, med: 'camera' })); } else setResult({ error: e.message }); }
    finally { setBusy(false); }
  }
  const check = useCallback(async (kind, text, src, format) => {
    setChecking(true); setScanAlert('');
    try {
      const r = await api('meds/scan', { attemptId, medId: med.id, kind, code: text, source: src, format: format != null ? String(format) : undefined });
      if (r.matched) { const at = new Date().toISOString(); setCodes(c => ({ ...c, [kind]: text })); setStamps(t => ({ ...t, [kind]: at })); setSource(s => ({ ...s, [kind]: src })); setVerified(v => ({ ...v, [kind]: r })); setDraft(''); if (kind === 'med' && src === 'camera' && source.patient === 'camera' && needsMed && !alerts.length) { autoDocument(text, at); } else advance(kind); }
      else { try { navigator.vibrate?.([120, 60, 120]); } catch {} setScanAlert(r.alert); setScanning(false); }
    } catch (e) { setScanAlert(e.message); setScanning(false); } finally { setChecking(false); }
  }, [attemptId, med.id, advance, source.patient, needsMed, alerts.length, codes.patient, stamps.patient]); // eslint-disable-line
  const onScan = useCallback((text, format) => { check(step, text, 'camera', format); }, [check, step]);
  useEffect(() => { if (!needsMed && step === 'med') { setStep('confirm'); setScanning(false); } if (needsMed && step === 'confirm' && !codes.med) { setStep(codes.patient ? 'med' : 'patient'); setScanning(camera && !manual); } }, [outcome]); // eslint-disable-line
  const verification = needsMed ? (source.patient === 'camera' && source.med === 'camera' ? 'camera' : 'manual') : (source.patient === 'camera' ? 'camera' : source.patient ? 'manual' : 'camera');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setResult(null);
    try { setResult(await api('meds', { medId: med.id, action: outcome, patientCode: codes.patient, medCode: codes.med, verification, patientScannedAt: stamps.patient, medScannedAt: stamps.med, reason: needsMed ? manualReason : reason, attemptId, acknowledgeAlerts: ack, overrideReason, indication: needsMed && prnLike ? indication : undefined, indicationValue: needsMed && prnLike ? indicationValue : undefined, submissionId: submissionId() })); }
    catch (e) { if (e.status === 409 && Array.isArray(e.data?.alerts)) { setServerAlerts(e.data.alerts); setAck(false); setResult(null); } else setResult({ error: e.message }); } finally { setBusy(false); }
  }
  const stepTitle = pass && step === 'med' ? 'Scan the medication label' : step === 'patient' ? (needsMed ? '1 of 3' : '1 of 2') + ' · Scan the patient wristband' : step === 'med' ? '2 of 3 · Scan the medication label' : needsMed ? '3 of 3 · Confirm and document' : outcome === 'held' ? '2 of 2 · Document held' : '2 of 2 · Document refused';
  const mustAck = needsMed && alerts.length > 0;
  return <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="give-title"><form className="dialog" onSubmit={submit}>
    <div className="section-heading"><h3 id="give-title">{med.name} {med.dose}</h3><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    {alerts.length > 0 && !result && <div className="alert-banner" role="alert"><strong>Review before giving</strong>{alerts.map(a => <p key={a.code}><b>{ALERT[a.code] || a.code}.</b> {a.text}</p>)}</div>}
    {result ? <div className={result.error || result.blocked ? 'error' : 'success'} role="alert"><strong>{result.error ? 'Not saved' : result.blocked ? 'Blocked' : 'Documented'}</strong>{!result.error && !result.blocked && result.entry.action === 'MED_GIVEN' && <p className="rights-line">Right patient · right drug · right dose · right route · right time: verified by scan.</p>}<p>{result.error || result.entry.text}</p>{!result.error && <p className="muted">This attempt is recorded in the evidence timeline.</p>}<div className="dialog-actions"><button type="button" className="primary" onClick={result.error ? () => setResult(null) : onDone}>{result.error ? 'Back' : result.blocked ? 'Close' : 'Done'}</button></div></div> : <>
      <div className="action-row" role="radiogroup" aria-label="Outcome">{[['given', 'Give'], ['held', 'Hold'], ['refused', 'Refused']].map(([k, l]) => <label key={k} className={`radio ${outcome === k ? 'selected' : ''}`}><input type="radio" name="outcome" value={k} checked={outcome === k} onChange={() => { setOutcome(k); if (k === 'held' && alerts.length && !reason) setReason(alerts.map(a => a.text).join(' ')); }}/>{l}</label>)}</div>
      <div className="steps" aria-hidden="true">{(needsMed ? ['patient','med','confirm'] : ['patient','confirm']).map((k, i) => <span key={k} className={step === k ? 'on' : (needsMed ? ['patient','med','confirm'] : ['patient','confirm']).indexOf(step) > i ? 'done' : ''}/>)}</div><h4 className="step-title">{stepTitle.replace(/^\d of \d · /, '')}</h4>
      {scanAlert && <div className="scan-alert" role="alert"><strong>Stop.</strong> {scanAlert}<div className="preset-row">{camera && !manual && <button type="button" className="primary" onClick={() => { setScanAlert(''); setScanning(true); }}>Rescan<Icon name="arrow"/></button>}{(manual || !camera) && <button type="button" className="secondary" onClick={() => setScanAlert('')}>Try again</button>}</div></div>}
      {step !== 'confirm' && <>
        {step === 'patient' ? <><p className="identify"><strong>{patient.name}</strong> · DOB {patient.dob}</p><p className="muted">Ask the patient to state name and date of birth, match them to the band, then scan it.</p></> : <p className="muted">Scan the label on the <strong>{med.name} {med.dose}</strong> package.</p>}
        {checking && <p className="muted">Checking…</p>}
        {scanning && !scanAlert && <Scanner key={step + codes.patient} ignore={step === 'med' ? codes.patient : codes.med} ignoreHint={step === 'med' ? 'That is the wristband. Now point at the medication label.' : 'That is the medication label. Point at the wristband first.'} label={step === 'patient' ? 'Scan wristband' : 'Scan medication label'} hint={step === 'patient' ? 'Point the camera at the wristband barcode.' : 'Point the camera at the medication label.'} onResult={onScan} onClose={() => setScanning(false)}/>}
        {!scanning && !manual && !scanAlert && <div className="preset-row">{camera ? <button type="button" className="primary" onClick={() => setScanning(true)}>Open camera<Icon name="arrow"/></button> : <p className="error">The camera is not available on this connection. {scanRequired ? 'Ask your instructor; scanning is required in this session.' : 'You can enter the code manually below.'}</p>}</div>}
        {!manual && !scanRequired && <p><button type="button" className="text-button" onClick={() => { setManual(true); setScanning(false); }}>Can’t scan? Enter the code manually</button></p>}
        {!scanRequired && !needsMed && step === 'patient' && <p><button type="button" className="text-button" onClick={() => { setStep('confirm'); setScanning(false); }}>Skip wristband (not recommended)</button></p>}
        {manual && !scanRequired && !scanAlert && <div className="scan-field"><label htmlFor={`code-${step}`}>{step === 'patient' ? 'Wristband code (manual)' : 'Medication label code (manual)'}</label><input id={`code-${step}`} value={draft} onChange={e => setDraft(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="Type the code printed under the barcode"/><div className="preset-row"><button type="button" className="secondary" disabled={!draft.trim() || checking} onClick={() => check(step, draft, 'manual')}>Next</button><button type="button" className="text-button" onClick={() => { setManual(false); setScanning(camera); }}>Back to camera</button></div></div>}
      </>}
      {step === 'confirm' && <>
        <div className="scanned">{codes.patient ? <div><span>Wristband</span><code>{verified.patient?.patient ? `${verified.patient.patient.name} · DOB ${verified.patient.patient.dob}` : codes.patient}</code><small>{source.patient === 'camera' ? `scanned ${new Date(stamps.patient).toLocaleTimeString()}` : 'typed'}</small><button type="button" className="text-button" onClick={() => { setStep('patient'); setScanning(camera && !manual); }}>Rescan</button></div> : <div><span>Wristband</span><code>not scanned</code><small>patient identification skipped</small></div>}{needsMed && <div><span>Label</span><code>{verified.med?.resolved || codes.med}</code><small>{source.med === 'camera' ? `scanned ${new Date(stamps.med).toLocaleTimeString()}` : 'typed'}</small><button type="button" className="text-button" onClick={() => { setStep('med'); setScanning(camera && !manual); }}>Rescan</button></div>}</div>
        {needsMed && <div className="rights"><h4>Five rights</h4><dl><dt>Patient</dt><dd>{patient.name} · DOB {patient.dob} · MRN {patient.mrn}</dd><dt>Drug</dt><dd>{med.name}</dd><dt>Dose</dt><dd>{med.dose}</dd><dt>Route</dt><dd>{med.route}</dd><dt>Time</dt><dd>{med.frequency}{med.holdRule ? ` · Hold for SBP below ${med.holdRule.sbpBelow}` : ''}</dd>{patient.allergies && <><dt>Allergies</dt><dd>{patient.allergies}</dd></>}</dl></div>}
        {needsMed && prnLike && <div className="indication"><label>Indication (why now)<input value={indication} onChange={e => setIndication(e.target.value)} maxLength={200} required placeholder={med.prn?.indication ? `e.g., ${med.prn.indication}` : 'what the patient reported or the parameter assessed'}/></label><label>Assessed value<input value={indicationValue} onChange={e => setIndicationValue(e.target.value)} maxLength={60} placeholder="e.g., pain 8/10, SBP 86"/></label></div>}
        {needsMed && verification === 'manual' && <label>Reason for manual entry<textarea value={manualReason} onChange={e => setManualReason(e.target.value)} rows={2} maxLength={500} required placeholder="e.g., camera would not read the label"/></label>}
        {mustAck && <div className="ack"><label className="check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)}/> I reviewed the alert{alerts.length > 1 ? 's' : ''} above and am giving anyway</label>{ack && <label>Reason for giving despite the alert<textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={2} maxLength={500} required placeholder="e.g., provider aware and ordered to proceed"/></label>}<p><button type="button" className="text-button" onClick={() => { setOutcome('held'); setReason(alerts.map(a => a.text).join(' ')); }}>Hold instead</button></p></div>}
        {!needsMed && <label>Reason<textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={500} required placeholder={outcome === 'held' ? 'e.g., SBP 86, hold rule' : 'e.g., patient declined after education'}/></label>}
        <div className="dialog-actions"><button className="primary" disabled={busy || (needsMed && (!codes.patient || !codes.med || (verification === 'manual' && !manualReason.trim()) || (prnLike && !indication.trim()) || (mustAck && (!ack || !overrideReason.trim())))) || (!needsMed && !reason.trim())}>{busy ? 'Saving…' : needsMed ? 'Document given' : outcome === 'held' ? 'Document held' : 'Document refused'}<Icon name="arrow"/></button></div>
        {needsMed && <p className="muted">The server re-checks both items against this patient and this medication at documentation.</p>}
      </>}
    </>}
  </form></div>;
}

// Instructor: map the barcode printed on a real sim item to the wristband or a scenario medication.
function BarcodeRegistry({ state, refresh, connected }) {
  const { scenario, barcodes = [] } = state, camera = cameraAvailable();
  const [code, setCode] = useState(''), [scanning, setScanning] = useState(false), [target, setTarget] = useState('patient'), [label, setLabel] = useState(''), [lookup, setLookup] = useState(null), [msg, setMsg] = useState('');
  const onScan = useCallback(text => { setCode(text); setScanning(false); }, []);
  useEffect(() => { let alive = true; if (!code.trim()) { setLookup(null); return; } const t = setTimeout(async () => { try { const r = await api(`barcodes/lookup?code=${encodeURIComponent(code.trim())}`); if (alive) setLookup(r); } catch {} }, 300); return () => { alive = false; clearTimeout(t); }; }, [code]);
  async function register(active = true, c = code, t = target) { setMsg(''); try { await api('barcodes', { code: c, targetType: t === 'patient' ? 'patient' : 'med', targetId: t === 'patient' ? 'patient' : t, label, active }); setCode(''); setLabel(''); setLookup(null); setMsg(active ? 'Registered.' : 'Removed.'); refresh(); } catch (e) { setMsg(e.message); } }
  return <div className="emar-group orders-admin"><h4>Physical barcodes</h4><p className="muted">Using real sim meds or a wristband with their own barcodes? Scan each one here once and assign it. The printable labels page works without this.</p>
    <div className="scan-row"><input value={code} onChange={e => setCode(e.target.value)} placeholder="Scan or type the code on the item" aria-label="Physical barcode" autoComplete="off"/>{camera && <button type="button" className="secondary" onClick={() => setScanning(true)}>Scan</button>}</div>
    {scanning && <Scanner label="Scan physical item" hint="Point the camera at the item's barcode." onResult={onScan} onClose={() => setScanning(false)}/>}
    {lookup && <small className={lookup.match ? 'warn' : 'ok'}>{lookup.match ? `Already resolves to ${lookup.match.label} (${lookup.match.source}).` : 'Unknown code: ready to register.'}</small>}
    <div className="preset-row"><select value={target} onChange={e => setTarget(e.target.value)} aria-label="Assign to"><option value="patient">Patient wristband</option>{scenario.medications.map(m => <option key={m.id} value={m.id}>{m.name} {m.dose}</option>)}</select><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Note (e.g., Demo Dose vial)" aria-label="Note" maxLength={120}/><button type="button" className="primary small" disabled={!code.trim() || !connected || (lookup?.match?.source === 'scenario')} onClick={() => register(true)}>Register</button></div>
    {barcodes.length > 0 && <table className="emar-table"><thead><tr><th>Code</th><th>Assigned to</th><th>Note</th><th></th></tr></thead><tbody>{barcodes.map(b => <tr key={b.id}><td><code>{b.code}</code></td><td>{b.target_type === 'patient' ? 'Patient wristband' : (scenario.medications.find(m => m.id === b.target_id) || {}).name || b.target_id}</td><td>{b.label}</td><td><button type="button" className="text-button" onClick={() => register(false, b.code, b.target_type === 'patient' ? 'patient' : b.target_id)}>Remove</button></td></tr>)}</tbody></table>}
    {msg && <p className={msg === 'Registered.' || msg === 'Removed.' ? 'success' : 'error'} role="status">{msg}</p>}
  </div>;
}
