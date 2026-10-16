import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { api } from './api';
import { Brand } from './components';

function Barcode({ value }) {
  const el = useRef(null);
  useEffect(() => { try { JsBarcode(el.current, value, { format: 'CODE128', displayValue: true, height: 46, width: 2, margin: 2, marginLeft: 20, marginRight: 20, fontSize: 12, font: 'monospace', background: '#ffffff' }); } catch {} }, [value]);
  return <svg ref={el} className="barcode" aria-label={`Barcode ${value}`}/>;
}
export default function Labels() {
  const [state, setState] = useState(null), [error, setError] = useState('');
  useEffect(() => { api('state').then(setState).catch(e => setError(e.status === 401 ? 'Sign in on the main page first, then reopen /labels.' : e.message)); }, []);
  if (error) return <div className="labels-page"><p className="error">{error}</p></div>;
  if (!state) return <div className="labels-page"><p>Loading…</p></div>;
  if (state.actor?.role !== 'instructor') return <div className="labels-page"><p className="error">Instructor sign-in is required to print labels.</p></div>;
  const { patient } = state.scenario, meds = state.scenario.medications, registered = id => (state.barcodes || []).filter(b => b.active && b.target_type === 'med' && b.target_id === id);
  return <div className="labels-page">
    <header className="labels-head no-print"><Brand/><div><h1>Printable labels</h1><p>Print on plain paper or label stock. Cut on the dashed lines and keep the white space on both sides of the bars; on a vial, lay the bars along the vial, not around it. Real sim items with their own barcodes: register them on the eMAR (Physical barcodes) instead of labelling them.</p></div><button className="primary" onClick={() => window.print()}>Print</button></header>
    <section className="label-grid">
      <article className="label wristband"><small>PATIENT WRISTBAND · SIMULATION</small><h2>{patient.name}</h2><p>DOB {patient.dob} · MRN {patient.mrn}</p><p>{patient.sex} · {patient.age} · Allergies: {patient.allergies}</p><Barcode value={patient.wristband}/></article>
      <article className="label wristband"><small>PATIENT WRISTBAND · SIMULATION (spare)</small><h2>{patient.name}</h2><p>DOB {patient.dob} · MRN {patient.mrn}</p><p>{patient.sex} · {patient.age} · Allergies: {patient.allergies}</p><Barcode value={patient.wristband}/></article>
      {meds.map(m => <article className="label" key={m.id}><small>SIMULATION MEDICATION · NOT FOR HUMAN USE</small><h2>{m.name}</h2><p>{m.dose} · {m.route}</p><p>{m.frequency}</p>{registered(m.id).map(b => <p key={b.id} className="registered">Registered package barcode: {b.code}{b.label ? ` (${b.label})` : ''}</p>)}<Barcode value={m.barcode}/></article>)}
    </section>
  </div>;
}
