import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import express from 'express';
import type { Server } from 'http';

/**
 * Regression tests for the health probe.
 *
 * server/index.ts registered its own `app.get('/health')` returning a static
 * `{ status: 'ok' }` BEFORE calling registerHealthEndpoints(). Express matches
 * routes in registration order, so the real database-checking handler in
 * server/health.ts was unreachable dead code. Render's healthCheckPath is
 * /health, which meant an instance that could not reach Postgres still
 * reported healthy and stayed in service.
 *
 * These tests pin three things:
 *   1. /health actually fails when the database is unreachable.
 *   2. /health does NOT fail merely because memory is tight, and does not make
 *      an outbound SMTP call on every probe -- both would flap a platform probe.
 *   3. No second /health route is registered ahead of the real one.
 */

const execute = vi.fn();
const testConnection = vi.fn();

vi.mock('../db', () => ({
  db: { execute: (...args: unknown[]) => execute(...args) },
  pool: {},
}));

vi.mock('../logger', () => ({
  AppLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../email-service', () => ({
  EmailService: { testConnection: (...a: unknown[]) => testConnection(...a) },
}));

const { registerHealthEndpoints, HealthCheckService } = await import('../health');

let server: Server;
let base: string;

beforeEach(async () => {
  execute.mockReset();
  testConnection.mockReset();
  execute.mockResolvedValue({ rows: [] });
  testConnection.mockResolvedValue({ success: true });

  const app = express();
  registerHealthEndpoints(app);
  await new Promise<void>((done) => {
    server = app.listen(0, '127.0.0.1', () => done());
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

describe('/health as a platform probe', () => {
  it('returns 200 and the real check when the database is reachable', async () => {
    const res = await fetch(`${base}/health`);
    const body = await res.json();

    expect(res.status).toBe(200);
    // The real handler reports per-dependency checks. The static stub that used
    // to shadow it returned only { status, message }.
    expect(body.checks?.database).toBeDefined();
    expect(body.checks.database.status).not.toBe('error');
    expect(body.message).not.toBe('Server is running');
    // Non-vacuous: the DB really was consulted.
    expect(execute).toHaveBeenCalled();
  });

  it('returns 503 when the database is unreachable', async () => {
    execute.mockRejectedValue(new Error('connection refused'));

    const res = await fetch(`${base}/health`);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.checks.database.status).toBe('error');
  });

  it('does not open an SMTP connection on every probe', async () => {
    await fetch(`${base}/health`);
    expect(testConnection).not.toHaveBeenCalled();

    // ...but remains available on request.
    const res = await fetch(`${base}/health?email=1`);
    const body = await res.json();
    expect(testConnection).toHaveBeenCalled();
    expect(body.checks.email).toBeDefined();
    expect(body.checks.email.status).toBe('ok');
  });

  it('reports email as a warning when it is not configured', async () => {
    // testConnection resolves { success, error? }. The object is always truthy,
    // so testing it directly reported 'ok' unconditionally and the check was
    // inert. This pins the success flag being read.
    testConnection.mockResolvedValue({ success: false, error: 'not configured' });

    const res = await fetch(`${base}/health?email=1`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checks.email.status).toBe('warning');
  });

  it('stays in service under memory pressure, reporting it in the body', async () => {
    // Memory pressure does not stop an instance serving requests. Failing the
    // probe here would have the platform restart it in a loop, which is what
    // the previous status-code mapping (503 on any 'unhealthy') would do.
    const spy = vi
      .spyOn(HealthCheckService, 'checkMemory')
      .mockReturnValue({ status: 'error', message: 'Critical memory usage' });

    const res = await fetch(`${base}/health`);
    const body = await res.json();

    expect(spy).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(body.status).toBe('unhealthy');
    expect(body.checks.memory.status).toBe('error');

    spy.mockRestore();
  });

  it('measures heap against the heap ceiling, not committed heapTotal', async () => {
    const res = await fetch(`${base}/health`);
    const body = await res.json();
    const d = body.checks.memory.details;

    expect(d.heapLimit).toBeGreaterThan(0);
    // heapTotal is what V8 has committed and can sit just under heapUsed;
    // the ceiling is strictly larger, so the ratio stays meaningful.
    expect(d.heapLimit).toBeGreaterThanOrEqual(d.heapTotal);
    expect(Number(d.heapUsedPercent)).toBeCloseTo((d.heapUsed / d.heapLimit) * 100, 0);
  });
});

describe('no route shadows the real /health', () => {
  it('server/index.ts does not register its own /health handler', () => {
    const src = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
    // Strip comments first -- the comment explaining this constraint mentions
    // the very pattern being searched for, and would match itself.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const registrations = code.match(/app\.get\(\s*['"`]\/health['"`]/g) ?? [];
    expect(registrations).toHaveLength(0);
  });
});
