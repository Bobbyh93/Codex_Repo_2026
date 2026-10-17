import React, { useEffect, useRef, useState } from 'react';
import { MonitorDisplay } from './Monitor';


// Kiosk page for the screen plugged into the Pi: /display. No sign-in; shows only the monitor.
export default function Display() {
  const [data, setData] = useState(null), [error, setError] = useState(''), offset = useRef(0), [, tick] = useState(0);
  useEffect(() => {
    let alive = true;
    async function load() { try { const r = await fetch('/api/display', { cache: 'no-store' }); const d = await r.json(); if (!alive) return; offset.current = Date.parse(d.server_now) - Date.now(); setData(d); setError(''); } catch { if (alive) setError('Reconnecting to the Code Shift server…'); } }
    load(); const poll = setInterval(load, 2000), t = setInterval(() => tick(n => n + 1), 500);
    return () => { alive = false; clearInterval(poll); clearInterval(t); };
  }, []);
  const now = Date.now() + offset.current;
  return <div className="display-page">
    <header><span>{data?.patient ? `${data.patient.name} · MRN ${data.patient.mrn}` : 'Code Shift'}</span><span>{data?.session ? `${data.session.group_name} · ${data.session.status}` : 'No active session'}</span></header>
    {data ? <MonitorDisplay vitals={data.vitals} rhythms={data.rhythms} now={now}/> : <p className="display-note">{error || 'Connecting…'}</p>}
    {error && data && <p className="display-note">{error}</p>}
  </div>;
}
