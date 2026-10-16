import express from 'express';
import { createServer } from 'node:http';
import { createServer as createTlsServer } from 'node:https';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { scenario, studentView } from './scenario.js';
import { aiReply, aiConfigured } from './patientBrain.js';
import { RHYTHMS } from '../src/ecg/rhythms.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
mkdirSync(dataDir, { recursive: true });
const credentialFile = path.join(dataDir, 'instructor-key.txt');
if (!process.env.INSTRUCTOR_PASSWORD && !existsSync(credentialFile)) writeFileSync(credentialFile, randomBytes(18).toString('base64url'), { mode: 0o600 });
const password = process.env.INSTRUCTOR_PASSWORD || readFileSync(credentialFile, 'utf8').trim();
const salt = randomBytes(16), passwordHash = scryptSync(password, salt, 32);
const db = new DatabaseSync(path.join(dataDir, 'code-shift.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, group_name TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT NOT NULL, scenario_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS actors(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), name TEXT NOT NULL, role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY, actor_id TEXT, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS entries(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), actor_id TEXT NOT NULL REFERENCES actors(id), action TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('system_logged','instructor_observed')), text TEXT NOT NULL, recorded_at TEXT NOT NULL, observed_at TEXT, linked_id INTEGER REFERENCES entries(id), submission_id TEXT NOT NULL, private INTEGER NOT NULL DEFAULT 0, UNIQUE(actor_id, submission_id));
CREATE TABLE IF NOT EXISTS vitals(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), actor_id TEXT NOT NULL REFERENCES actors(id), entry_id INTEGER REFERENCES entries(id), hr INTEGER NOT NULL, rr INTEGER NOT NULL, spo2 INTEGER NOT NULL, sbp INTEGER NOT NULL, dbp INTEGER NOT NULL, temp REAL NOT NULL, rhythm TEXT NOT NULL, monitor_on INTEGER NOT NULL DEFAULT 1, transition_seconds INTEGER NOT NULL DEFAULT 0, from_hr INTEGER NOT NULL, from_rr INTEGER NOT NULL, from_spo2 INTEGER NOT NULL, from_sbp INTEGER NOT NULL, from_dbp INTEGER NOT NULL, from_temp REAL NOT NULL, applied_at TEXT NOT NULL, submission_id TEXT NOT NULL, UNIQUE(actor_id, submission_id));
CREATE TABLE IF NOT EXISTS med_events(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), actor_id TEXT NOT NULL REFERENCES actors(id), entry_id INTEGER NOT NULL REFERENCES entries(id), med_id TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('given','held','refused','blocked')), verification TEXT NOT NULL CHECK(verification IN ('camera','manual','none')), patient_code TEXT, med_code TEXT, reason TEXT, sbp_at INTEGER, recorded_at TEXT NOT NULL, submission_id TEXT NOT NULL, UNIQUE(actor_id, submission_id));
CREATE TRIGGER IF NOT EXISTS med_immutable_update BEFORE UPDATE ON med_events BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TRIGGER IF NOT EXISTS med_immutable_delete BEFORE DELETE ON med_events BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TRIGGER IF NOT EXISTS vitals_immutable_update BEFORE UPDATE ON vitals BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TRIGGER IF NOT EXISTS vitals_immutable_delete BEFORE DELETE ON vitals BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TRIGGER IF NOT EXISTS immutable_update BEFORE UPDATE ON entries BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TRIGGER IF NOT EXISTS immutable_delete BEFORE DELETE ON entries BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TABLE IF NOT EXISTS barcode_aliases(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, target_type TEXT NOT NULL CHECK(target_type IN ('patient','med')), target_id TEXT NOT NULL, label TEXT, registered_by TEXT, registered_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS med_scans(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), actor_id TEXT NOT NULL REFERENCES actors(id), attempt_id TEXT NOT NULL, med_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('patient','med')), code TEXT NOT NULL, format TEXT, source TEXT NOT NULL CHECK(source IN ('camera','manual')), matched INTEGER NOT NULL, resolved TEXT, scanned_at TEXT NOT NULL, entry_id INTEGER REFERENCES entries(id));
CREATE TRIGGER IF NOT EXISTS scans_immutable_update BEFORE UPDATE ON med_scans BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TRIGGER IF NOT EXISTS scans_immutable_delete BEFORE DELETE ON med_scans BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TABLE IF NOT EXISTS assessments(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), actor_id TEXT NOT NULL REFERENCES actors(id), entry_id INTEGER NOT NULL REFERENCES entries(id), type TEXT NOT NULL CHECK(type IN ('head_to_toe','focused')), systems TEXT NOT NULL, vitals_snapshot TEXT, recorded_at TEXT NOT NULL, submission_id TEXT NOT NULL, UNIQUE(actor_id, submission_id));
CREATE TRIGGER IF NOT EXISTS assess_immutable_update BEFORE UPDATE ON assessments BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TRIGGER IF NOT EXISTS assess_immutable_delete BEFORE DELETE ON assessments BEGIN SELECT RAISE(ABORT, 'Evidence is append-only'); END;
CREATE TABLE IF NOT EXISTS session_orders(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), category TEXT NOT NULL, text TEXT NOT NULL, source TEXT NOT NULL, placed_by TEXT NOT NULL, placed_at TEXT NOT NULL, entry_id INTEGER REFERENCES entries(id), acknowledged_by TEXT, acknowledged_at TEXT, ack_entry_id INTEGER);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), key TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, category TEXT, due_at TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','confirmed','flagged')), done_by TEXT, done_at TEXT, done_entry_id INTEGER, reviewed_by TEXT, reviewed_at TEXT, review_entry_id INTEGER, UNIQUE(session_id, key));
PRAGMA user_version=8;`);
for (const [table, column, ddl] of [['sessions', 'scan_required', "INTEGER NOT NULL DEFAULT 1"], ['med_events', 'patient_scanned_at', 'TEXT'], ['med_events', 'med_scanned_at', 'TEXT'], ['med_events', 'scan_order', 'TEXT'], ['med_events', 'attempt_id', 'TEXT'], ['med_events', 'patient_match', 'INTEGER'], ['med_events', 'alerts', 'TEXT'], ['med_events', 'override_reason', 'TEXT'], ['med_events', 'indication', 'TEXT'], ['med_events', 'indication_value', 'TEXT']]) if (!db.prepare(`SELECT 1 FROM pragma_table_info('${table}') WHERE name='${column}'`).get()) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
if (!db.prepare("SELECT 1 FROM pragma_table_info('sessions') WHERE name='active_meds'").get()) db.exec("ALTER TABLE sessions ADD COLUMN active_meds TEXT NOT NULL DEFAULT '[]'");
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; frame-ancestors 'none'");
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== `${req.protocol}://${req.headers.host}`) return res.status(403).json({ error: 'Cross-origin action rejected.' });
  next();
});
const tls = process.env.TLS_CERT && process.env.TLS_KEY ? { cert: readFileSync(process.env.TLS_CERT), key: readFileSync(process.env.TLS_KEY) } : null;
const http = tls ? createTlsServer(tls, app) : createServer(app);
const live = new WebSocketServer({ noServer: true });
const getToken = req => (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('cs_auth='))?.slice(8);
function identity(req) {
  const row = db.prepare('SELECT * FROM tokens WHERE token=? AND expires_at>?').get(getToken(req) || '', Date.now());
  if (!row) return null;
  if (!row.actor_id) return { role: 'instructor', id: null, name: 'Instructor' };
  return db.prepare('SELECT * FROM actors WHERE id=?').get(row.actor_id);
}
function auth(req, res, next) { req.actor = identity(req); if (!req.actor) return res.status(401).json({ error: 'Join or sign in to continue.' }); next(); }
function instructor(req, res, next) { if (req.actor.role !== 'instructor') return res.status(403).json({ error: 'Instructor access required.' }); next(); }
function cookie(res, actorId) { const token = randomBytes(32).toString('hex'); db.prepare('INSERT INTO tokens VALUES(?,?,?)').run(token, actorId, Date.now() + 12 * 3600000); res.cookie('cs_auth', token, { httpOnly: true, sameSite: 'strict', secure: !!tls || process.env.COOKIE_SECURE === '1', maxAge: 12 * 3600000 }); }
const latest = () => db.prepare('SELECT * FROM sessions ORDER BY rowid DESC LIMIT 1').get();
const roster = sid => db.prepare("SELECT id,name FROM actors WHERE session_id=? AND role='student'").all(sid);
// Rhythm ids and display names come from the shared table so the client select, the trace generator and the server validate the same list.
const VITAL_KEYS = ['hr','rr','spo2','sbp','dbp','temp'], VITAL_RANGES = { hr: [0, 300], rr: [0, 80], spo2: [0, 100], sbp: [0, 300], dbp: [0, 200], temp: [25, 45] };
const currentVitals = sid => db.prepare('SELECT * FROM vitals WHERE session_id=? ORDER BY id DESC LIMIT 1').get(sid) || null;
function effectiveVitals(v, now = Date.now()) {
  if (!v) return null;
  const t = v.transition_seconds ? Math.min(1, Math.max(0, (now - Date.parse(v.applied_at)) / (v.transition_seconds * 1000))) : 1;
  const out = { ...v };
  if (t < 1) for (const k of VITAL_KEYS) { const x = v['from_' + k] + (v[k] - v['from_' + k]) * t; out[k] = k === 'temp' ? Math.round(x * 10) / 10 : Math.round(x); }
  return out;
}
const medById = id => scenario.medications.find(m => m.id === id);
const activeMedIds = session => { let extra = []; try { extra = JSON.parse(session.active_meds || '[]'); } catch {} return scenario.medications.filter(m => m.kind !== 'assignable' || extra.includes(m.id)).map(m => m.id); };
const medLabel = m => `${m.name} ${m.dose} ${m.route}`;
const normalizeCode = c => String(c ?? '').trim().toUpperCase().replace(/\s+/g, '');
const aliases = () => db.prepare('SELECT * FROM barcode_aliases WHERE active=1 ORDER BY id').all();
function resolveCode(raw) {
  const code = normalizeCode(raw); if (!code) return null;
  if (code === normalizeCode(scenario.patient.wristband)) return { type: 'patient', code, source: 'scenario' };
  for (const m of scenario.medications) if ([m.barcode, ...(m.barcodes || [])].some(b => normalizeCode(b) === code)) return { type: 'med', med: m, code, source: 'scenario' };
  const a = db.prepare('SELECT * FROM barcode_aliases WHERE code=? AND active=1').get(code);
  if (a) return a.target_type === 'patient' ? { type: 'patient', code, source: 'registered' } : { type: 'med', med: medById(a.target_id), code, source: 'registered' };
  return null;
}
const stripCues = sc => ({ ...sc, events: (sc.events || []).map(({ cue, ...e }) => e) });
const stripCodes = sc => ({ ...sc, patient: (({ wristband, ...p }) => p)(sc.patient), medications: sc.medications.map(({ barcode, barcodes, ...m }) => m) });
const minutesAgo = iso => (Date.now() - Date.parse(iso)) / 60000;
function medAlerts(med, givenEvents, vitals) {
  const alerts = [], last = givenEvents.at(-1), fmt = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (med.once && givenEvents.length) alerts.push({ code: 'ALREADY_GIVEN', text: 'Already given at ' + fmt(last.recorded_at) + ' (order: once).' });
  if (med.intervalMin && last && minutesAgo(last.recorded_at) < med.intervalMin) alerts.push({ code: 'TOO_EARLY', text: 'Given ' + Math.round(minutesAgo(last.recorded_at)) + ' min ago; order interval is ' + (med.intervalMin >= 60 ? (med.intervalMin / 60) + ' h' : med.intervalMin + ' min') + '.' });
  if (med.prn?.minIntervalMin && last && minutesAgo(last.recorded_at) < med.prn.minIntervalMin) alerts.push({ code: 'TOO_EARLY', text: 'Last dose ' + Math.round(minutesAgo(last.recorded_at)) + ' min ago; order allows q' + med.prn.minIntervalMin + ' min.' });
  if (med.prn?.maxDoses && med.prn.windowMin) { const inWindow = givenEvents.filter(e => minutesAgo(e.recorded_at) < med.prn.windowMin).length; if (inWindow >= med.prn.maxDoses) alerts.push({ code: 'MAX_DOSES', text: inWindow + ' doses in the last ' + med.prn.windowMin + ' min; order maximum is ' + med.prn.maxDoses + '. Notify the provider.' }); }
  if (med.holdRule?.sbpBelow && vitals && vitals.monitor_on && Math.round(vitals.sbp) < med.holdRule.sbpBelow) alerts.push({ code: 'HOLD_RULE', text: 'SBP ' + Math.round(vitals.sbp) + ' is below ' + med.holdRule.sbpBelow + ': the order says hold.' });
  return alerts;
}
const alertLabel = { ALREADY_GIVEN: 'already given', TOO_EARLY: 'too early', MAX_DOSES: 'max doses reached', HOLD_RULE: 'hold rule' };
function ensureTask(sid, key, kind, title, category, dueAt) { if (!db.prepare('SELECT 1 FROM tasks WHERE session_id=? AND key=?').get(sid, key)) db.prepare('INSERT INTO tasks(session_id,key,kind,title,category,due_at,created_at) VALUES(?,?,?,?,?,?,?)').run(sid, key, kind, title, category, dueAt, new Date().toISOString()); }
function syncTasks(session) {
  const sid = session.id, start = Date.parse(session.started_at), iso = ms => new Date(ms).toISOString();
  const events = db.prepare("SELECT * FROM entries WHERE session_id=? AND action='EVENT_RELEASED' ORDER BY id").all(sid);
  const givenByMed = {}; for (const e of db.prepare("SELECT med_id, MIN(recorded_at) AS first FROM med_events WHERE session_id=? AND action='given' GROUP BY med_id").all(sid)) givenByMed[e.med_id] = e.first;
  for (const t of scenario.tasks || []) {
    const tr = t.trigger || {};
    if (tr.atMinutes != null) ensureTask(sid, t.id, 'nursing', t.title, t.category, iso(start + tr.atMinutes * 60000));
    else if (tr.afterMedGiven && givenByMed[tr.afterMedGiven]) ensureTask(sid, t.id, 'reassess', t.title, t.category, iso(Date.parse(givenByMed[tr.afterMedGiven]) + (tr.minutes || 0) * 60000));
    else if (tr.afterEvent) { const ev = (scenario.events || []).find(e => e.id === tr.afterEvent), rel = ev && events.find(e => e.text.startsWith(ev.title + ' \u00B7 ')); if (rel) ensureTask(sid, t.id, 'nursing', t.title, t.category, iso(Date.parse(rel.recorded_at) + (tr.minutes || 0) * 60000)); }
  }
  for (const e of events) ensureTask(sid, 'review-' + e.id, 'result', 'Review new result: ' + e.text.split(' \u00B7 ')[0], 'Results', e.recorded_at);
  const focused = db.prepare("SELECT * FROM tasks WHERE session_id=? AND key='t-focused' AND status='open'").get(sid);
  if (focused) { const found = db.prepare("SELECT e.text, e.actor_id, e.recorded_at, e.id FROM entries e WHERE e.session_id=? AND e.action='EXAM_FINDING' ORDER BY e.id").all(sid); const systems = new Set(found.map(f => (f.text.match(/ \u00B7 system (\w+)/) || [])[1])); if (['neuro', 'cardiac', 'resp'].every(x => systems.has(x))) { const last = found.at(-1); db.prepare("UPDATE tasks SET status='done', done_by=?, done_at=?, done_entry_id=? WHERE id=?").run(last.actor_id, last.recorded_at, last.id, focused.id); } }
}
function worklist(session) {
  syncTasks(session);
  const rows = db.prepare('SELECT t.*, d.name AS done_name, r.name AS reviewed_name FROM tasks t LEFT JOIN actors d ON d.id=t.done_by LEFT JOIN actors r ON r.id=t.reviewed_by WHERE t.session_id=? ORDER BY t.due_at, t.id').all(session.id);
  const meds = mar(session).filter(m => ['overdue', 'due', 'upcoming'].includes(m.window) && m.next_due).map(m => ({ key: 'med-' + m.id, kind: 'med', title: 'Give ' + m.name + ' ' + m.dose + ' ' + m.route, category: 'Medications', due_at: m.next_due, status: 'open', med_id: m.id }));
  const orders = activeOrders(session).filter(o => o.source !== 'standing' && !o.acknowledged).map(o => ({ key: 'ack-' + o.id, kind: 'order', title: 'Acknowledge new order: ' + o.text, category: o.category, due_at: o.placed_at, status: 'open', order_id: o.id }));
  return [...rows, ...meds, ...orders].sort((a, b) => a.due_at.localeCompare(b.due_at));
}
const ORDER_CATEGORIES = ['Medications', 'Labs', 'Diagnostics', 'Nursing', 'Protocols'];
function activeOrders(session) {
  const staticOrders = scenario.orders.flatMap(g => g.items.map((text, i) => ({ id: 'std-' + g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + i, category: g.category || 'Nursing', group: g.title, text, source: 'standing', placed_by: scenario.ordersMeta?.placedBy || 'Standing orders', placed_at: session.started_at, acknowledged: true })));
  const dyn = db.prepare('SELECT o.*, a.name AS acknowledged_name FROM session_orders o LEFT JOIN actors a ON a.id=o.acknowledged_by WHERE o.session_id=? ORDER BY o.id').all(session.id).map(o => ({ id: 'ord-' + o.id, category: o.category, group: 'New orders', text: o.text, source: o.source, placed_by: o.placed_by, placed_at: o.placed_at, acknowledged: !!o.acknowledged_at, acknowledged_name: o.acknowledged_name, acknowledged_at: o.acknowledged_at, row_id: o.id }));
  return [...dyn.reverse(), ...staticOrders];
}
function placeOrders(actor, sid, orders, placedBy, source, activateMeds) {
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid); let active = []; try { active = JSON.parse(s.active_meds || '[]'); } catch {}
  for (const o of orders || []) { const entry = append(actor, 'ORDER_PLACED', { submissionId: randomUUID(), text: 'New order (' + o.category + '): ' + o.text + ' \u00B7 ' + placedBy }); db.prepare('INSERT INTO session_orders(session_id,category,text,source,placed_by,placed_at,entry_id) VALUES(?,?,?,?,?,?,?)').run(sid, o.category, o.text, source, placedBy, entry.recorded_at, entry.id); }
  for (const id of activateMeds || []) { const m = medById(id); if (m && m.kind === 'assignable' && !active.includes(id)) { active.push(id); append(actor, 'MED_ORDER_CHANGED', { submissionId: randomUUID(), text: 'Order activated: ' + medLabel(m) + ' \u00B7 ' + placedBy }); } }
  db.prepare('UPDATE sessions SET active_meds=? WHERE id=?').run(JSON.stringify(active), sid);
}
function mar(session) {
  const ids = activeMedIds(session), events = db.prepare('SELECT e.*, a.name AS actor_name FROM med_events e JOIN actors a ON a.id=e.actor_id WHERE e.session_id=? ORDER BY e.id').all(session.id), vitalsNow = effectiveVitals(currentVitals(session.id)), mismatches = db.prepare('SELECT med_id, COUNT(*) AS n FROM med_scans WHERE session_id=? AND matched=0 GROUP BY med_id').all(session.id);
  return scenario.medications.filter(m => ids.includes(m.id)).map(m => {
    const mine = events.filter(e => e.med_id === m.id), last = mine.filter(e => e.action !== 'blocked').at(-1) || null, given = mine.filter(e => e.action === 'given').length;
    const givenList = mine.filter(e => e.action === 'given'), lastGiven = givenList.at(-1);
    let due_at = m.dueMinutes != null ? new Date(Date.parse(session.started_at) + m.dueMinutes * 60000).toISOString() : null;
    if (lastGiven && m.intervalMin) due_at = new Date(Date.parse(lastGiven.recorded_at) + m.intervalMin * 60000).toISOString();
    if (lastGiven && m.once) due_at = null;
    const minsToDue = due_at ? (Date.parse(due_at) - Date.now()) / 60000 : null;
    const window = m.kind === 'prn' ? 'prn' : (m.kind === 'stat' || m.kind === 'assignable') && !lastGiven ? 'due' : (m.frequency || '').toLowerCase().includes('continuous') && lastGiven ? 'continuous' : minsToDue == null ? 'complete' : minsToDue < -30 ? 'overdue' : minsToDue <= 30 ? 'due' : 'upcoming';
    return { ...m, due_at, window, last_given_at: lastGiven ? lastGiven.recorded_at : null, next_due: due_at, order_source: m.kind === 'assignable' ? 'Provider order' : (scenario.ordersMeta?.placedBy || 'Standing orders'), alerts: medAlerts(m, mine.filter(e => e.action === 'given'), vitalsNow), mismatchCount: mismatches.find(x => x.med_id === m.id)?.n || 0, givenCount: given, blockedCount: mine.filter(e => e.action === 'blocked').length, manualCount: mine.filter(e => e.action !== 'blocked' && e.verification === 'manual').length, last: last && { action: last.action, actor_name: last.actor_name, recorded_at: last.recorded_at, verification: last.verification, reason: last.reason, scan_order: last.scan_order }, status: last ? last.action : (m.kind === 'prn' ? 'available' : 'due') };
  });
}
const vitalsText = v => `HR ${v.hr} · RR ${v.rr} · SpO₂ ${v.spo2}% · BP ${v.sbp}/${v.dbp} · T ${v.temp} °C · ${RHYTHMS[v.rhythm]}`;
function snapshot(actor) {
  const session = actor.session_id ? db.prepare('SELECT * FROM sessions WHERE id=?').get(actor.session_id) : latest();
  if (!session) return { actor, session: null, scenario: actor.role === 'instructor' ? scenario : stripCodes(studentView(scenario)), rhythms: RHYTHMS, server_now: new Date().toISOString(), barcodes: actor.role === 'instructor' ? aliases() : undefined };
  const entries = db.prepare(`SELECT e.*, a.name AS actor_name FROM entries e JOIN actors a ON a.id=e.actor_id WHERE e.session_id=? ${actor.role === 'student' ? 'AND e.private=0' : ''} ORDER BY e.id`).all(session.id);
  return { actor, session, scenario: actor.role === 'instructor' ? scenario : stripCues(stripCodes(studentView(scenario))), rhythms: RHYTHMS, server_now: new Date().toISOString(), vitals: currentVitals(session.id), released: db.prepare("SELECT e.*, a.name AS actor_name FROM entries e JOIN actors a ON a.id=e.actor_id WHERE e.session_id=? AND e.action='EVENT_RELEASED' ORDER BY e.id").all(session.id), medications: actor.role === 'instructor' ? mar(session) : mar(session).map(({ barcode, barcodes, ...m }) => m), orders: activeOrders(session), worklist: worklist(session), barcodes: actor.role === 'instructor' ? aliases() : undefined, med_events: actor.role === 'instructor' ? db.prepare('SELECT e.*, a.name AS actor_name FROM med_events e JOIN actors a ON a.id=e.actor_id WHERE e.session_id=? ORDER BY e.id').all(session.id) : undefined, med_scans: actor.role === 'instructor' ? db.prepare('SELECT s.*, a.name AS actor_name FROM med_scans s JOIN actors a ON a.id=s.actor_id WHERE s.session_id=? ORDER BY s.id').all(session.id) : undefined, assessments: actor.role === 'instructor' ? db.prepare('SELECT x.*, a.name AS actor_name FROM assessments x JOIN actors a ON a.id=x.actor_id WHERE x.session_id=? ORDER BY x.id').all(session.id) : undefined, entries, roster: roster(session.id).map(a => ({ ...a, joined: !!db.prepare("SELECT id FROM entries WHERE actor_id=? AND action='STUDENT_JOINED' LIMIT 1").get(a.id) })) };
}
function broadcast() { for (const ws of live.clients) if (ws.readyState === 1) ws.send('refresh'); }
http.on('upgrade', (req, socket, head) => {
  if (req.url !== '/live' || !identity(req) || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) return socket.destroy();
  live.handleUpgrade(req, socket, head, ws => live.emit('connection', ws, req));
});
const required = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
function append(actor, action, body, privacy = false) {
  const prior = db.prepare('SELECT * FROM entries WHERE actor_id=? AND submission_id=?').get(actor.id, body.submissionId);
  if (prior) {
    if (prior.action !== action || prior.text !== (body.text || '').trim() || prior.linked_id !== (body.linkedId || null)) throw Object.assign(new Error('Submission ID already used for different content.'), { status: 409 });
    return prior;
  }
  const result = db.prepare('INSERT INTO entries(session_id,actor_id,action,source,text,recorded_at,observed_at,linked_id,submission_id,private) VALUES(?,?,?,?,?,?,?,?,?,?)').run(actor.session_id, actor.id, action, privacy ? 'instructor_observed' : 'system_logged', (body.text || '').trim(), new Date().toISOString(), privacy ? (body.observedAt || new Date().toISOString()) : null, body.linkedId || null, body.submissionId, privacy ? 1 : 0);
  return db.prepare('SELECT * FROM entries WHERE id=?').get(result.lastInsertRowid);
}
app.get('/api/lobby', (req, res) => { const s = latest(); res.json({ session: s ? { id: s.id, group_name: s.group_name, status: s.status } : null, roster: s ? roster(s.id) : [] }); });
const attempts = new Map();
app.post('/api/login', (req, res) => {
  const now = Date.now(), previous = attempts.get(req.ip), attempt = previous && previous.until > now ? previous : { count: 0, until: now + 60000 };
  attempts.set(req.ip, attempt);
  if (++attempt.count > 10) return res.status(429).json({ error: 'Too many attempts. Try again in one minute.' });
  if (!required(req.body.password, 256) || !timingSafeEqual(scryptSync(req.body.password, salt, 32), passwordHash)) return res.status(401).json({ error: 'Incorrect instructor key.' });
  attempts.delete(req.ip);
  const s = latest(), actor = s && db.prepare("SELECT * FROM actors WHERE session_id=? AND role='instructor'").get(s.id);
  cookie(res, actor?.id || null); res.json({ ok: true });
});
app.post('/api/join', (req, res) => {
  const s = latest();
  const actor = s && db.prepare("SELECT * FROM actors WHERE id=? AND session_id=? AND role='student'").get(req.body.actorId || '', s.id);
  if (!actor || s.status === 'ended') return res.status(400).json({ error: 'Choose a student in the current open session.' });
  append(actor, 'STUDENT_JOINED', { submissionId: 'first-join', text: 'Joined the shared practice session.' });
  cookie(res, actor.id); broadcast(); res.json({ ok: true });
});
app.post('/api/logout', auth, (req, res) => { db.prepare('DELETE FROM tokens WHERE token=?').run(getToken(req)); res.clearCookie('cs_auth'); res.json({ ok: true }); });
app.get('/api/state', auth, (req, res) => res.json(snapshot(req.actor)));
app.post('/api/sessions', auth, instructor, (req, res) => {
  if (latest()) return res.status(409).json({ error: 'This checkpoint supports one persistent session. The existing record is preserved.' });
  if (!required(req.body.groupName, 80) || !Array.isArray(req.body.names) || req.body.names.length !== 3 || req.body.names.some(n => !required(n, 60)) || new Set(req.body.names.map(n => n.trim().toLowerCase())).size !== 3) return res.status(400).json({ error: 'Enter a group name and three distinct student names.' });
  db.exec('BEGIN IMMEDIATE');
  try {
    const sid = randomUUID(), aid = randomUUID();
    const activeMeds = (Array.isArray(req.body.activeMeds) ? req.body.activeMeds : []).filter(id => medById(id)?.kind === 'assignable');
    db.prepare('INSERT INTO sessions(id,group_name,status,started_at,scenario_id,active_meds,scan_required) VALUES(?,?,?,?,?,?,?)').run(sid, req.body.groupName.trim(), 'active', new Date().toISOString(), scenario.id, JSON.stringify(activeMeds), req.body.scanRequired === false ? 0 : 1);
    const insert = db.prepare('INSERT INTO actors VALUES(?,?,?,?)');
    insert.run(aid, sid, 'Instructor', 'instructor');
    for (const name of req.body.names) insert.run(randomUUID(), sid, name.trim(), 'student');
    append({ id: aid, session_id: sid }, 'SESSION_CREATED', { submissionId: 'session-created', text: `Session created · ${scenario.name}` });
    db.exec('COMMIT'); cookie(res, aid); broadcast(); res.status(201).json({ ok: true });
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});
app.post('/api/entries', auth, (req, res) => {
  const actor = req.actor, b = req.body;
  if (!actor.session_id) return res.status(400).json({ error: 'Create a session first.' });
  if (!['NOTE_RECORDED', 'OBSERVATION_RECORDED', 'CHART_OPENED', 'CORRECTION_RECORDED', 'VITALS_RECORDED'].includes(b.action) || !required(b.submissionId, 100)) return res.status(400).json({ error: 'Invalid action or submission ID.' });
  if (['OBSERVATION_RECORDED', 'PROVIDER_REPLY'].includes(b.action) && actor.role !== 'instructor') return res.status(403).json({ error: 'Instructor access required.' });
  if (b.action === 'PROVIDER_REPLY' && !b.linkedId) return res.status(400).json({ error: 'A provider reply must reference a message.' });
  if (b.action === 'VITALS_RECORDED') { const v = currentVitals(actor.session_id); if (!v || !v.monitor_on) return res.status(400).json({ error: 'The monitor is not displaying vitals right now.' }); b.text = vitalsText(effectiveVitals(v)); b.linkedId = v.entry_id; }
  if (!['CHART_OPENED', 'VITALS_RECORDED'].includes(b.action) && !required(b.text)) return res.status(400).json({ error: 'Enter between 1 and 4,000 characters.' });
  if (b.observedAt && (!Number.isFinite(Date.parse(b.observedAt)) || Date.parse(b.observedAt) > Date.now())) return res.status(400).json({ error: 'Observation time must be a valid time no later than now.' });
  let linked;
  if (b.linkedId) linked = db.prepare('SELECT * FROM entries WHERE id=? AND session_id=?').get(b.linkedId, actor.session_id);
  if ((b.linkedId && (!linked || (linked.private && actor.role !== 'instructor'))) || (b.action === 'CORRECTION_RECORDED' && (!linked || linked.actor_id !== actor.id))) return res.status(400).json({ error: 'Corrections must reference your own entry in this session.' });
  const prior = db.prepare('SELECT id FROM entries WHERE actor_id=? AND submission_id=?').get(actor.id, b.submissionId);
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(actor.session_id);
  if (!prior && s.status !== 'active' && b.action !== 'OBSERVATION_RECORDED' && b.action !== 'CORRECTION_RECORDED') return res.status(409).json({ error: 'The session is paused or ended; new notes are disabled.' });
  const entry = append(actor, b.action, b, b.action === 'OBSERVATION_RECORDED' || !!linked?.private); broadcast(); res.status(prior ? 200 : 201).json({ entry });
});
app.post('/api/vitals', auth, instructor, (req, res) => {
  const b = req.body, sid = req.actor.session_id;
  if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  if (!required(b.submissionId, 100)) return res.status(400).json({ error: 'Invalid submission ID.' });
  const prior = db.prepare('SELECT * FROM vitals WHERE actor_id=? AND submission_id=?').get(req.actor.id, b.submissionId);
  if (prior) return res.json({ vitals: prior });
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid);
  if (s.status === 'ended') return res.status(409).json({ error: 'The session has ended; the monitor is frozen.' });
  const values = {};
  for (const k of VITAL_KEYS) { const n = Number(b[k]); const [lo, hi] = VITAL_RANGES[k]; if (!Number.isFinite(n) || n < lo || n > hi) return res.status(400).json({ error: `${k.toUpperCase()} must be a number between ${lo} and ${hi}.` }); values[k] = k === 'temp' ? Math.round(n * 10) / 10 : Math.round(n); }
  if (values.sbp > 0 && values.dbp >= values.sbp) return res.status(400).json({ error: 'Diastolic must be below systolic.' });
  if (!RHYTHMS[b.rhythm]) return res.status(400).json({ error: 'Choose a rhythm from the list.' });
  const transition = Math.round(Number(b.transitionSeconds) || 0); if (transition < 0 || transition > 900) return res.status(400).json({ error: 'Trend time must be 0-900 seconds.' });
  const monitorOn = b.monitorOn !== false ? 1 : 0, from = effectiveVitals(currentVitals(sid)) || values;
  db.exec('BEGIN IMMEDIATE');
  try {
    const entry = append(req.actor, 'VITALS_SET', { submissionId: b.submissionId, text: `${monitorOn ? 'Monitor set: ' : 'Monitor off (leads off). Stored values: '}${vitalsText({ ...values, rhythm: b.rhythm })}${transition ? ` · trend over ${transition} s` : ''}` });
    const r = db.prepare('INSERT INTO vitals(session_id,actor_id,entry_id,hr,rr,spo2,sbp,dbp,temp,rhythm,monitor_on,transition_seconds,from_hr,from_rr,from_spo2,from_sbp,from_dbp,from_temp,applied_at,submission_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sid, req.actor.id, entry.id, values.hr, values.rr, values.spo2, values.sbp, values.dbp, values.temp, b.rhythm, monitorOn, transition, from.hr, from.rr, from.spo2, from.sbp, from.dbp, from.temp, new Date().toISOString(), b.submissionId);
    db.exec('COMMIT'); broadcast(); res.status(201).json({ vitals: db.prepare('SELECT * FROM vitals WHERE id=?').get(r.lastInsertRowid) });
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});
app.post('/api/meds', auth, (req, res) => {
  const b = req.body, actor = req.actor, sid = actor.session_id;
  if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  if (!required(b.submissionId, 100)) return res.status(400).json({ error: 'Invalid submission ID.' });
  const prior = db.prepare('SELECT * FROM med_events WHERE actor_id=? AND submission_id=?').get(actor.id, b.submissionId);
  if (prior) return res.json({ event: prior, entry: db.prepare('SELECT * FROM entries WHERE id=?').get(prior.entry_id) });
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid);
  if (s.status !== 'active') return res.status(409).json({ error: 'The session is paused or ended; medication documentation is disabled.' });
  const med = medById(b.medId);
  if (!med || !activeMedIds(s).includes(med.id)) return res.status(400).json({ error: 'That medication is not an active order in this session.' });
  if (!['given', 'held', 'refused'].includes(b.action)) return res.status(400).json({ error: 'Choose given, held, or refused.' });
  const verification = b.verification === 'camera' ? 'camera' : 'manual', reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 500) : '';
  if (b.action !== 'given' && !reason) return res.status(400).json({ error: 'Enter the reason the medication was ' + b.action + '.' });
  const patientCode = normalizeCode(b.patientCode), medCode = normalizeCode(b.medCode);
  const iso = x => typeof x === 'string' && Number.isFinite(Date.parse(x)) && Date.parse(x) <= Date.now() + 60000 ? new Date(Date.parse(x)).toISOString() : null;
  const patientScannedAt = iso(b.patientScannedAt), medScannedAt = iso(b.medScannedAt);
  let action = b.action, blockReason = '', scanOrder = null, scanGap = null, patientMatch = null;
  const attemptId = typeof b.attemptId === 'string' ? b.attemptId.slice(0, 100) : null;
  if (action === 'given' && (!patientCode || !medCode)) return res.status(400).json({ error: 'Scan the patient wristband and the medication label before documenting.' });
  if (action !== 'given' && !patientCode && s.scan_required) return res.status(400).json({ error: 'Scan the patient wristband before documenting a held or refused medication.' });
  if ((patientCode || medCode) && verification !== 'camera') {
    if (s.scan_required) return res.status(400).json({ error: 'This session requires scanning. Ask your instructor if the camera is not working.' });
    if (!reason && action === 'given') return res.status(400).json({ error: 'Manual entry needs a reason (for example: camera would not read the label).' });
  }
  if (patientCode) { const p = resolveCode(patientCode); patientMatch = p && p.type === 'patient' ? 1 : 0; if (!patientMatch) blockReason = (p ? 'WRONG PATIENT: code "' + patientCode + '" is a medication label (' + medLabel(p.med) + ').' : 'UNRECOGNIZED WRISTBAND: code "' + patientCode + '" is not this patient\'s wristband.'); }
  if (!blockReason && action === 'given') { const m = resolveCode(medCode); if (!m || m.type !== 'med' || m.med.id !== med.id) blockReason = m ? 'WRONG MEDICATION: label "' + medCode + '" is ' + (m.type === 'med' ? medLabel(m.med) : 'the patient wristband') + ', not ' + medLabel(med) + '.' : 'UNRECOGNIZED LABEL: code "' + medCode + '" is not a known medication (register it on the eMAR if it is a real item).'; }
  if (blockReason) action = 'blocked';
  if (patientScannedAt && medScannedAt) { scanGap = Math.round((Date.parse(medScannedAt) - Date.parse(patientScannedAt)) / 1000); scanOrder = scanGap >= 0 ? 'patient_first' : 'med_first'; }
  const indication = typeof b.indication === 'string' ? b.indication.trim().slice(0, 200) : '', indicationValue = typeof b.indicationValue === 'string' ? b.indicationValue.trim().slice(0, 60) : '';
  if (action === 'given' && (med.kind === 'prn' || med.kind === 'stat') && !indication) return res.status(400).json({ error: 'Enter the indication for this PRN/STAT medication (what the patient reported or the parameter you assessed).' });
  const givenEvents = db.prepare("SELECT * FROM med_events WHERE session_id=? AND med_id=? AND action='given' ORDER BY id").all(sid, med.id), liveVitals = effectiveVitals(currentVitals(sid));
  const alerts = medAlerts(med, givenEvents, liveVitals), overrideReason = typeof b.overrideReason === 'string' ? b.overrideReason.trim().slice(0, 500) : '';
  if (action === 'given' && alerts.length && (b.acknowledgeAlerts !== true || !overrideReason)) return res.status(409).json({ error: 'Review the alert' + (alerts.length > 1 ? 's' : '') + ' before giving: ' + alerts.map(a => a.text).join(' ') + ' To give anyway, acknowledge and enter a reason; otherwise document held.', alerts });
  const v = liveVitals, sbp = v && v.monitor_on ? Math.round(v.sbp) : null;
  const holdFlag = action === 'given' && alerts.length ? ' \u00B7 ALERTS OVERRIDDEN (' + overrideReason + '): ' + alerts.map(a => (alertLabel[a.code] || a.code) + ' \u2014 ' + a.text).join(' ') : action !== 'given' && action !== 'blocked' && alerts.length ? ' \u00B7 alerts at the time: ' + alerts.map(a => a.text).join(' ') : '';
  const holdState = med.holdRule?.sbpBelow ? (sbp == null ? (v ? ' \u00B7 hold rule not evaluated (monitor off)' : ' \u00B7 hold rule not evaluated (no vitals set)') : sbp < med.holdRule.sbpBelow ? '' : ' \u00B7 hold rule not met (SBP ' + sbp + ', order holds below ' + med.holdRule.sbpBelow + ')') : '';
  const patientIdText = action === 'held' || action === 'refused' ? (patientMatch ? ' \u00B7 patient identified by wristband ' + (verification === 'camera' ? 'scan' : 'entry') : ' \u00B7 patient not scanned') : '';
  const seqFlag = scanOrder === 'med_first' ? ' \u00B7 SEQUENCE: medication scanned before patient' : scanOrder === 'patient_first' ? ' \u00B7 wristband then label, ' + Math.abs(scanGap) + ' s apart' : '';
  const howVerified = verification === 'camera' ? 'camera scan' : 'MANUAL ENTRY (' + reason + ')';
  const text = action === 'blocked' ? 'Administration blocked \u00B7 ' + medLabel(med) + ' \u00B7 ' + blockReason + ' \u00B7 ' + howVerified + seqFlag
    : action === 'given' ? 'Given: ' + medLabel(med) + ' \u00B7 patient + medication verified by ' + howVerified + seqFlag + (indication ? ' \u00B7 indication: ' + indication + (indicationValue ? ' ' + indicationValue : '') : '') + (sbp != null ? ' \u00B7 SBP ' + sbp : '') + holdFlag + holdState
    : (action === 'held' ? 'Held: ' : 'Refused: ') + medLabel(med) + ' \u00B7 ' + reason + patientIdText + (sbp != null ? ' \u00B7 SBP ' + sbp : '') + holdFlag + holdState;
  const entryAction = { given: 'MED_GIVEN', held: 'MED_HELD', refused: 'MED_REFUSED', blocked: 'MED_BLOCKED' }[action];
  db.exec('BEGIN IMMEDIATE');
  try {
    const entry = append(actor, entryAction, { submissionId: b.submissionId, text, linkedId: v?.entry_id || null });
    const r = db.prepare('INSERT INTO med_events(session_id,actor_id,entry_id,med_id,action,verification,patient_code,med_code,reason,sbp_at,recorded_at,submission_id,patient_scanned_at,med_scanned_at,scan_order,attempt_id,patient_match,alerts,override_reason,indication,indication_value) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sid, actor.id, entry.id, med.id, action, patientCode || medCode ? verification : 'none', patientCode || null, medCode || null, blockReason || reason || null, sbp, entry.recorded_at, b.submissionId, patientScannedAt, medScannedAt, scanOrder, attemptId, patientMatch, alerts.length ? JSON.stringify(alerts) : null, overrideReason || null, indication || null, indicationValue || null);
    db.exec('COMMIT'); broadcast();
    res.status(201).json({ event: db.prepare('SELECT * FROM med_events WHERE id=?').get(r.lastInsertRowid), entry, blocked: action === 'blocked' });
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});
const SYSTEM_NAMES = { neuro: 'Neuro', cardiac: 'Cardiovascular', resp: 'Respiratory', gi: 'GI', gu: 'GU', skin: 'Skin', msk: 'Musculoskeletal', pain: 'Pain', psych: 'Psychosocial/safety' };
function applyVitals(actor, sid, values, transition, submissionId) {
  const from = effectiveVitals(currentVitals(sid)) || values, monitorOn = 1;
  const entry = append(actor, 'VITALS_SET', { submissionId, text: 'Monitor set: ' + vitalsText(values) + (transition ? ' \u00B7 trend over ' + transition + ' s' : '') });
  db.prepare('INSERT INTO vitals(session_id,actor_id,entry_id,hr,rr,spo2,sbp,dbp,temp,rhythm,monitor_on,transition_seconds,from_hr,from_rr,from_spo2,from_sbp,from_dbp,from_temp,applied_at,submission_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sid, actor.id, entry.id, values.hr, values.rr, values.spo2, values.sbp, values.dbp, values.temp, values.rhythm, monitorOn, transition, from.hr, from.rr, from.spo2, from.sbp, from.dbp, from.temp, new Date().toISOString(), submissionId);
  return entry;
}
app.post('/api/provider', auth, (req, res) => {
  const sid = req.actor.session_id, sc = scenario.providerScript || {}, s = sc.situations?.find(x => x.id === req.body.situationId), r = sc.recommendations?.find(x => x.id === req.body.recommendationId);
  if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  if (!s || !r || !required(req.body.submissionId, 100)) return res.status(400).json({ error: 'Choose a situation and a recommendation.' });
  const sess = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid); if (sess.status !== 'active') return res.status(409).json({ error: 'The session is paused or ended.' });
  const v = effectiveVitals(currentVitals(sid)), vit = v && v.monitor_on ? ' \u00B7 Monitor: HR ' + Math.round(v.hr) + ', RR ' + Math.round(v.rr) + ', SpO\u2082 ' + Math.round(v.spo2) + '%, BP ' + Math.round(v.sbp) + '/' + Math.round(v.dbp) + ', ' + RHYTHMS[v.rhythm] : '';
  const entry = append(req.actor, 'PROVIDER_MESSAGE', { submissionId: req.body.submissionId, text: 'S: ' + s.title + ' \u2014 ' + s.text + ' \u00B7 B: ' + scenario.patient.name + ', ' + scenario.patient.age + ', admitted with ' + scenario.admission.diagnosis + vit + ' \u00B7 R: ' + r.title + (r.text ? ' (' + r.text + ')' : ''), linkedId: v?.entry_id || null });
  broadcast(); res.status(201).json({ entry });
});
app.post('/api/provider/reply', auth, instructor, (req, res) => {
  const sid = req.actor.session_id, r = (scenario.providerScript?.replies || []).find(x => x.id === req.body.replyId);
  if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  const m = db.prepare("SELECT * FROM entries WHERE id=? AND session_id=? AND action='PROVIDER_MESSAGE'").get(req.body.messageId, sid);
  if (!m || !r || !required(req.body.submissionId, 100)) return res.status(400).json({ error: 'Choose a reply for a message in this session.' });
  const prior = db.prepare('SELECT * FROM entries WHERE actor_id=? AND submission_id=?').get(req.actor.id, req.body.submissionId); if (prior) return res.json({ entry: prior });
  db.exec('BEGIN IMMEDIATE');
  let entry; try { entry = append(req.actor, 'PROVIDER_REPLY', { submissionId: req.body.submissionId, text: 'Provider: ' + r.title + (r.text ? ' \u00B7 ' + r.text : ''), linkedId: m.id }); placeOrders(req.actor, sid, r.orders, 'Provider (telephone order, read back)', 'provider_reply', r.activateMeds); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  broadcast(); res.status(201).json({ entry });
});
function patientPhase(sid) {
  const pv = scenario.patientVoice || {}, rel = db.prepare("SELECT text FROM entries WHERE session_id=? AND action='EVENT_RELEASED' ORDER BY id DESC").all(sid);
  for (const r of rel) { const ev = (scenario.events || []).find(e => r.text.startsWith(e.title + ' \u00B7 ')); if (ev && pv.phases?.[ev.id]) return pv.phases[ev.id]; }
  return 'baseline';
}
function matchIntent(transcript) {
  const t = ' ' + String(transcript || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  let best = null, bestScore = 0;
  for (const it of (scenario.patientVoice?.intents || [])) { let score = 0; for (const k of it.keywords) if (t.includes(k.toLowerCase().trim() ? (k.startsWith(' ') ? k : k) : k)) score += k.length; if (score > bestScore) { bestScore = score; best = it; } }
  return bestScore > 0 ? best : null;
}
app.post('/api/patient/ask', auth, async (req, res, next) => { try {
  const sid = req.actor.session_id; if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid); if (s.status !== 'active') return res.status(409).json({ error: 'The session is paused or ended.' });
  const transcript = typeof req.body.transcript === 'string' ? req.body.transcript.trim().slice(0, 400) : '', source = req.body.source === 'typed' ? 'typed' : 'voice';
  if (!transcript || !required(req.body.submissionId, 100)) return res.status(400).json({ error: 'Nothing heard.' });
  const prior = db.prepare('SELECT * FROM entries WHERE actor_id=? AND submission_id=?').get(req.actor.id, req.body.submissionId);
  if (prior) { const said = db.prepare("SELECT * FROM entries WHERE linked_id=? AND action='PATIENT_SAID'").get(prior.id); return res.json({ heard: transcript, reply: said ? said.text.replace(/^Patient: /, '') : '', intent: null, cues: [] }); }
  const phase = patientPhase(sid), pv = scenario.patientVoice || {};
  const tl = ' ' + transcript.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  let exam = null, examScore = 0; for (const x of (scenario.exam || [])) { let sc = 0; for (const k of x.keywords) if (tl.includes(' ' + k.toLowerCase() + ' ') || tl.includes(k.toLowerCase())) sc += k.length; if (sc > examScore) { examScore = sc; exam = x; } }
  const intent = exam ? null : matchIntent(transcript);
  const finding = exam ? (exam.finding[phase] || exam.finding.default) : null;
  let reply = null, brain = 'scripted';
  if (aiConfigured()) {
    try {
      const v = effectiveVitals(currentVitals(sid)), vit = v && v.monitor_on ? { hr: Math.round(v.hr), rr: Math.round(v.rr), spo2: Math.round(v.spo2), sbp: Math.round(v.sbp), dbp: Math.round(v.dbp), rhythm: RHYTHMS[v.rhythm] } : null;
      const recent = db.prepare("SELECT text FROM entries WHERE session_id=? AND action IN ('EVENT_RELEASED','MED_GIVEN','MED_HELD','PROVIDER_REPLY') ORDER BY id DESC LIMIT 6").all(sid).map(e => e.text.slice(0, 160)).reverse();
      const medsGiven = db.prepare("SELECT m.med_id, m.recorded_at FROM med_events m WHERE m.session_id=? AND m.action='given' ORDER BY m.id").all(sid).map(m => { const d = medById(m.med_id); return (d ? medLabel(d) : m.med_id) + ' at ' + new Date(m.recorded_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); });
      const hist = db.prepare("SELECT a.text AS q, s.text AS a FROM entries a JOIN entries s ON s.linked_id=a.id AND s.action='PATIENT_SAID' WHERE a.session_id=? AND a.action='PATIENT_ASKED' ORDER BY a.id DESC LIMIT 12").all(sid).reverse().map(h => ({ q: h.q.replace(/^Asked the patient( \(typed\))?: "/, '').replace(/" \u00B7 .*$/, ''), a: h.a.replace(/^Patient: /, '').replace(/ \u00B7 (phase|brain) .*$/, '') }));
      const phaseGuide = { baseline: 'Dull aching chest pressure about 4/10 on and off, mildly short of breath, anxious, understating it.', chestpain: 'Severe squeezing chest pain 8/10 radiating to the left arm and jaw, diaphoretic, short of breath, frightened.', hypotension: 'Pain somewhat better after nitroglycerin but you are light-headed, weak, the room spun when you sat up; headache.', rhythm: 'Heart pounding and fluttering in your throat, light-headed, scared something is badly wrong.', improving: 'Pain down to about 2/10, breathing easier, relieved, asking what happens next.' }[phase] || '';
      reply = await aiReply({ scenario, ctx: { phase, phaseGuide: phaseGuide + (exam ? ' The nurse is now performing this exam: ' + exam.label + '. Respond as the patient being examined (cooperate, breathe, squeeze, answer orientation questions); do not describe clinical findings yourself.' : ''), vitals: vit, recent, medsGiven }, history: hist, transcript });
      if (reply) brain = 'ai';
    } catch (e) { console.error('AI patient unavailable, using script: ' + (e.message || e)); }
  }
  if (!reply) reply = exam ? (exam.patient[phase] || exam.patient.default) : intent ? (intent.reply[phase] || intent.reply.default) : pv.unknown[Math.floor(Math.random() * pv.unknown.length)];
  db.exec('BEGIN IMMEDIATE');
  try {
    const asked = append(req.actor, 'PATIENT_ASKED', { submissionId: req.body.submissionId, text: 'Asked the patient' + (source === 'typed' ? ' (typed)' : '') + ': "' + transcript + '"' + (exam ? ' \u00B7 exam: ' + exam.label : intent ? ' \u00B7 cue: ' + intent.cues.join(', ') : ' \u00B7 not understood') });
    if (exam) append(req.actor, 'EXAM_FINDING', { submissionId: 'exam-' + req.body.submissionId, text: exam.label + ': ' + finding + ' \u00B7 system ' + exam.system + ' \u00B7 phase ' + phase, linkedId: asked.id });
    append(req.actor, 'PATIENT_SAID', { submissionId: 'said-' + req.body.submissionId, text: 'Patient: ' + reply + ' \u00B7 phase ' + phase + ' \u00B7 brain ' + brain, linkedId: asked.id });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  broadcast(); res.status(201).json({ heard: transcript, reply, intent: intent ? intent.id : null, cues: exam ? [exam.label] : intent ? intent.cues : [], phase, brain, exam: exam ? { id: exam.id, label: exam.label, system: exam.system, finding, sound: exam.sound } : null });
  } catch (e) { next(e); }
});
app.post('/api/tasks/done', auth, (req, res) => {
  const sid = req.actor.session_id; if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid); if (s.status !== 'active') return res.status(409).json({ error: 'The session is paused or ended.' });
  syncTasks(s); const t = db.prepare('SELECT * FROM tasks WHERE session_id=? AND key=?').get(sid, String(req.body.key || ''));
  if (!t) return res.status(400).json({ error: 'Unknown task.' });
  if (t.status !== 'open') return res.json({ ok: true, already: true });
  const v = effectiveVitals(currentVitals(sid)), late = Math.round((Date.now() - Date.parse(t.due_at)) / 60000);
  db.exec('BEGIN IMMEDIATE');
  try { const entry = append(req.actor, 'TASK_DONE', { submissionId: 'task-' + t.id + '-' + req.actor.id, text: 'Done: ' + t.title + (late > 5 ? ' \u00B7 ' + late + ' min after due' : '') + (v && v.monitor_on ? ' \u00B7 monitor: HR ' + Math.round(v.hr) + ', SpO\u2082 ' + Math.round(v.spo2) + '%, BP ' + Math.round(v.sbp) + '/' + Math.round(v.dbp) : ''), linkedId: v?.entry_id || null }); db.prepare("UPDATE tasks SET status='done', done_by=?, done_at=?, done_entry_id=? WHERE id=?").run(req.actor.id, entry.recorded_at, entry.id, t.id); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  broadcast(); res.json({ ok: true });
});
app.post('/api/tasks/review', auth, instructor, (req, res) => {
  const sid = req.actor.session_id; if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  const t = db.prepare('SELECT * FROM tasks WHERE session_id=? AND key=?').get(sid, String(req.body.key || '')), status = req.body.status;
  if (!t || !['confirmed', 'flagged'].includes(status) || t.status === 'open') return res.status(400).json({ error: 'Choose confirmed or flagged for a task the student marked done.' });
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
  db.exec('BEGIN IMMEDIATE');
  try { const entry = append(req.actor, status === 'confirmed' ? 'TASK_CONFIRMED' : 'TASK_FLAGGED', { submissionId: 'review-' + t.id + '-' + randomUUID().slice(0, 8), text: (status === 'confirmed' ? 'Confirmed: ' : 'Flagged: ') + t.title + (note ? ' \u00B7 ' + note : ''), linkedId: t.done_entry_id }); db.prepare('UPDATE tasks SET status=?, reviewed_by=?, reviewed_at=?, review_entry_id=? WHERE id=?').run(status, req.actor.id, entry.recorded_at, entry.id, t.id); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  broadcast(); res.json({ ok: true });
});
app.post('/api/orders/ack', auth, (req, res) => {
  const sid = req.actor.session_id, id = Number(String(req.body.orderId || '').replace(/^ord-/, ''));
  if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  const o = db.prepare('SELECT * FROM session_orders WHERE id=? AND session_id=?').get(id, sid);
  if (!o) return res.status(400).json({ error: 'Unknown order.' });
  if (o.acknowledged_at) return res.json({ ok: true, already: true });
  db.exec('BEGIN IMMEDIATE');
  try { const entry = append(req.actor, 'ORDER_ACKNOWLEDGED', { submissionId: 'ack-' + o.id + '-' + req.actor.id, text: 'Order acknowledged: ' + o.text, linkedId: o.entry_id }); db.prepare('UPDATE session_orders SET acknowledged_by=?, acknowledged_at=?, ack_entry_id=? WHERE id=?').run(req.actor.id, entry.recorded_at, entry.id, o.id); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  broadcast(); res.json({ ok: true });
});
app.post('/api/events/release', auth, instructor, (req, res) => {
  const sid = req.actor.session_id, ev = (scenario.events || []).find(e => e.id === req.body.eventId);
  if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  if (!ev || !required(req.body.submissionId, 100)) return res.status(400).json({ error: 'Unknown scenario event.' });
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid); if (s.status === 'ended') return res.status(409).json({ error: 'The session has ended.' });
  const prior = db.prepare('SELECT * FROM entries WHERE actor_id=? AND submission_id=?').get(req.actor.id, req.body.submissionId);
  if (prior) return res.json({ entry: prior });
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
  db.exec('BEGIN IMMEDIATE');
  try {
    const entry = append(req.actor, 'EVENT_RELEASED', { submissionId: req.body.submissionId, text: ev.title + ' \u00B7 ' + ev.studentText + (note ? ' \u00B7 ' + note : '') });
    if (ev.vitals) applyVitals(req.actor, sid, { hr: ev.vitals.hr, rr: ev.vitals.rr, spo2: ev.vitals.spo2, sbp: ev.vitals.sbp, dbp: ev.vitals.dbp, temp: ev.vitals.temp, rhythm: ev.vitals.rhythm }, ev.vitals.transitionSeconds || 0, 'event-' + req.body.submissionId);
    db.exec('COMMIT'); broadcast(); res.status(201).json({ entry });
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});
app.post('/api/assessments', auth, (req, res) => {
  const b = req.body, actor = req.actor, sid = actor.session_id;
  if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  if (!required(b.submissionId, 100)) return res.status(400).json({ error: 'Invalid submission ID.' });
  const prior = db.prepare('SELECT * FROM assessments WHERE actor_id=? AND submission_id=?').get(actor.id, b.submissionId);
  if (prior) return res.json({ assessment: prior, entry: db.prepare('SELECT * FROM entries WHERE id=?').get(prior.entry_id) });
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid);
  if (s.status !== 'active') return res.status(409).json({ error: 'The session is paused or ended.' });
  if (!['head_to_toe', 'focused'].includes(b.type) || !Array.isArray(b.systems) || !b.systems.length) return res.status(400).json({ error: 'Address at least one system.' });
  const systems = [];
  for (const x of b.systems) { if (!x || !SYSTEM_NAMES[x.system]) return res.status(400).json({ error: 'Unknown body system.' }); const findings = typeof x.findings === 'string' ? x.findings.trim().slice(0, 1000) : ''; const wdl = x.wdl === true && !findings; if (!wdl && !findings) return res.status(400).json({ error: 'Mark ' + SYSTEM_NAMES[x.system] + ' WDL or enter findings.' }); systems.push({ system: x.system, wdl, findings }); }
  const v = effectiveVitals(currentVitals(sid)), snap = v && v.monitor_on ? { hr: v.hr, rr: v.rr, spo2: v.spo2, sbp: v.sbp, dbp: v.dbp, temp: v.temp, rhythm: v.rhythm } : null;
  const prev = b.type === 'focused' ? db.prepare('SELECT entry_id FROM assessments WHERE session_id=? ORDER BY id DESC LIMIT 1').get(sid) : null;
  const text = (b.type === 'head_to_toe' ? 'Head-to-toe assessment' : 'Focused reassessment') + ' \u00B7 ' + systems.map(x => SYSTEM_NAMES[x.system] + ': ' + (x.wdl ? 'WDL' : x.findings)).join(' \u00B7 ') + (snap ? ' \u00B7 monitor: HR ' + snap.hr + ', RR ' + snap.rr + ', SpO\u2082 ' + snap.spo2 + '%, BP ' + snap.sbp + '/' + snap.dbp + ', ' + RHYTHMS[snap.rhythm] : ' \u00B7 monitor off') + ' \u00B7 ' + systems.length + ' of ' + Object.keys(SYSTEM_NAMES).length + ' systems';
  db.exec('BEGIN IMMEDIATE');
  try {
    const entry = append(actor, 'ASSESSMENT_RECORDED', { submissionId: b.submissionId, text, linkedId: prev ? prev.entry_id : (v ? v.entry_id : null) });
    const r = db.prepare('INSERT INTO assessments(session_id,actor_id,entry_id,type,systems,vitals_snapshot,recorded_at,submission_id) VALUES(?,?,?,?,?,?,?,?)').run(sid, actor.id, entry.id, b.type, JSON.stringify(systems), snap ? JSON.stringify(snap) : null, entry.recorded_at, b.submissionId);
    db.exec('COMMIT'); broadcast(); res.status(201).json({ assessment: db.prepare('SELECT * FROM assessments WHERE id=?').get(r.lastInsertRowid), entry });
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});
app.post('/api/meds/scan', auth, (req, res) => {
  const b = req.body, actor = req.actor, sid = actor.session_id;
  if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid);
  if (s.status !== 'active') return res.status(409).json({ error: 'The session is paused or ended.' });
  const med = medById(b.medId); if (!med || !activeMedIds(s).includes(med.id)) return res.status(400).json({ error: 'That medication is not an active order in this session.' });
  if (!['patient', 'med'].includes(b.kind) || !required(b.attemptId, 100)) return res.status(400).json({ error: 'Invalid scan.' });
  const source = b.source === 'camera' ? 'camera' : 'manual', code = normalizeCode(b.code);
  if (!code) return res.status(400).json({ error: 'Empty code.' });
  if (source !== 'camera' && s.scan_required) return res.status(400).json({ error: 'This session requires scanning.' });
  const r = resolveCode(code), matched = b.kind === 'patient' ? !!(r && r.type === 'patient') : !!(r && r.type === 'med' && r.med.id === med.id);
  const resolved = r ? (r.type === 'patient' ? 'Patient wristband' : medLabel(r.med)) : null;
  const alert = matched ? null : b.kind === 'patient' ? (r ? 'WRONG PATIENT: that is a medication label (' + resolved + '), not the wristband.' : 'UNRECOGNIZED WRISTBAND: this code is not ' + scenario.patient.name + '\'s wristband. Check the patient and rescan.')
    : (r ? (r.type === 'med' ? 'WRONG MEDICATION: that label is ' + resolved + ', not ' + medLabel(med) + '.' : 'WRONG MEDICATION: that is the patient wristband, not a medication label.') : 'UNRECOGNIZED LABEL: this code is not a known medication. Check the package; the instructor can register real items.');
  db.exec('BEGIN IMMEDIATE');
  try {
    let entry = null;
    if (!matched) entry = append(actor, 'MED_SCAN_MISMATCH', { submissionId: 'scan-' + b.attemptId + '-' + randomUUID().slice(0, 8), text: 'Scan alert while preparing ' + medLabel(med) + ' \u00B7 ' + alert + ' \u00B7 ' + (source === 'camera' ? 'camera scan' : 'MANUAL ENTRY') });
    const ins = db.prepare('INSERT INTO med_scans(session_id,actor_id,attempt_id,med_id,kind,code,format,source,matched,resolved,scanned_at,entry_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(sid, actor.id, b.attemptId, med.id, b.kind, code, typeof b.format === 'string' ? b.format.slice(0, 40) : null, source, matched ? 1 : 0, resolved, new Date().toISOString(), entry ? entry.id : null);
    db.exec('COMMIT'); if (!matched) broadcast();
    res.status(201).json({ matched, alert, resolved: matched ? resolved : null, scanId: ins.lastInsertRowid, patient: matched && b.kind === 'patient' ? { name: scenario.patient.name, dob: scenario.patient.dob, mrn: scenario.patient.mrn } : undefined });
  } catch (e) { db.exec('ROLLBACK'); throw e; }
});
app.post('/api/meds/orders', auth, instructor, (req, res) => {
  const med = medById(req.body.medId), sid = req.actor.session_id;
  if (!sid || !med || med.kind !== 'assignable') return res.status(400).json({ error: 'Only sim-day medications can be activated or removed.' });
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid); if (s.status === 'ended') return res.status(409).json({ error: 'The session has ended.' });
  let active = []; try { active = JSON.parse(s.active_meds || '[]'); } catch {}
  const on = req.body.active !== false; active = on ? [...new Set([...active, med.id])] : active.filter(id => id !== med.id);
  db.exec('BEGIN IMMEDIATE');
  try { db.prepare('UPDATE sessions SET active_meds=? WHERE id=?').run(JSON.stringify(active), sid); append(req.actor, 'MED_ORDER_CHANGED', { submissionId: randomUUID(), text: (on ? 'Order activated: ' : 'Order removed: ') + medLabel(med) }); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  broadcast(); res.json({ ok: true, activeMeds: active });
});
app.post('/api/barcodes', auth, instructor, (req, res) => {
  const code = normalizeCode(req.body.code), type = req.body.targetType, id = String(req.body.targetId || ''), label = typeof req.body.label === 'string' ? req.body.label.trim().slice(0, 120) : '';
  if (!code || code.length > 128) return res.status(400).json({ error: 'Scan or enter the code printed on the physical item.' });
  if (!['patient', 'med'].includes(type) || (type === 'med' && !medById(id))) return res.status(400).json({ error: 'Choose the wristband or a scenario medication for this code.' });
  const builtin = resolveCode(code);
  if (builtin && builtin.source === 'scenario') return res.status(409).json({ error: 'That code is already printed by the labels page for ' + (builtin.type === 'patient' ? 'the wristband' : medLabel(builtin.med)) + '.' });
  const active = req.body.active !== false ? 1 : 0, target = type === 'patient' ? 'the patient wristband' : medLabel(medById(id));
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare('SELECT * FROM barcode_aliases WHERE code=?').get(code);
    if (existing) db.prepare('UPDATE barcode_aliases SET target_type=?, target_id=?, label=?, registered_by=?, registered_at=?, active=? WHERE code=?').run(type, type === 'patient' ? 'patient' : id, label, req.actor.id, new Date().toISOString(), active, code);
    else db.prepare('INSERT INTO barcode_aliases(code,target_type,target_id,label,registered_by,registered_at,active) VALUES(?,?,?,?,?,?,?)').run(code, type, type === 'patient' ? 'patient' : id, label, req.actor.id, new Date().toISOString(), active);
    if (req.actor.session_id) append(req.actor, 'BARCODE_REGISTERED', { submissionId: randomUUID(), text: (active ? 'Physical barcode registered: ' : 'Physical barcode removed: ') + code + ' \u2192 ' + target + (label ? ' (' + label + ')' : '') });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  broadcast(); res.status(201).json({ ok: true, barcodes: aliases() });
});
app.get('/api/barcodes/lookup', auth, instructor, (req, res) => { const r = resolveCode(req.query.code); res.json({ code: normalizeCode(req.query.code), match: r ? { type: r.type, source: r.source, medId: r.med?.id || null, label: r.type === 'patient' ? 'Patient wristband' : medLabel(r.med) } : null }); });
app.post('/api/session-settings', auth, instructor, (req, res) => {
  const sid = req.actor.session_id; if (!sid) return res.status(400).json({ error: 'Create a session first.' });
  const sess = db.prepare('SELECT * FROM sessions WHERE id=?').get(sid); if (sess.status === 'ended') return res.status(409).json({ error: 'The session has ended.' });
  if (typeof req.body.scanRequired !== 'boolean') return res.status(400).json({ error: 'scanRequired must be true or false.' });
  db.exec('BEGIN IMMEDIATE');
  try { db.prepare('UPDATE sessions SET scan_required=? WHERE id=?').run(req.body.scanRequired ? 1 : 0, sid); append(req.actor, 'SESSION_SETTING_CHANGED', { submissionId: randomUUID(), text: req.body.scanRequired ? 'Scanning required: manual code entry disabled for students.' : 'Manual code entry allowed (each manual entry needs a reason and is flagged).' }); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  broadcast(); res.json({ ok: true });
});
app.get('/api/display', (req, res) => { const s = latest(); res.setHeader('Cache-Control', 'no-store'); const said = s ? db.prepare("SELECT e.*, a.name AS actor_name FROM entries e JOIN actors a ON a.id=e.actor_id WHERE e.session_id=? AND e.action IN ('PATIENT_ASKED','PATIENT_SAID') ORDER BY e.id DESC LIMIT 2").all(s.id).reverse() : []; const lastExam = s ? db.prepare("SELECT e.* FROM entries e WHERE e.session_id=? AND e.action='EXAM_FINDING' ORDER BY e.id DESC LIMIT 1").get(s.id) : null; const examOut = lastExam && Date.now() - Date.parse(lastExam.recorded_at) < 30000 ? (() => { const m = lastExam.text.match(/^(.*?): (.*) \u00B7 system (\w+) \u00B7 phase/); const x = (scenario.exam || []).find(e => e.label === (m ? m[1] : '')); return m ? { id: lastExam.id, label: m[1], finding: m[2], system: m[3], sound: x ? x.sound : null, at: lastExam.recorded_at } : null; })() : null; res.json({ exam: examOut, conversation: said.map(e => ({ id: e.id, who: e.action === 'PATIENT_SAID' ? 'patient' : e.actor_name, text: e.action === 'PATIENT_SAID' ? e.text.replace(/^Patient: /, '').replace(/ \u00B7 phase \w+( \u00B7 brain \w+)?$/, '') : e.text.replace(/^Asked the patient( \(typed\))?: "/, '').replace(/" \u00B7 .*$/, ''), at: e.recorded_at })), session: s ? { group_name: s.group_name, status: s.status } : null, patient: { name: scenario.patient.name, mrn: scenario.patient.mrn }, vitals: s ? currentVitals(s.id) : null, rhythms: RHYTHMS, server_now: new Date().toISOString() }); });
app.post('/api/status', auth, instructor, (req, res) => {
  if (!['active','paused','ended'].includes(req.body.status) || !req.actor.session_id) return res.status(400).json({ error: 'Invalid session status.' });
  const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.actor.session_id);
  if (s.status === 'ended' || s.status === req.body.status) return res.status(409).json({ error: 'This session cannot make that transition.' });
  db.exec('BEGIN IMMEDIATE');
  try { db.prepare('UPDATE sessions SET status=? WHERE id=?').run(req.body.status, s.id); append(req.actor, 'SESSION_STATUS_CHANGED', { submissionId: randomUUID(), text: `Session ${req.body.status}.` }); db.exec('COMMIT'); } catch(e) { db.exec('ROLLBACK'); throw e; }
  broadcast(); res.json({ ok: true });
});
app.get('/api/export', auth, instructor, (req, res) => { res.attachment('code-shift-evidence.json').json({ format: 'code-shift-evidence-v2', exported_at: new Date().toISOString(), ...snapshot(req.actor) }); });
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use(express.static(path.join(root, 'dist')));
app.get('/{*path}', (req, res) => res.sendFile(path.join(root, 'dist/index.html')));
app.use((err, req, res, next) => { console.error(err.message); res.status(err.status || 500).json({ error: err.status ? err.message : 'The server could not commit this action. Your text has been retained; retry safely.' }); });
const host = process.env.HOST || '0.0.0.0', port = Number(process.env.PORT || 4317);
http.listen(port, host, () => {
  const addresses = host === '0.0.0.0' || host === '::' ? Object.values(networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address) : [host];
  const scheme = tls ? 'https' : 'http';
  console.log(`Code Shift listening on ${scheme}://${host}:${port}\nOpen on this device: ${scheme}://127.0.0.1:${port}\nOpen on student devices: ${addresses.length ? addresses.map(a => `${scheme}://${a}:${port}`).join('  ') : '(no LAN address found)'}\nMonitor display: ${scheme}://127.0.0.1:${port}/display\nInstructor key: ${process.env.INSTRUCTOR_PASSWORD ? 'environment configured' : credentialFile}`);
  if (tls && process.env.HTTP_HELPER_PORT) { const helper = createServer((req, res) => { if (req.url === '/cert') { res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="code-shift-ca.crt"' }); return res.end(tls.cert); } res.writeHead(302, { Location: `https://${(req.headers.host || '').split(':')[0]}:${port}${req.url}` }); res.end(); }); helper.on('error', e => console.error('HTTP helper not started (' + e.code + '): certificate download at /cert is unavailable on port ' + process.env.HTTP_HELPER_PORT)); helper.listen(Number(process.env.HTTP_HELPER_PORT), host, () => console.log(`HTTP helper (redirect + /cert download): http://${host}:${process.env.HTTP_HELPER_PORT}`)); }
});
function shutdown() { for (const ws of live.clients) ws.terminate(); http.close(() => { db.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
