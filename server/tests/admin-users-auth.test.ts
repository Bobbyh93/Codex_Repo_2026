import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** server/, as seen from server/tests/. */
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Regression test for unauthenticated PII exposure.
 *
 * server/routes.ts registered the three /api/admin/users* endpoints with no
 * middleware at all:
 *
 *   app.get("/api/admin/users/search", searchUsersByEmail);
 *   app.get("/api/admin/users/:id",    getUserById);
 *   app.get("/api/admin/users",        getAllUsers);
 *
 * They return every user's email, first and last name, username, and (for
 * /search and /:id) assessment counts and average scores. The gap went
 * unnoticed because the handlers selected columns that do not exist, so every
 * call raised a SQL error before returning anything. Repairing the columns
 * turned a guaranteed 500 into a working anonymous PII endpoint.
 *
 * These tests pin the guard. The 401 assertions alone would pass against
 * routes that are simply broken, so each one is paired with a check that the
 * same route DOES reach its handler once a valid admin session is present.
 */

const select = vi.fn();

vi.mock('../db', () => {
  // Minimal chainable stub: every builder method returns the same object, and
  // awaiting it resolves to an empty result set.
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (resolve: any) => resolve([]);
        return () => chain;
      },
    },
  );
  return {
    db: { select: (...args: unknown[]) => (select(...args), chain) },
    pool: {},
  };
});

vi.mock('../logger', () => ({
  AppLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { requireAdminSession } = await import('../admin-auth-session');
const { searchUsersByEmail, getUserById, getAllUsers } = await import('../user-search-routes');

const PATHS = [
  '/api/admin/users',
  '/api/admin/users/search?email=a',
  '/api/admin/users/00000000-0000-0000-0000-000000000000',
];

/** Builds the app, optionally injecting a valid admin session. */
async function startApp(withSession: boolean) {
  const app = express();

  app.use((req: any, _res, next) => {
    req.session = withSession
      ? {
          adminUser: {
            userId: 'admin-1',
            email: 'admin@example.com',
            role: 'admin',
            permissions: ['*'],
            loginTime: new Date(),
            lastActivity: new Date(),
          },
          save: (cb: () => void) => cb(),
        }
      : {};
    next();
  });

  // Mirrors server/routes.ts registration order and middleware exactly.
  app.get('/api/admin/users/search', requireAdminSession, searchUsersByEmail);
  app.get('/api/admin/users/:id', requireAdminSession, getUserById);
  app.get('/api/admin/users', requireAdminSession, getAllUsers);

  const server: Server = await new Promise((done) => {
    const s = app.listen(0, '127.0.0.1', () => done(s));
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  return { server, base: `http://127.0.0.1:${addr.port}` };
}

let server: Server | undefined;

beforeEach(() => {
  select.mockClear();
});

afterEach(async () => {
  if (server) await new Promise<void>((done) => server!.close(() => done()));
  server = undefined;
});

describe('/api/admin/users* require an admin session', () => {
  it.each(PATHS)('rejects an unauthenticated GET %s with 401', async (path) => {
    const started = await startApp(false);
    server = started.server;

    const res = await fetch(`${started.base}${path}`);
    const body = await res.text();

    expect(res.status).toBe(401);
    // The whole point: no user data may appear in an unauthorized response.
    expect(body).not.toContain('@');
    expect(body.toLowerCase()).not.toContain('firstname');
    // Non-vacuous: the handler must not have run at all.
    expect(select).not.toHaveBeenCalled();
  });

  it.each(PATHS)('lets an authenticated admin through on %s', async (path) => {
    const started = await startApp(true);
    server = started.server;

    const res = await fetch(`${started.base}${path}`);

    // Proves the 401s above come from the guard and not from a broken route:
    // with a session, the request reaches the handler and queries the db.
    expect(res.status).not.toBe(401);
    expect(select).toHaveBeenCalled();
  });
});

/**
 * The suite above mounts its own bare express app. That pins what
 * requireAdminSession *does*, but not that it is actually *attached* to the
 * real application: the registrations are re-declared locally, so deleting the
 * guard from server/routes.ts leaves every assertion above green. That was
 * verified by doing it -- all six passed against a routes.ts with the
 * middleware stripped back out, which is the exact regression this file exists
 * to prevent.
 *
 * registerRoutes() cannot simply be called here to close the gap: it is a
 * 3,700-line function with 62 dynamic imports that pulls in storage, multer,
 * the PDF generator and the ATI parser, and mocking that surface would be far
 * more brittle than the thing being tested.
 *
 * So assert against the source of the registrations instead. This is the
 * assertion that fails if someone drops the guard from the real app.
 */

/** Registrations are one-liners; a multi-line one trips the count assertion. */
const REGISTRATION = /\b(?:app|router)\.[a-z]+\(\s*['"`](\/api\/admin\/users[^'"`]*)['"`]/;

/** Every /api/admin/users* express registration in server/, excluding tests. */
function adminUserRegistrations(): { file: string; line: string; path: string }[] {
  const found: { file: string; line: string; path: string }[] = [];
  // readdirSync returns OS-native separators, so normalise before excluding
  // this directory -- on Windows the entries look like `tests\foo.test.ts`.
  const files = readdirSync(SERVER_DIR, { recursive: true, encoding: 'utf8' })
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => f.endsWith('.ts') && !f.split('/').includes('tests'));

  for (const file of files) {
    const source = readFileSync(path.join(SERVER_DIR, file), 'utf8');
    for (const line of source.split('\n')) {
      const match = REGISTRATION.exec(line);
      if (match) found.push({ file, line: line.trim(), path: match[1] });
    }
  }
  return found;
}

describe('server/routes.ts wires the guard onto the real app', () => {
  it('registers exactly the three known /api/admin/users* routes', () => {
    // Guards against a vacuous pass: if the paths move, are inlined across
    // several lines, or a fourth appears, every assertion below would other-
    // wise silently check nothing.
    expect(adminUserRegistrations().map((r) => r.path).sort()).toEqual([
      '/api/admin/users',
      '/api/admin/users/:id',
      '/api/admin/users/search',
    ]);
  });

  it.each(['/api/admin/users', '/api/admin/users/:id', '/api/admin/users/search'])(
    'applies requireAdminSession to %s',
    (routePath) => {
      const registration = adminUserRegistrations().find((r) => r.path === routePath);
      expect(registration, `no registration found for ${routePath}`).toBeDefined();
      // These return student PII. An unguarded registration is the bug.
      expect(registration!.line).toContain('requireAdminSession');
    },
  );
});
