import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';
import type { Server } from 'http';

/**
 * Smoke test for the four features PR #7 repaired.
 *
 * Each of these was fully broken at runtime and stayed that way because the
 * failure was a type error outside CI's typecheck allowlist:
 *
 *   1. Table approval inserted `adminId`/`createdAt` into table_approvals,
 *      whose columns are `reviewerId` (NOT NULL) and `reviewedAt` -- every
 *      approve and reject failed, and nothing was attributed to an admin.
 *   2. Guest uploads passed a deterministic `guest_*` id to
 *      storage.createUser, which could not accept an id, so the user row got
 *      a random uuid and the report's user_id had nothing to reference.
 *   3. /api/admin/users* selected columns that do not exist (users.name,
 *      assessment_reports.created_at) and ran parseInt() on uuid ids.
 *   4. The Resource Mapper page called apiRequest(url, { method }) against a
 *      signature of apiRequest(method, url, body) -- every button threw.
 *
 * The earlier regression tests pin these with a mocked `db`, which cannot
 * tell a real column from a misspelled one. This file drives the real HTTP
 * handlers, through the real session and CSRF middleware, against a real
 * PostgreSQL (see helpers/pglite-db.ts) carrying the real schema. A wrong
 * column name, a missing NOT NULL value or a NaN id fails here the way it
 * fails on Render.
 *
 * Item 4 is a client-side bug and is pinned by `npm run check`: the wrong
 * argument order is a type error. What this file adds for it is the other
 * half -- every (method, path) the page sends is registered on the server,
 * and the create/update/bulk/delete handlers behind them work end to end.
 */

vi.mock('../db', async () => {
  const { createTestDatabase } = await import('./helpers/pglite-db');
  const { db, close } = await createTestDatabase();
  // server/db.ts exports `pool` with `.end()`; keep that shape so teardown
  // reads the same as it would against the real driver.
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
const ADMIN = { email: 'smoke-admin@example.com', password: 'smoke-test-only-password' };

let app: express.Express;
let server: Server;
let base: string;
let adminUserId: string;
let adminCookie: string;
let csrfToken: string;

/** fetch() as the logged-in admin: session cookie + CSRF header + JSON body. */
function adminFetch(path: string, init: { method?: string; body?: unknown; csrf?: boolean; auth?: boolean } = {}) {
  const { method = 'GET', body, csrf = true, auth = true } = init;
  const headers: Record<string, string> = {};
  if (auth) headers.cookie = adminCookie;
  if (auth && csrf) headers['x-csrf-token'] = csrfToken;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

/** A multipart guest upload. The bytes only need to pass the %PDF- magic check. */
function guestUpload(headers: Record<string, string> = {}) {
  const pdf = Buffer.from('%PDF-1.4\n% smoke-test placeholder, not a real report\n');
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'ati-report.pdf');
  return fetch(`${base}/api/assessment-reports/upload`, { method: 'POST', body: form, headers });
}

beforeAll(async () => {
  // The route handlers log generously; keep the failure output readable.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  app = express();
  app.use(express.json());
  // Mirrors server/index.ts, minus the Postgres-backed store: the admin auth
  // and CSRF middleware key everything off req.sessionID and the cookie, so
  // the store is not what is under test here.
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

  // A real admin: users row + admin_users row, then the real login route.
  const [admin] = await db
    .insert(schema.users)
    .values({
      username: 'smoke-admin',
      email: ADMIN.email,
      password: await bcrypt.hash(ADMIN.password, 4),
      firstName: 'Smoke',
      lastName: 'Admin',
      role: 'admin',
    })
    .returning();
  adminUserId = admin.id;
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
  expect(loginBody.csrfToken).toMatch(/^[0-9a-f]{64}$/);
  const setCookie = login.headers.get('set-cookie');
  if (!setCookie) throw new Error('login did not set a session cookie');
  adminCookie = setCookie.split(';')[0];
  csrfToken = loginBody.csrfToken;
}, 60_000);

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  await pool.end();
});

