import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Login from './Login';
import { Chart, Setup, PatientBanner } from './Workspace';
import { Brand, Icon, Evidence } from './components';
import { Monitor } from './Monitor';
import { Emar } from './Emar';
import { Provider } from './Provider';
import { Orders } from './Orders';
import { Worklist } from './Worklist';
import Labels from './Labels';
import Display from './Display';
import Debrief from './Debrief';
import { api, submissionId } from './api';
import './styles.css';

const STUDENT_NAV = [['worklist', 'Worklist', 'timeline'], ['chart', 'Chart', 'chart'], ['meds', 'MAR', 'pill'], ['orders', 'Orders', 'setup'], ['provider', 'Provider', 'provider']];
const INSTRUCTOR_NAV = [['monitor', 'Monitor and events', 'monitor'], ['worklist', 'Worklist', 'timeline'], ['chart', 'Patient chart', 'chart'], ['meds', 'eMAR', 'pill'], ['orders', 'Orders', 'setup'], ['provider', 'Provider', 'provider'], ['timeline', 'Evidence timeline', 'timeline'], ['setup', 'Session', 'setup']];

function App() {
  const [state, setState] = useState(null), [loading, setLoading] = useState(true), [connected, setConnected] = useState(false), [page, setPage] = useState(null), [error, setError] = useState('');
  const chartAccess = useRef({});
  const refresh = useCallback(async () => { try { const next = await api('state'); setState(next); setConnected(true); setError(''); } catch(e) { if (e.status === 401) { setState(null); setError(''); } else { setConnected(false); setError('Connection interrupted. Saved entries remain on the server. Reconnecting…'); } } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!state?.actor) return;
    let socket, timer, closed = false;
    function connect() { if (closed) return; socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/live`); socket.onopen = refresh; socket.onmessage = refresh; socket.onclose = () => { if (!closed) { setConnected(false); timer = setTimeout(connect, 2000); } }; socket.onerror = () => socket.close(); }
    connect(); const poll = setInterval(refresh, 10000); window.addEventListener('online', refresh);
    return () => { closed = true; clearTimeout(timer); clearInterval(poll); socket?.close(); window.removeEventListener('online', refresh); };
  }, [state?.actor?.id, refresh]);
  useEffect(() => { if (page !== 'chart' || !state?.session || state.session.status !== 'active') return; const key = `${state.actor.id}:${state.session.id}`; if (chartAccess.current[key] === true) return; if (!chartAccess.current[key]) chartAccess.current[key] = submissionId(); api('entries', { action: 'CHART_OPENED', text: '', submissionId: chartAccess.current[key] }).then(() => { chartAccess.current[key] = true; refresh(); }).catch(() => {}); }, [page, state?.session?.id, state?.session?.status, state?.actor?.id, connected, refresh]);
  if (loading) return <div className="loading"><Brand/><p>Connecting to your local workspace…</p></div>;
  if (!state) return <Login refresh={refresh}/>;
  const instructor = state.actor.role === 'instructor', nav = instructor ? INSTRUCTOR_NAV : STUDENT_NAV;
  const activePage = !state.session ? 'setup' : (page || (instructor ? 'monitor' : 'worklist'));
  const content = activePage === 'setup' ? <Setup state={state} refresh={refresh}/>
    : activePage === 'chart' ? <Chart state={state} refresh={refresh} setPage={setPage} connected={connected}/>
    : activePage === 'meds' ? <><div className="page-heading compact"><h1>Medications</h1></div><Emar state={state} refresh={refresh} connected={connected}/></>
    : activePage === 'monitor' ? <Monitor state={state} refresh={refresh} connected={connected}/>
    : activePage === 'provider' ? <Provider state={state} refresh={refresh} connected={connected}/>
    : activePage === 'orders' ? <Orders state={state} refresh={refresh} connected={connected}/>
    : activePage === 'worklist' ? <Worklist state={state} refresh={refresh} connected={connected} setPage={setPage}/>
    : <><div className="page-heading heading-row"><div><h1>{instructor ? 'Evidence timeline' : 'Record'}</h1><p>Everything entered in this session, in order.</p></div>{instructor && <span className="preset-row"><a className="primary link-button" href="/debrief" target="_blank" rel="noopener">Debrief report <Icon name="arrow"/></a><a className="secondary link-button" href="/api/export">Export JSON <Icon name="arrow"/></a></span>}</div><section className="panel"><Evidence entries={state.entries} actor={state.actor} refresh={refresh}/></section></>;
  return <div className={`app-shell ${instructor ? 'role-instructor' : 'role-student'}`}>
    {instructor && <aside className="sidebar"><Brand/><nav aria-label="Workspace">{nav.map(([key, label, icon]) => <button key={key} className={activePage === key ? 'active' : ''} onClick={() => setPage(key)} disabled={!state.session && key !== 'setup'}><Icon name={icon}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><span className="local-mark">◉ Local workspace</span><small>Code Shift</small><button className="text-button" onClick={async () => { try { await api('logout', {}); setState(null); } catch(e) { setError(e.message); } }}>Leave workspace <Icon name="arrow"/></button></div></aside>}
    <div className="workspace">
      <header className="topbar"><span className="topbar-brand"><Brand/></span><span className="topbar-session">{state.session?.group_name || 'Create your practice session'}</span><div><span className="identity"><Icon name="user"/>{state.actor.name}</span><span className={`connection ${connected ? '' : 'disconnected'}`}><i/>{connected ? 'Connected' : 'Reconnecting'}</span><button className="text-button" onClick={async () => { try { await api('logout', {}); setState(null); } catch(e) { setError(e.message); } }}>Leave</button></div></header>
      {state.session && !instructor && <PatientBanner state={state}/>}
      <main className="content">{error && <p className="error connection-banner" role="alert">{error}</p>}{content}{instructor && <footer className="workspace-footer">Simulation only <span>Documentation records what was entered, not what was physically performed.</span></footer>}</main>
    </div>
    {state.session && <nav className="bottom-nav" aria-label="Workspace">{nav.map(([key, label, icon]) => <button key={key} className={activePage === key ? 'active' : ''} onClick={() => setPage(key)}><Icon name={icon}/><span>{label}</span>{key === 'orders' && (state.orders || []).some(o => o.source !== 'standing' && !o.acknowledged) && <i className="nav-dot" aria-hidden="true"/>}</button>)}</nav>}
  </div>;
}
const path = location.pathname.replace(/\/+$/, '');
createRoot(document.getElementById('root')).render(path === '/display' ? <Display/> : path === '/labels' ? <Labels/> : path === '/debrief' ? <Debrief/> : <App/>);
