import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import type { Server } from 'http';

/**
 * What actually guards /api/admin, and which admin pages satisfy it.
 *
 * Which middleware an /api/admin route gets is decided by WHERE in
 * server/routes.ts it is registered, not by what its own middleware list says:
 *
 *   780  registerAdminRoutes           session; CSRF only where a route names it
 *   797  registerAdminDatabaseRoutes   session; CSRF only where a route names it
 *   811  /api/admin/users*             session
 *   817  app.use('/api/admin', contentImportRouter)
 *   825  registerCrosswalkRoutes       the above, PLUS its own authenticateToken
 *
 * contentImportRouter opens with an unconditional
 *
 *     router.use(requireAdminSession);
 *     router.use(validateCSRFToken);
 *
 * and an Express router runs its own router.use() middleware for every request
 * reaching its mount path, matching route or not. So both guards cover the
 * whole namespace from line 817 onward, and nothing above it. That is why
 * /api/admin/users* -- six lines above the mount -- really was anonymous until
 * PR #10, while the nineteen routes far below it never were.
 *
 * The same accident decides CSRF, and that is what broke four admin features:
 * PDF upload, study-guide customisation, emailing a guide, and content-to-topic
 * mapping answered 403 CSRF_TOKEN_MISSING because they used a bare fetch().
 * PR #21 fixed those. This file covers the rest of the admin UI, where the
 * picture turned out to be more mixed than "they are all broken the same way":
 *
 *   - content-workflow's two calls sit below the mount with no token at all:
 *     the same live 403. Fixed here.
 *   - crosswalk-manager needs THREE things at once, because crosswalk-routes.ts
 *     is registered below the mount and also runs authenticateToken: session
 *     cookie, CSRF token, and bearer. It sent only the bearer. Fixed here, via
 *     apiRequest's headers option.
 *   - ai-analyzer and data-mapping sent `Bearer ${localStorage.adminToken}`,
 *     and nothing in this repo ever writes that key -- so the header was
 *     literally "Bearer null". Their routes are session-guarded and the cookie
 *     arrives on its own, so they worked in spite of it. The dead header is
 *     gone; data-mapping's route does not exist at all (see DOCUMENTED below).
 *   - call-bookings, database-manager, sql-console, import-export and
 *     resource-manager were already correct. They stay as they are, with a
 *     written reason each and a case here proving the server accepts what they
 *     send.
 *
 * Everything runs the real registerRoutes against a real PostgreSQL (PGlite,
 * via helpers/pglite-db.ts) behind the real session middleware. A mocked app
 * cannot reproduce any of this: it is all about which middleware a request
 * passes through on the way to a handler.
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

type Case = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** false when no validateCSRFToken sits on this route's chain. Default true. */
  csrf?: boolean;
  /** true when the route also runs authenticateToken and needs a bearer. */
  jwt?: boolean;
};

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

  // Routes reached by the admin pages this change touches. Each one's flags
  // were read off its registration, not assumed -- which chain a route gets
  // depends on where in server/routes.ts it is registered:
  //
  //   780  registerAdminRoutes            session; CSRF only where named
  //   797  registerAdminDatabaseRoutes    session; CSRF only where named
  //   817  app.use('/api/admin', contentImportRouter)   <-- session + CSRF for
  //                                                         everything below
  //   825  registerCrosswalkRoutes        the above, PLUS its own JWT check
  //
  // admin-routes.ts and admin-database-routes.ts sit above the mount, so a
  // route there enforces CSRF only if its own middleware list says so.
  { method: 'POST', path: '/api/admin/ai/normalize-topics', body: { topics: [] }, csrf: false },
  { method: 'POST', path: '/api/admin/ai/bulk-process', csrf: false },
  { method: 'POST', path: '/api/admin/resources/init-sample', csrf: false },
  { method: 'POST', path: `/api/admin/database/tables/resources/import`, body: { data: [] }, csrf: false },

  { method: 'PUT', path: `/api/admin/bookings/${ABSENT_ID}`, body: { status: 'confirmed' } },
  { method: 'POST', path: `/api/admin/bookings/${ABSENT_ID}/notes`, body: { notes: 'n' } },
  { method: 'PUT', path: `/api/admin/leads/${ABSENT_ID}`, body: { status: 'new' } },
  { method: 'POST', path: '/api/admin/database/query', body: { query: 'SELECT 1' } },
  { method: 'PUT', path: `/api/admin/database/tables/resources/update`, body: { data: {}, original: {} } },

  // Below the mount: blanket session + CSRF.
  { method: 'POST', path: '/api/admin/content/import' },
  { method: 'PUT', path: `/api/admin/content/blocks/${ABSENT_ID}`, body: { title: 't' } },

  // Below the mount AND running authenticateToken: bearer on top of the rest.
  { method: 'POST', path: '/api/admin/crosswalk/nclex-topic', body: {}, jwt: true },
  { method: 'PUT', path: `/api/admin/crosswalk/nclex-topic/${ABSENT_ID}`, body: {}, jwt: true },
  { method: 'DELETE', path: `/api/admin/crosswalk/nclex-topic/${ABSENT_ID}`, jwt: true },
  { method: 'POST', path: '/api/admin/crosswalk/import/nclex-topic', jwt: true },
];