describe('table approval audit trail', () => {
  let tableIds: string[];

  beforeAll(async () => {
    const [doc] = await db
      .insert(schema.documents)
      .values({ title: 'Smoke document', type: 'pdf', sourceUri: 'smoke://document', contentHash: 'smoke-hash' })
      .returning();
    const tables = await db
      .insert(schema.extractedTables)
      .values(
        [0, 1, 2, 3].map((tableIndex) => ({
          documentId: doc.id,
          tableIndex,
          rowCount: 2,
          columnCount: 2,
          extractionMethod: 'manual',
        })),
      )
      .returning();
    tableIds = tables.map((t) => t.id);
  });

  it('approve writes the approval row and attributes it to the admin', async () => {
    const res = await adminFetch('/api/admin/tables/approve', {
      method: 'POST',
      body: { tableId: tableIds[0], action: 'approve', notes: 'looks right' },
    });
    expect(res.status, await res.text().catch(() => '')).toBe(200);

    const [table] = await db.select().from(schema.extractedTables).where(eq(schema.extractedTables.id, tableIds[0]));
    expect(table.status).toBe('approved');
    expect(table.approvedBy).toBe(adminUserId);
    expect(table.approvedAt).toBeInstanceOf(Date);

    // The bug: this insert used adminId/createdAt, and reviewer_id is NOT NULL.
    const approvals = await db.select().from(schema.tableApprovals).where(eq(schema.tableApprovals.tableId, tableIds[0]));
    expect(approvals).toHaveLength(1);
    expect(approvals[0].reviewerId).toBe(adminUserId);
    expect(approvals[0].action).toBe('approved');
    expect(approvals[0].notes).toBe('looks right');
    expect(approvals[0].reviewedAt).toBeInstanceOf(Date);
  });

  it('reject records who rejected it and when (the columns migration 0001 added)', async () => {
    const res = await adminFetch('/api/admin/tables/approve', {
      method: 'POST',
      body: { tableId: tableIds[1], action: 'reject', notes: 'header row is data' },
    });
    expect(res.status).toBe(200);

    const [table] = await db.select().from(schema.extractedTables).where(eq(schema.extractedTables.id, tableIds[1]));
    expect(table.status).toBe('rejected');
    expect(table.rejectedBy).toBe(adminUserId);
    expect(table.rejectedAt).toBeInstanceOf(Date);
    expect(table.approvedBy).toBeNull();

    const approvals = await db.select().from(schema.tableApprovals).where(eq(schema.tableApprovals.tableId, tableIds[1]));
    expect(approvals).toHaveLength(1);
    expect(approvals[0].reviewerId).toBe(adminUserId);
    expect(approvals[0].action).toBe('rejected');
  });

  it('bulk approve writes one attributed approval row per table', async () => {
    const ids = [tableIds[2], tableIds[3]];
    const res = await adminFetch('/api/admin/tables/bulk-action', {
      method: 'POST',
      body: { tableIds: ids, action: 'approve', notes: 'batch' },
    });
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.affectedTables).toBe(2);

    const tables = await db.select().from(schema.extractedTables).where(inArray(schema.extractedTables.id, ids));
    expect(tables.map((t) => t.status)).toEqual(['approved', 'approved']);
    expect(tables.map((t) => t.approvedBy)).toEqual([adminUserId, adminUserId]);

    const approvals = await db.select().from(schema.tableApprovals).where(inArray(schema.tableApprovals.tableId, ids));
    expect(approvals).toHaveLength(2);
    expect(new Set(approvals.map((a) => a.reviewerId))).toEqual(new Set([adminUserId]));
  });

  it('still refuses without a CSRF token, and without a session', async () => {
    const before = await db.select().from(schema.tableApprovals);

    const noCsrf = await adminFetch('/api/admin/tables/approve', {
      method: 'POST',
      csrf: false,
      body: { tableId: tableIds[0], action: 'reject' },
    });
    expect(noCsrf.status).toBe(403);

    const noSession = await adminFetch('/api/admin/tables/approve', {
      method: 'POST',
      auth: false,
      body: { tableId: tableIds[0], action: 'reject' },
    });
    expect(noSession.status).toBe(401);

    const after = await db.select().from(schema.tableApprovals);
    expect(after).toHaveLength(before.length);
  });
});

