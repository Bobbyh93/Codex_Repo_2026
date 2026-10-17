// Concurrency smoke test: N student-like clients join, write notes, and poll state for D seconds.
// Usage: node tests/load.mjs <base-url> <instructor-key> [clients=10] [seconds=60]   (dev server: http://127.0.0.1:4317)
// The installed Pi serves https only, with a self-signed certificate: download it from http://<pi-ip>:8080/cert, then
//   NODE_EXTRA_CA_CERTS=code-shift-ca.crt node tests/load.mjs https://<pi-ip>:4317 <instructor-key> 10 60
const [base = 'http://127.0.0.1:4317', key, clientsArg = '10', secondsArg = '60'] = process.argv.slice(2);
if (!key) { console.error('Usage: node tests/load.mjs <base-url> <instructor-key> [clients] [seconds]'); process.exit(1); }
const clients = Number(clientsArg), seconds = Number(secondsArg);
function client() { let cookie = ''; return async (url, body) => { const r = await fetch(`${base}/api/${url}`, { method: body ? 'POST' : 'GET', headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); const c = r.headers.get('set-cookie'); if (c) cookie = c.split(';')[0]; return { status: r.status, body: await r.json() }; }; }
const instructor = client();
const login = await instructor('login', { password: key }).catch(e => { console.error(`Cannot reach ${base}: ${e.cause?.message || e.message}. ` + (base.startsWith('https:') ? 'For the self-signed certificate run with NODE_EXTRA_CA_CERTS=code-shift-ca.crt (from http://<pi-ip>:8080/cert).' : 'The installed Pi serves https only: use https://<pi-ip>:4317.')); process.exit(1); });
if (login.status !== 200) { console.error('Instructor login failed'); process.exit(1); }
let lobby = (await instructor('lobby')).body;
if (!lobby.session) { await instructor('sessions', { groupName: 'Load test', names: ['Load A', 'Load B', 'Load C'] }); lobby = (await instructor('lobby')).body; }
const roster = lobby.roster;
const stats = { requests: 0, errors: 0, latencies: [] };
async function run(i) {
  const c = client(); const joined = await c('join', { actorId: roster[i % roster.length].id }).catch(() => ({ status: 0 })); if (joined.status !== 200) { stats.errors++; return; }
  const end = Date.now() + seconds * 1000; let n = 0;
  while (Date.now() < end) {
    const t = performance.now();
    try { const r = n % 5 === 0 ? await c('entries', { action: 'NOTE_RECORDED', text: `Load note ${i}-${n}`, submissionId: `load-${process.pid}-${i}-${n}` }) : await c('state'); if (r.status >= 400) stats.errors++; } catch { stats.errors++; }
    stats.latencies.push(performance.now() - t); stats.requests++; n++;
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
  }
}
console.log(`Running ${clients} clients against ${base} for ${seconds}s…`);
await Promise.all(Array.from({ length: clients }, (_, i) => run(i)));
const sorted = stats.latencies.sort((a, b) => a - b), pct = p => (sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0).toFixed(0);
console.log(`requests=${stats.requests} errors=${stats.errors} p50=${pct(0.5)}ms p95=${pct(0.95)}ms max=${(sorted.at(-1) ?? 0).toFixed(0)}ms`);
process.exit(stats.errors ? 1 : 0);