/** Non-GET routes that actually have validateCSRFToken on their chain. */
const CSRF_CASES = CASES.filter((c) => c.method !== 'GET' && c.csrf !== false);

let app: express.Express;
let server: Server;
let base: string;
let adminCookie: string;
let csrfToken: string;
let adminJwt: string;
let sendGridKey: string | undefined;

function call(c: Case, opts: { cookie?: string; csrf?: string; bearer?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.csrf) headers['x-csrf-token'] = opts.csrf;
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
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

  // crosswalk-routes.ts runs authenticateToken in addition to everything the
  // mount imposes, so those cases need a real bearer as well as the cookie.
  const { AuthService } = await import('../auth');
  adminJwt = AuthService.generateToken({ userId: admin.id, email: ADMIN.email, role: 'admin' });
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
    const res = await call(c, {
      cookie: adminCookie,
      csrf: csrfToken,
      bearer: c.jwt ? adminJwt : undefined,
    });
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
  it.each(CSRF_CASES)('$method $path is 403 for a signed-in admin with no token', async (c) => {
    // This is exactly what the four bare-fetch() call sites were doing.
    // Pinning it documents that the 403 is the middleware working as intended,
    // not a broken route: the fix belongs in the client, which the next test
    // checks.
    const res = await call(c, { cookie: adminCookie, bearer: c.jwt ? adminJwt : undefined });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'CSRF_TOKEN_MISSING' });
  });

  it.each(CASES.filter((c) => c.jwt))('$method $path needs the bearer too, not just the session', async (c) => {
    // The reason apiRequest gained a headers option. crosswalk-routes.ts is
    // registered below the contentImportRouter mount AND runs its own
    // authenticateToken, so a caller must satisfy both: session cookie and
    // CSRF from the mount, bearer from the route. Dropping either one fails.
    //
    // Without this, the jwt cases above would pass just as well if
    // authenticateToken were not on the chain at all, and the bearer this
    // change threads through apiRequest would be decoration.
    const res = await call(c, { cookie: adminCookie, csrf: csrfToken });
    const text = await res.text();
    expect(res.status, `expected 401 without a bearer, got ${res.status}: ${text.slice(0, 200)}`).toBe(401);

    // And it is authenticateToken refusing, not the session guard: the same
    // request WITH the bearer gets past it.
    const withBearer = await call(c, { cookie: adminCookie, csrf: csrfToken, bearer: adminJwt });
    expect(withBearer.status).not.toBe(401);
  });

  it('leaves only documented bare-fetch call sites', () => {
    // apiRequest() attaches X-CSRF-Token and credentials:"include" in one
    // place. A bare fetch() carrying a method attaches neither by default, so
    // against a route whose chain includes validateCSRFToken it always 403s.
    //
    // Every remaining bare fetch() is listed below with the reason it is
    // acceptable, and every route named here has a case in CASES above proving
    // the server accepts what that page actually sends. This test fails on any
    // call site NOT on the list, so the exceptions cannot grow silently.
    const DOCUMENTED = new Map<string, string>([
      // Login is what issues the CSRF token; it cannot carry one.
      ['admin-login.tsx::/api/admin/login', 'issues the token'],

      // Attaches X-CSRF-Token by hand. The routes (admin-routes.ts, above the
      // mount) name validateCSRFToken themselves, so this is correct as-is --
      // see the bookings/leads cases in CASES.
      ['call-bookings.tsx::/api/admin/bookings/${id}', 'hand-attached CSRF, route requires it'],
      ['call-bookings.tsx::/api/admin/bookings/${id}/notes', 'hand-attached CSRF, route requires it'],
      ['call-bookings.tsx::/api/admin/leads/${id}', 'hand-attached CSRF, route requires it'],

      // Attach CSRF through admin-auth.ts's getAdminHeaders(). Converting them
      // would be a regression, not a fix: each reads the response body on
      // failure to show the server's own error (a SQL error, an import
      // rejection), and apiRequest throws on non-ok after consuming the body.
      ['database-manager.tsx::/api/admin/database/query', 'CSRF via getAdminHeaders; renders the SQL error body'],
      ['database-manager.tsx::/api/admin/database/tables/${tableName}/update', 'CSRF via getAdminHeaders; renders the error body'],
      ['sql-console.tsx::/api/admin/database/query', 'CSRF via getAdminHeaders; renders the SQL error body'],
      ['import-export.tsx::/api/admin/database/tables/${selectedTable}/import', 'CSRF via getAdminHeaders; renders the import result body'],

      // Sends a bearer and no CSRF. Correct by accident but correct: the route
      // is in admin-routes.ts above the mount and names no validateCSRFToken,
      // which the csrf:false case for it in CASES pins. If that route ever
      // gains CSRF, that case fails before this page breaks in production.
      ['resource-manager.tsx::/api/admin/resources/init-sample', 'route has no CSRF check; pinned by CASES'],

      // Calls a route that does not exist. Nothing in server/ registers
      // /api/admin/index/rebuild, so the Rebuild Index button is a 404 no
      // matter what it sends. Converting it would only make a dead call
      // tidier; it needs a product decision (implement or remove the button),
      // which is outside this change.
      ['data-mapping.tsx::/api/admin/index/rebuild', 'NO SUCH ROUTE -- dead button, needs a product decision'],
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

    const seen = new Set<string>();
    const offenders: string[] = [];
    for (const file of files) {
      const name = file.slice(adminPages.length + 1);
      for (const hit of readFileSync(file, 'utf8').matchAll(bareWrite)) {
        const key = `${name}::${hit[1]}`;
        seen.add(key);
        if (!DOCUMENTED.has(key)) offenders.push(key);
      }
    }

    expect(
      offenders,
      `these send a state-changing /api/admin request with a bare fetch(), which ` +
        `carries no X-CSRF-Token. Use apiRequest(method, url, body) -- or add an ` +
        `entry to DOCUMENTED saying why this one is safe:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);

    // Non-vacuous in both directions: the pattern still matches every site the
    // list names, so neither a broken regex nor a silently-removed call site
    // can make this pass for the wrong reason.
    const missing = [...DOCUMENTED.keys()].filter((k) => !seen.has(k));
    expect(
      missing,
      `DOCUMENTED names call sites that no longer exist. Remove them:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('routes the converted pages through apiRequest', () => {
    // The six call sites this change fixed. Named individually so a revert to
    // bare fetch() fails here with the reason, not just on the scan above.
    const converted: Array<[string, string]> = [
      ['ai-analyzer.tsx', '/api/admin/ai/normalize-topics'],
      ['ai-analyzer.tsx', '/api/admin/ai/bulk-process'],
      ['content-workflow.tsx', '/api/admin/content/import'],
      ['content-workflow.tsx', '/api/admin/content/blocks/'],
      ['crosswalk-manager.tsx', '/api/admin/crosswalk/'],
      ['crosswalk-manager.tsx', '/api/admin/crosswalk/import/'],
    ];

    const adminPages = resolve(__dirname, '../../client/src/pages/admin');
    for (const [file, path] of converted) {
      const source = readFileSync(resolve(adminPages, file), 'utf8');
      const line = source.split('\n').find((l) => l.includes(path) && /await\s+apiRequest\(/.test(l));
      expect(line, `${file} no longer calls ${path} through apiRequest`).toBeTruthy();
    }

    // crosswalk's writes need the bearer passed through apiRequest's headers
    // option as well -- its routes run authenticateToken on top of the mount's
    // session and CSRF guards, so dropping either one 401s or 403s.
    const crosswalk = readFileSync(resolve(adminPages, 'crosswalk-manager.tsx'), 'utf8');
    expect(crosswalk).toContain('bearerHeader()');
    expect(crosswalk.match(/headers:\s*bearerHeader\(\)/g) ?? []).toHaveLength(4);
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
