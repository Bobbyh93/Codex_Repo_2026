import React, { useEffect, useRef, useState } from 'react';
import { api, submissionId, formatTime } from './api';
import { Icon } from './components';

// Talk to the patient. Hold the button and speak; the Pi answers in the patient's voice for the current
// phase of the scenario and both sides are logged as cues gathered. Uses the browser's speech recognition
// and synthesis for the pilot; the room display speaks and captions the same exchange.
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export function speak(text) { try { if (!window.speechSynthesis) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.98; u.pitch = 0.9; const v = window.speechSynthesis.getVoices().find(v => /en/i.test(v.lang) && /male|david|daniel|alex|george|guy/i.test(v.name)); if (v) u.voice = v; window.speechSynthesis.speak(u); } catch {} }
export function Patient({ state, refresh, connected }) {
  const { entries, session, scenario } = state, active = session.status === 'active' && connected;
  const [listening, setListening] = useState(false), [heard, setHeard] = useState(''), [reply, setReply] = useState(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [typed, setTyped] = useState(''), [speakOnPhone, setSpeakOnPhone] = useState(true);
  const rec = useRef(null), supported = !!Recognition && globalThis.isSecureContext;
  const exchanges = entries.filter(e => e.action === 'PATIENT_ASKED'), said = id => entries.find(e => e.action === 'PATIENT_SAID' && e.linked_id === id), found = id => entries.find(e => e.action === 'EXAM_FINDING' && e.linked_id === id);
  async function ask(transcript, source) {
    if (!transcript.trim()) return; setBusy(true); setMsg(''); setHeard(transcript);
    try { const r = await api('patient/ask', { transcript, source, submissionId: submissionId() }); setReply(r); if (speakOnPhone) speak(r.reply); setTyped(''); refresh(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  function start() {
    if (!supported) return; setMsg('');
    const r = new Recognition(); rec.current = r; r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 1;
    let finalText = '';
    r.onresult = ev => { let interim = ''; for (const res of ev.results) { if (res.isFinal) finalText += res[0].transcript; else interim += res[0].transcript; } setHeard(finalText || interim); };
    r.onerror = ev => { setListening(false); setMsg(ev.error === 'not-allowed' ? 'Microphone permission was denied. Allow the microphone for this site.' : ev.error === 'network' ? 'Speech recognition needs a connection on this phone. Use a phone with on-device dictation, or the room microphone.' : 'Could not hear you: ' + ev.error); };
    r.onend = () => { setListening(false); if (finalText.trim()) ask(finalText.trim(), 'voice'); };
    try { r.start(); setListening(true); setHeard(''); setReply(null); } catch (e) { setMsg(e.message); }
  }
  function stop() { try { rec.current?.stop(); } catch {} }
  useEffect(() => () => { try { rec.current?.abort(); } catch {} }, []);
  return <><div className="page-heading compact"><h1>Talk to {scenario.patient.name.split(' ')[0]}</h1><p>Hold the button and speak, release. Ask questions, or say what you are examining ("let me listen to your lungs", "squeeze my hands"). The patient answers and the room display shows what you find.</p></div>
    <section className="panel talk">
      {supported ? <button type="button" className={`mic ${listening ? 'on' : ''}`} disabled={!active || busy} onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') start(); }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') stop(); }} aria-pressed={listening}><Icon name="mic"/><span>{listening ? 'Listening… release when done' : busy ? 'Patient is answering…' : 'Hold to talk'}</span></button>
        : <div className="error">This browser does not offer speech recognition. On the Pi, the room microphone handles this; for now you can type what you said.</div>}
      {!supported && <form className="scan-row" onSubmit={e => { e.preventDefault(); ask(typed, 'typed'); }}><input value={typed} onChange={e => setTyped(e.target.value)} placeholder="What did you ask the patient?" aria-label="What you said" maxLength={400}/><button className="secondary" disabled={!active || busy || !typed.trim()}>Ask</button></form>}
      {heard && <p className="heard"><span>You:</span> {heard}</p>}
      {reply && <div className="patient-says"><strong>{scenario.patient.name.split(' ')[0]}:</strong> {reply.reply}{reply.cues?.length > 0 && <small>Cue gathered: {reply.cues.join(', ')}</small>}</div>}
      {reply?.exam && <div className="exam-card"><span className="section-label">Assessment finding · {reply.exam.label}</span><p>{reply.exam.finding}</p><small>Shown on the room display{reply.exam.sound ? ' with sound' : ''}.</small></div>}
      {msg && <p className="error" role="alert">{msg}</p>}
      <label className="check"><input type="checkbox" checked={speakOnPhone} onChange={e => setSpeakOnPhone(e.target.checked)}/> Also play the patient's voice on this phone</label>
    </section>
    <section className="panel"><h4 className="section-label">Conversation this shift</h4>{exchanges.length ? exchanges.slice().reverse().map(e => { const s = said(e.id); return <article className="exchange" key={e.id}><small>{e.actor_name} · {formatTime(e.recorded_at)}</small><p className="q">{e.text.replace(/^Asked the patient( \(typed\))?: /, '').replace(/ · .*$/, '')}</p>{s && <p className="a">{s.text.replace(/^Patient: /, '').replace(/ · phase \w+( · brain \w+)?$/, '')}</p>}{found(e.id) && <p className="f">{found(e.id).text.replace(/ · system \w+ · phase \w+$/, '')}</p>}</article>; }) : <p className="muted">No conversation yet. Start with who you are and why you are here.</p>}</section></>;
}
