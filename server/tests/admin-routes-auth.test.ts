import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import type { Server } from 'http';

/**
 * What actually guards /api/admin, and the four admin features it breaks.
 *
 * Nineteen /api/admin routes in server/routes.ts name no middleware at all.
 * They look unguarded. They are not: server/routes.ts:817 mounts
 * contentImportRouter at /api/admin, and that router opens with
 *
 *     router.use(requireAdminSession);
 *     router.use(validateCSRFToken);
 *
 * An Express router runs its own router.use() middleware for every request
 * reaching its mount path, whether or not the router has a matching route, so
 * both guards cover the entire /api/admin namespace from line 817 onward.
 * Everything registered after it inherits them; everything before it does not.
 * That is why /api/admin/users* (registered at line 811, six lines earlier)
 * really was anonymous until PR #10, and these nineteen never were. Position
 * decided it, not intent.
 *
 * Two consequences, and this file pins both.
 *
 * 1. The protection is an accident of mount order. Moving line 817, or
 *    narrowing its mount to /api/admin/content, silently opens nineteen
 *    routes, several of which return real student names, emails, scores and
 *    filenames. The routes now name requireAdminSession themselves; these
 *    tests fail if any /api/admin route loses its guard.
 *
 * 2. The blanket validateCSRFToken 403s every non-GET arriving without an
 *    X-CSRF-Token header -- and four admin features sent no such header,
 *    because they called the API with a bare fetch() instead of apiRequest().
 *    Admin PDF upload, study-guide customisation, emailing a guide to a
 *    student, and content-to-topic mapping have been answering
 *    403 CSRF_TOKEN_MISSING in production. The client now routes them through
 *    apiRequest(), which attaches the token the login response returns.
 *
 * Everything here runs the real registerRoutes against a real PostgreSQL
 * (PGlite, via helpers/pglite-db.ts) behind the real session middleware, so
 * what is under test is the middleware stack that ships, in the order it
 * ships. A mocked app cannot reproduce either finding: both are about which
 * middleware a request passes through on the way to a handler.
 */

vi.mock('../db', async () => {
  const { createTestDatabase } = await import('./helpers/pglite-db');
  const { db, close } = await createTestDatabase();
  return { db, pool: { end: close } };
});