describe('guest upload identity', () => {
  it('creates the guest user under the id the report is linked to', async () => {
    const res = await guestUpload({ 'x-session-id': 'smoke-guest-1' });
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.isAuthenticated).toBe(false);
    expect(body.guestId).toMatch(/^guest_/);
    expect(body.reportId).toBeTruthy();

    // The bug: createUser dropped the supplied id, so this row had a random
    // uuid and the report's user_id pointed at nothing.
    const users = await db.select().from(schema.users).where(eq(schema.users.id, body.guestId));
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('guest');
    expect(users[0].username).toBe(body.guestId);

    const reports = await db.select().from(schema.assessmentReports).where(eq(schema.assessmentReports.userId, body.guestId));
    expect(reports.map((r) => r.id)).toEqual([body.reportId]);
    expect(reports[0].processingStatus).toBe('completed');

    // And the guest can read it back by that id, which is how the client
    // fetches results without an account.
    const list = await fetch(`${base}/api/assessment-reports/guest/${body.guestId}`);
    expect(list.status).toBe(200);
    expect((await list.json()).map((r: { id: string }) => r.id)).toEqual([body.reportId]);
  });

  it('a second upload from the same browser lands on the same guest user', async () => {
    // No cookie is involved: saveUninitialized is false and nothing writes
    // to an anonymous session, so the browser never gets one. The client
    // carries identity itself -- it stores the guestId the server returns
    // and sends it back as x-session-id. That header has to be what the
    // server keys on; keying on req.sessionID first (a fresh random id on
    // every cookie-less request) gave each upload a brand-new guest user.
    const first = await guestUpload({ 'x-session-id': 'smoke-guest-2' });
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.guestId).toBe('guest_smoke-guest-2');
    expect(first.headers.get('set-cookie')).toBeNull();

    const second = await guestUpload({ 'x-session-id': firstBody.guestId });
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody.guestId).toBe(firstBody.guestId);

    const users = await db.select().from(schema.users).where(eq(schema.users.id, firstBody.guestId));
    expect(users).toHaveLength(1);
    const reports = await db.select().from(schema.assessmentReports).where(eq(schema.assessmentReports.userId, firstBody.guestId));
    expect(reports).toHaveLength(2);
  });

  it('a malformed x-session-id is not used as a primary key', async () => {
    const res = await guestUpload({ 'x-session-id': 'not a valid id; drop table users' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.guestId).toMatch(/^guest_[A-Za-z0-9_-]+$/);
    expect(body.guestId).not.toContain(' ');
  });
});

describe('/api/admin/users*', () => {
  let studentA: { id: string; email: string };
  let studentB: { id: string; email: string };

  beforeAll(async () => {
    [studentA, studentB] = await db
      .insert(schema.users)
      .values([
        { username: 'smoke-student-a', email: 'smoke-student-a@example.com', password: 'x', firstName: 'Ada', lastName: 'Lovelace' },
        { username: 'smoke-student-b', email: 'smoke-student-b@example.com', password: 'x' },
      ])
      .returning();
    await db.insert(schema.assessmentReports).values({
      userId: studentA.id,
      fileName: 'ati-a.pdf',
      overallScore: '82.50',
      processingStatus: 'completed',
    });
  });

  it('lists users with a display name that falls back to the username', async () => {
    const res = await adminFetch('/api/admin/users');
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);

    const a = body.find((u: { email: string }) => u.email === studentA.email);
    const b = body.find((u: { email: string }) => u.email === studentB.email);
    expect(a).toMatchObject({ id: studentA.id, name: 'Ada Lovelace' });
    expect(b).toMatchObject({ id: studentB.id, name: 'smoke-student-b' });
    expect(typeof a.createdAt).toBe('string');
  });

  it('search joins real assessment statistics', async () => {
    const res = await adminFetch('/api/admin/users/search?email=smoke-student');
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body).toHaveLength(2);

    const a = body.find((u: { id: string }) => u.id === studentA.id);
    const b = body.find((u: { id: string }) => u.id === studentB.id);
    expect(a).toMatchObject({ name: 'Ada Lovelace', assessmentCount: 1, averageScore: 83 });
    expect(a.lastAssessment).toBeTruthy();
    expect(b).toMatchObject({ name: 'smoke-student-b', assessmentCount: 0 });
    expect(b.averageScore).toBeUndefined();
  });

  it('fetches one user by its uuid, and 404s an unknown uuid instead of choking on parseInt', async () => {
    const found = await adminFetch(`/api/admin/users/${studentA.id}`);
    const foundBody = await found.json();
    expect(found.status, JSON.stringify(foundBody)).toBe(200);
    expect(foundBody).toMatchObject({ id: studentA.id, email: studentA.email, name: 'Ada Lovelace', assessmentCount: 1 });

    const missing = await adminFetch('/api/admin/users/00000000-0000-4000-8000-000000000000');
    expect(missing.status).toBe(404);
  });
});

