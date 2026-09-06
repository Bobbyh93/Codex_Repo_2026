import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'http';

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
    db: {
      select: (...args: unknown[]) => (select(...args), chain),
      // The rest exist only so importing the whole route tree does not explode;
      // `select` is the one the handlers under test actually reach for.
      insert: () => chain,
      update: () => chain,
      delete: () => chain,
      execute: async () => ({ rows: [] }),
      query: new Proxy(
        {},
        { get: () => ({ findFirst: async () => null, findMany: async () => [] }) },
      ),
    },
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
 * The suite above mounts its own bare express app and re-declares the three
 * registrations locally. That pins what requireAdminSession *does*, but it
 * never imports server/routes.ts, so it cannot see whether the guard is
 * actually *attached* to the real application.
 *
 * Verified by doing it: with the middleware stripped back out of
 * server/routes.ts -- the endpoints once again serving student PII to
 * anonymous callers -- all six tests above stayed green. That is precisely the
 * blind spot that let these routes ship unguarded in the first place.
 *
 * So drive the real registerRoutes(). It is a 3,700-line function with 62
 * dynamic imports, but it only ever calls methods on the `app` it is handed,
 * so a recording stub is enough to capture what it wires up: no express, no
 * listening socket, and `db` mocked exactly as it is above.
 */

type Registration = { method: string; path: unknown; handlers: unknown[] };

/** Stands in for an Express app, recording registrations instead of serving. */
function recordingApp(recorded: Registration[]) {
  const app: any = {};
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'all', 'use', 'options', 'head']) {
    app[method] = (path: unknown, ...handlers: unknown[]) => {
      recorded.push({ method, path, handlers });
      return app;
    };
  }
  app.set = () => app;
  app.engine = () => app;
  app.locals = {};
  return app;
}

async function adminUserRoutes(): Promise<Registration[]> {
  const recorded: Registration[] = [];
  const { registerRoutes } = await import('../routes');
  await registerRoutes(recordingApp(recorded));

  // Guard against a vacuous pass: if registerRoutes stopped wiring anything --
  // or quietly failed part way -- the filtered assertions below would hold
  // trivially. It declares a few hundred routes.
  expect(recorded.length).toBeGreaterThan(100);

  return recorded.filter(
    (r) => typeof r.path === 'string' && (r.path as string).startsWith('/api/admin/users'),
  );
}

describe('registerRoutes attaches the guard to the real app', () => {
  // Generous timeout: a cold transform of routes.ts and its 62 dynamic imports
  // runs well past vitest's 5s default.
  it('wires requireAdminSession onto every /api/admin/users* route', async () => {
    const routes = await adminUserRoutes();

    // Pins the set itself, so a renamed, relocated or added route fails here
    // rather than silently dropping out of the guard check below.
    expect(routes.map((r) => r.path).sort()).toEqual([
      '/api/admin/users',
      '/api/admin/users/:id',
      '/api/admin/users/search',
    ]);

    for (const route of routes) {
      // Identity, not name: a same-named local decoy would not satisfy this.
      expect(route.handlers, `${route.path} is registered without the guard`).toContain(
        requireAdminSession,
      );
    }
  }, 60_000);
});
