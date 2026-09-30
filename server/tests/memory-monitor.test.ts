import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHeapStatistics } from 'v8';

/**
 * Regression test for the memory alarm in server/middleware/monitoring.ts.
 *
 * memoryMonitor() measured heapUsed against heapTotal. heapTotal is only the
 * heap V8 has committed so far, and V8 keeps it just ahead of heapUsed, so a
 * perfectly healthy process sits above 90% of it most of the time. The live
 * Render service logged
 *
 *     warn: High memory usage detected
 *
 * every 60 seconds while holding 57MB of a multi-gigabyte ceiling -- an alarm
 * that is always on, and so carries no information.
 *
 * server/health.ts:checkMemory already measures against V8's hard ceiling
 * (heap_size_limit), with a comment explaining why. These tests pin that the
 * monitor now agrees, and that a genuinely exhausted heap still warns.
 */

const warn = vi.fn();

vi.mock('../logger', () => ({
  AppLogger: {
    warn: (...args: unknown[]) => warn(...args),
    performance: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const { memoryMonitor } = await import('../middleware/monitoring');

const MB = 1024 * 1024;
const heapLimit = getHeapStatistics().heap_size_limit;

function runOneTick(heapUsed: number, heapTotal: number) {
  vi.spyOn(process, 'memoryUsage').mockReturnValue({
    rss: heapTotal,
    heapTotal,
    heapUsed,
    external: 0,
    arrayBuffers: 0,
  } as NodeJS.MemoryUsage);

  memoryMonitor();
  vi.advanceTimersByTime(60_000);
}

beforeEach(() => {
  warn.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('memoryMonitor', () => {
  it('does not warn about a small heap that nearly fills the committed heapTotal', () => {
    // The live service's actual shape: 57MB in use, V8 having committed just a
    // little more than that. 95% of heapTotal, well under 1% of the ceiling.
    runOneTick(57 * MB, 60 * MB);

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when the heap is genuinely near V8 ceiling', () => {
    runOneTick(Math.floor(heapLimit * 0.95), Math.floor(heapLimit * 0.96));

    expect(warn).toHaveBeenCalledTimes(1);
    const [message, metadata] = warn.mock.calls[0];
    expect(message).toBe('High memory usage detected');
    // The ceiling is reported too, so the percentage in the log can be checked
    // against something.
    expect(metadata).toMatchObject({ heapLimit: Math.round(heapLimit / MB) });
  });
});