describe('resource mapper', () => {
  let topicId: string;
  let resourceId: string;
  let mappingId: string;

  beforeAll(async () => {
    const [topic] = await db.insert(schema.nursingTopics).values({ name: 'Smoke topic' }).returning();
    topicId = topic.id;
  });

  it('every request the page makes targets a registered route', () => {
    const source = readFileSync(resolve(__dirname, '../../client/src/pages/admin/resource-mapper.tsx'), 'utf8');
    const calls = [...source.matchAll(/apiRequest\(\s*'([A-Z]+)'\s*,\s*(?:'([^']+)'|`([^`]+)`)/g)].map((m) => ({
      method: m[1].toLowerCase(),
      // Template placeholders such as ${mappingId} stand in for a path param.
      path: (m[2] ?? m[3]).replace(/\$\{[^}]+\}/g, '00000000-0000-4000-8000-000000000000'),
    }));
    expect(calls.length).toBeGreaterThanOrEqual(6);

    const router = (app as any)._router ?? (app as any).router;
    const layers: Array<{ route?: { methods: Record<string, boolean> }; regexp: RegExp }> = router.stack;
    for (const { method, path } of calls) {
      const matched = layers.some((l) => l.route?.methods[method] && l.regexp.test(path));
      expect(matched, `${method.toUpperCase()} ${path} is not registered`).toBe(true);
    }
  });

  it('create resource, then map it to the topic', async () => {
    const created = await adminFetch('/api/admin/learning-resources', {
      method: 'POST',
      body: { title: 'Smoke video', type: 'video', url: 'https://example.com/smoke', duration: 12, topicId },
    });
    const createdBody = await created.json();
    expect(created.status, JSON.stringify(createdBody)).toBe(200);
    expect(createdBody.success).toBe(true);
    resourceId = createdBody.resource.id;
    expect(resourceId).toBeTruthy();

    const mapped = await adminFetch('/api/admin/resources/mapping', {
      method: 'POST',
      body: { topicId, resourceId, notes: 'from the page', isAiSuggested: false, confidence: 1.0 },
    });
    const mappedBody = await mapped.json();
    expect(mapped.status, JSON.stringify(mappedBody)).toBe(200);
    mappingId = mappedBody.mapping.id;

    const [row] = await db.select().from(schema.resourceMappings).where(eq(schema.resourceMappings.id, mappingId));
    expect(row).toMatchObject({ topicId, resourceId, notes: 'from the page', isAiSuggested: false, isActive: true });
    expect(row.mappedBy).toBe(adminUserId);
    expect(Number(row.confidence)).toBe(1);
  });

  it('toggle a mapping inactive', async () => {
    const res = await adminFetch(`/api/admin/resources/mapping/${mappingId}`, { method: 'PUT', body: { isActive: false } });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(schema.resourceMappings).where(eq(schema.resourceMappings.id, mappingId));
    expect(row.isActive).toBe(false);
  });

  it('bulk map', async () => {
    const res = await adminFetch('/api/admin/resources/bulk-map', {
      method: 'POST',
      body: { mappings: [{ topicId, resourceId, notes: 'bulk' }] },
    });
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.created).toBe(1);
    const [row] = await db.select().from(schema.resourceMappings).where(eq(schema.resourceMappings.id, body.mappings[0].id));
    expect(row).toMatchObject({ topicId, resourceId, notes: 'bulk', isActive: true, mappedBy: adminUserId });
  });

  it('delete a mapping', async () => {
    const res = await adminFetch(`/api/admin/resources/mapping/${mappingId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const rows = await db.select().from(schema.resourceMappings).where(eq(schema.resourceMappings.id, mappingId));
    expect(rows).toHaveLength(0);
  });
});
