"""Build static/index.html from the published console source (path given as argv[1])."""
import os
import sys

s = open(sys.argv[1], encoding='utf-8').read()


def R(old, new):
    global s
    assert old in s, old[:80]
    s = s.replace(old, new, 1)


# web bridge: used only outside Claude (no window.claude)
R("let SNAP = null;",
  """let WEB = false;
async function api(path, body) {
  const r = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: Object.assign({ 'X-Requested-With': 'console' }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { location.href = 'login'; throw new Error('Signed out.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('Server error ' + r.status));
  return d.rows || [];
}
async function webConnect() {
  if (window.claude) return;
  try {
    await api('api/ping');
    WEB = true; LIVE = true;
    bridge = { callMcpTool: async (name, args) => {
      if (name !== TOOLS.neon) return { isError: true, content: [{ type: 'text', text: 'Shown only inside Claude.' }] };
      const m = VIEW_RE.exec(args.sql);
      if (!m) return { isError: true, content: [{ type: 'text', text: 'blocked' }] };
      try { return { content: [], structuredContent: { rows: await api('api/view/' + m[1]) } }; }
      catch (e) { return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] }; }
    } };
  } catch (e) { console.error('[console] web api unavailable', e); }
}
let SNAP = null;""")
R("async function queueRun(f) {\n", "async function queueRun(f) {\n  if (WEB) { const w = await api('api/queue_run', { req: f.req, ms: f.ms, note: f.note }); return w[0] && w[0].msg_id; }\n")
R("async function recordDecision(f) {\n", "async function recordDecision(f) {\n  if (WEB) { const w = await api('api/record_decision', { req: f.req, ms: f.ms || null, question: f.question, answer: f.answer, note: f.note, id: f.id || null, ord: f.ord != null ? parseInt(f.ord, 10) : null }); return w[0] && w[0].decision_id; }\n")
R("  await connect();\n", "  await connect();\n  if (!LIVE) await webConnect();\n")
R("'Not connected. Open in Claude and allow the connectors.'", "'Not connected.'")

head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>[hidden]{display:none!important}</style></head><body>')
os.makedirs('static', exist_ok=True)
open('static/index.html', 'w', encoding='utf-8').write(head + s + '</body></html>')
print('built', len(s))