vi.mock('../logger', () => ({
  AppLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { db, pool } = (await import('../db')) as unknown as {
  db: import('./helpers/pglite-db').TestDatabase['db'];
  pool: { end: () => Promise<void> };
};
const schema = await import('@shared/schema');
const { registerRoutes } = await import('../routes');

// Test-only placeholders. Not real credentials.
const ADMIN = { email: 'route-guard-admin@example.com', password: 'guard-test-only-password' };

/** A well-formed uuid that matches no row. */
const ABSENT_ID = '00000000-0000-4000-8000-000000000000';

type Case = { method: 'GET' | 'POST'; path: string; body?: unknown };

/**
 * The nineteen routes registered in server/routes.ts without their own
 * middleware. Bodies are shaped only well enough to get past the handler's
 * destructuring; these tests assert on status codes, not payloads.
 */
const CASES: Case[] = [
  { method: 'POST', path: '/api/admin/upload-assessment' },
  { method: 'GET', path: '/api/admin/assessments' },
  { method: 'POST', path: `/api/admin/assessments/${ABSENT_ID}/customize`, body: {} },
  { method: 'GET', path: `/api/admin/assessments/${ABSENT_ID}/pdf` },
  {
    method: 'POST',
    path: `/api/admin/assessments/${ABSENT_ID}/email`,
    body: { recipientEmail: 'nobody@example.com', subject: 's', message: 'm' },
  },
  { method: 'POST', path: '/api/admin/map-content-to-topics', body: { content: 'c', title: 't' } },
  { method: 'GET', path: '/api/admin/topic-relationships' },
  { method: 'GET', path: '/api/admin/topic-frequency' },
  { method: 'GET', path: '/api/admin/content-development-priorities' },
  { method: 'GET', path: '/api/admin/priority-metrics' },
  { method: 'POST', path: '/api/admin/track-topic-review', body: { topics: [], source: 'test' } },
  { method: 'POST', path: '/api/admin/extract-ati-topics', body: { reportText: '', reportId: ABSENT_ID } },
  { method: 'GET', path: '/api/admin/topic-extraction-stats' },
  { method: 'POST', path: '/api/admin/parse-reference-book', body: { bookText: '', bookTitle: 'T' } },
  { method: 'GET', path: '/api/admin/reference-book-stats' },
  { method: 'GET', path: '/api/admin/analytics' },
  { method: 'GET', path: '/api/admin/topic-metrics' },
  { method: 'GET', path: '/api/admin/user-activity' },
  { method: 'GET', path: '/api/admin/resource-usage' },
];

const POST_CASES = CASES.filter((c) => c.method === 'POST');

let app: express.Express;
let server: Server;
let base: string;
let adminCookie: string;
let csrfToken: string;
let sendGridKey: string | undefined;

function call(c: Case, opts: { cookie?: string; csrf?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.csrf) headers['x-csrf-token'] = opts.csrf;
  if (c.body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${base}${c.path}`, {
    method: c.method,
    headers,
    body: c.body === undefined ? undefined : JSON.stringify(c.body),
  });
}

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  // /api/admin/assessments/:id/email sends through SendGrid when a key is
  // present. Unset it so this suite cannot mail anyone.
  sendGridKey = process.env.SENDGRID_API_KEY;
  delete process.env.SENDGRID_API_KEY;

  app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-only-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true, sameSite: 'lax' },
      name: 'nurseprep.sid',
    }),
  );
  server = await registerRoutes(app);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${addr.port}`;

  const [admin] = await db
    .insert(schema.users)
    .values({
      username: 'route-guard-admin',
      email: ADMIN.email,
      password: await bcrypt.hash(ADMIN.password, 4),
      firstName: 'Guard',
      lastName: 'Admin',
      role: 'admin',
    })
    .returning();
  await db.insert(schema.adminUsers).values({
    userId: admin.id,
    email: ADMIN.email,
    permissions: ['full_access'],
    isActive: true,
  });

  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  const loginBody = await login.json();
  expect(login.status, JSON.stringify(loginBody)).toBe(200);
  const setCookie = login.headers.get('set-cookie');
  if (!setCookie) throw new Error('login did not set a session cookie');
  adminCookie = setCookie.split(';')[0];
  csrfToken = loginBody.csrfToken;
  expect(csrfToken).toMatch(/^[0-9a-f]{64}$/);
}, 60_000);

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  await pool.end();
  if (sendGridKey !== undefined) process.env.SENDGRID_API_KEY = sendGridKey;
});

describe('every /api/admin route rejects anonymous callers', () => {
  it.each(CASES)('$method $path is 401 without a session', async (c) => {
    const res = await call(c);
    const text = await res.text();

    expect(res.status, `expected 401, got ${res.status}: ${text.slice(0, 300)}`).toBe(401);
    expect(JSON.parse(text)).toMatchObject({ code: 'SESSION_EXPIRED' });
  });

  it('returns no student data from the assessments list', async () => {
    // The one route whose response is real PII rather than an aggregate, so
    // it is checked on the body and not only on the status line.
    await db.insert(schema.assessmentReports).values({
      userId: null,
      fileName: 'guard-test-report.pdf',
      extractedText: 'x',
      overallScore: '77.0',
      studentName: 'Guarded Student',
      studentEmail: 'guarded.student@example.com',
    } as typeof schema.assessmentReports.$inferInsert);

    const anonymous = await (await call({ method: 'GET', path: '/api/admin/assessments' })).text();
    expect(anonymous).not.toContain('Guarded Student');
    expect(anonymous).not.toContain('guarded.student@example.com');
    expect(anonymous).not.toContain('guard-test-report.pdf');

    // Non-vacuous: the same request WITH a session does return that row, so
    // the assertions above are about the guard, not about an empty table.
    const authed = await (
      await call({ method: 'GET', path: '/api/admin/assessments' }, { cookie: adminCookie })
    ).text();
    expect(authed).toContain('Guarded Student');
  });
});

describe('the same routes reach their handler for a signed-in admin', () => {
  it.each(CASES)('$method $path is not 401 with a session', async (c) => {
    // POSTs also need the CSRF token, or the blanket validateCSRFToken at
    // routes.ts:817 answers 403 before the handler runs -- which is the bug
    // the next block is about.
    const res = await call(c, { cookie: adminCookie, csrf: csrfToken });
    const text = await res.text();

    // The handler may still fail on its own terms (no file on the upload, an
    // id matching nothing). What would make this suite worthless is the guard
    // turning away a legitimate admin, or the route not existing at all.
    expect(res.status, `guard rejected an authenticated admin: ${text.slice(0, 300)}`).not.toBe(401);
    expect(res.status, `CSRF rejected a token-carrying admin: ${text.slice(0, 300)}`).not.toBe(403);
    expect(res.status, `route is not registered: ${c.method} ${c.path}`).not.toBe(404);
  });
});

describe('admin writes need the CSRF token the client now sends', () => {
  it.each(POST_CASES)('$path is 403 for a signed-in admin with no token', async (c) => {
    // This is exactly what the four bare-fetch() call sites were doing.
    // Pinning it documents that the 403 is the middleware working as intended,
    // not a broken route: the fix belongs in the client, which the next test
    // checks.
    const res = await call(c, { cookie: adminCookie });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'CSRF_TOKEN_MISSING' });
  });

  it('has no NEW admin page sending a state-changing request without apiRequest', () => {
    // apiRequest() attaches X-CSRF-Token and credentials:"include". A bare
    // fetch() carrying a method does neither, so against a route behind the
    // session+CSRF stack it always 403s. Four features shipped that way and
    // are fixed here.
    //
    // The rest of the admin UI has the same shape but NOT the same fix. It
    // predates the session scheme and reaches for two others: a
    // `Bearer ${localStorage.getItem('adminToken')}` header (ai-analyzer,
    // data-mapping, crosswalk-manager's import) against routes guarded by
    // authenticateToken, and a hand-attached X-CSRF-Token (call-bookings).
    // Moving those to apiRequest() would strip the Authorization header they
    // depend on, so each needs its route's guard identified first. That is a
    // separate piece of work, listed here rather than hidden: this test fails
    // on any call site not already on the list, so the backlog cannot grow.
    const KNOWN_UNCONVERTED = new Set([
      // Login cannot carry a CSRF token: it is what issues one.
      'admin-login.tsx::/api/admin/login',
      // Bearer adminToken from localStorage, against authenticateToken routes.
      'ai-analyzer.tsx::/api/admin/ai/normalize-topics',
      'ai-analyzer.tsx::/api/admin/ai/bulk-process',
      'data-mapping.tsx::/api/admin/index/rebuild',
      'crosswalk-manager.tsx::/api/admin/crosswalk/import/${activeTab}',
      // getAdminHeaders() -- same Bearer scheme, via a helper.
      'crosswalk-manager.tsx::/api/admin/crosswalk/${activeTab}',
      'crosswalk-manager.tsx::/api/admin/crosswalk/${activeTab}/${id}',
      // Attaches X-CSRF-Token by hand; correct today, just not centralised.
      'call-bookings.tsx::/api/admin/bookings/${id}',
      'call-bookings.tsx::/api/admin/bookings/${id}/notes',
      'call-bookings.tsx::/api/admin/leads/${id}',
      // Session-scheme pages with the same defect as the four fixed here,
      // left alone only because nothing in this suite exercises their routes.
      'content-workflow.tsx::/api/admin/content/import',
      'content-workflow.tsx::/api/admin/content/blocks/${editedBlock.id}',
      'database-manager.tsx::/api/admin/database/query',
      'database-manager.tsx::/api/admin/database/tables/${tableName}/update',
      'import-export.tsx::/api/admin/database/tables/${selectedTable}/import',
      'resource-manager.tsx::/api/admin/resources/init-sample',
      'sql-console.tsx::/api/admin/database/query',
    ]);

    const adminPages = resolve(__dirname, '../../client/src/pages/admin');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = resolve(dir, e.name);
        return e.isDirectory() ? walk(full) : /\.tsx?$/.test(e.name) ? [full] : [];
      });

    // fetch(<admin url>, { ... method: ... }) -- a plain GET fetch takes no
    // options object, so requiring `method:` keeps reads out of this.
    const bareWrite = /\bfetch\(\s*[`'"]([^`'"]*\/api\/admin\/[^`'"]*)[`'"]\s*,\s*\{[^}]*method\s*:/g;

    const files = walk(adminPages);
    expect(files.length).toBeGreaterThan(5);

    const seen: string[] = [];
    const offenders: string[] = [];
    for (const file of files) {
      const name = file.slice(adminPages.length + 1);
      for (const hit of readFileSync(file, 'utf8').matchAll(bareWrite)) {
        const key = `${name}::${hit[1]}`;
        seen.push(key);
        if (!KNOWN_UNCONVERTED.has(key)) offenders.push(key);
      }
    }

    // Non-vacuous: the pattern still matches the call sites the list names.
    // Without this, a regex that stopped matching would pass silently.
    expect(seen.length).toBeGreaterThanOrEqual(KNOWN_UNCONVERTED.size);

    expect(
      offenders,
      `these send a state-changing /api/admin request with a bare fetch(), which ` +
        `carries no X-CSRF-Token and will 403. Use apiRequest(method, url, body):\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);

    // And the four this change fixed stay fixed.
    for (const gone of [
      'assessment-manager.tsx::/api/admin/upload-assessment',
      'assessment-manager-carousel.tsx::/api/admin/upload-assessment',
      'simplified-content-mapper.tsx::/api/admin/map-content-to-topics',
    ]) {
      expect(seen, `${gone} went back to a bare fetch()`).not.toContain(gone);
    }
  });
});

describe('no /api/admin route is registered without a guard', () => {
  /**
   * Source scan, so a route added before the contentImportRouter mount -- or
   * added after someone moves it -- fails here rather than shipping open.
   *
   * Scope: direct app.<verb>("/api/admin/...") registrations. Routers mounted
   * at /api/admin with relative paths (content-import-routes.ts) carry their
   * own router.use(requireAdminSession) and are not matched by this pattern.
   */
  const GUARDS = ['requireAdminSession', 'requireRole(', 'requireSQLPermission', 'requireAdmin'];

  // Authentication endpoints: a caller cannot hold a session before these run.
  const PUBLIC_BY_DESIGN = ['/api/admin/login', '/api/admin/session'];

  const serverDir = resolve(__dirname, '..');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = resolve(dir, e.name);
      if (e.isDirectory()) return e.name === 'tests' ? [] : walk(full);
      return e.name.endsWith('.ts') ? [full] : [];
    });

  const registration = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*["'`](\/api\/admin\/[^"'`]*)["'`]\s*,/g;

  /**
   * The middleware list of one registration: everything between the path and
   * the handler. Registrations are written both on one line and wrapped over
   * several -- most of curriculum-catalog-routes.ts puts its guard on the line
   * after the path -- so this cannot stop at a newline. It stops at the
   * handler instead, so a guard name appearing later in the file cannot be
   * mistaken for this route's own.
   */
  function middlewareOf(source: string, from: number): string {
    const window = source.slice(from, from + 400);
    const end = [/\basync\s*\(/, /\(\s*_?req\b/, /\)\s*;/]
      .map((re) => window.search(re))
      .filter((i) => i !== -1);
    return window.slice(0, end.length ? Math.min(...end) : window.length);
  }

  const scan = () =>
    walk(serverDir).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(registration)].map((m) => ({
        verb: m[1].toUpperCase(),
        path: m[2],
        middleware: middlewareOf(source, m.index! + m[0].length),
        file: file.slice(serverDir.length + 1),
      }));
    });

  it('finds the registrations it is meant to check', () => {
    // Guards against a silent pass if the pattern stops matching, or if
    // middlewareOf() starts returning an empty window for every route.
    const found = scan();
    expect(found.length).toBeGreaterThanOrEqual(CASES.length);
    expect(found.filter((r) => GUARDS.some((g) => r.middleware.includes(g))).length).toBeGreaterThan(20);
  });

  it('finds no unguarded registration', () => {
    const unguarded = scan()
      .filter((r) => !PUBLIC_BY_DESIGN.includes(r.path))
      .filter((r) => !GUARDS.some((g) => r.middleware.includes(g)))
      .map((r) => `${r.verb} ${r.path}  (${r.file})`);

    expect(
      unguarded,
      `these /api/admin routes name no auth middleware. They may still be covered ` +
        `by the contentImportRouter mount at routes.ts:817, but only by accident of ` +
        `registration order:\n  ${unguarded.join('\n  ')}`,
    ).toEqual([]);
  });
});
