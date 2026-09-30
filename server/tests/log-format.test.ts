import { describe, it, expect } from 'vitest';
import winston from 'winston';
import { Writable } from 'node:stream';
import { consoleFormat } from '../logger';

/**
 * Regression tests for what the console format actually prints.
 *
 * On Render the console IS the log -- the file transports in server/logger.ts
 * write to an ephemeral disk nobody reads. The format printed only the message
 * plus the error/stack that AppLogger.error attaches, so every other structured
 * call lost its payload. The live service logged
 *
 *     warn: Health check detected issues
 *
 * on every platform probe, dropping the object that names WHICH check is
 * degraded and the database response time behind it, which left an alarm that
 * repeated indefinitely and identified nothing.
 *
 * These tests pin that metadata survives to the console line, for warn as well
 * as for error, and that a metadata object can never throw inside the format.
 */

// Drive the real format through a real winston logger, but into a captured
// stream rather than this module's Console/File transports.
function capture(write: (logger: winston.Logger) => void): string[] {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });

  const logger = winston.createLogger({
    level: 'debug',
    transports: [new winston.transports.Stream({ stream: sink, format: consoleFormat })],
  });

  write(logger);
  logger.close();
  // Strip the ANSI codes winston's colorize() adds, so assertions read on text.
  return lines.map((line) => line.replace(/\[\d+m/g, ''));
}

describe('console log format', () => {
  it('prints the metadata a warn carries, not just its message', () => {
    const [line] = capture((logger) =>
      logger.warn('Health check detected issues', {
        status: 'degraded',
        checks: { database: { status: 'warning', responseTime: 137 } },
      })
    );

    expect(line).toContain('Health check detected issues');
    // The whole point: the reader can tell which check is unhappy and by how
    // much, from the console line alone.
    expect(line).toContain('"database"');
    expect(line).toContain('"status":"warning"');
    expect(line).toContain('"responseTime":137');
    expect(line).toContain('"status":"degraded"');
  });

  it('prints the metadata an info carries', () => {
    const [line] = capture((logger) =>
      logger.info('Performance: memory_heap_used = 57MB', { type: 'performance', value: 57 })
    );

    expect(line).toContain('"type":"performance"');
    expect(line).toContain('"value":57');
  });

  it('still appends the error message and indented stack', () => {
    const [line] = capture((logger) =>
      logger.error('Database health check failed', {
        error: 'connection refused',
        stack: 'Error: connection refused\n    at probe',
      })
    );

    expect(line).toContain('Database health check failed connection refused');
    expect(line).toContain('\n    Error: connection refused');
    // error and stack keep their dedicated rendering; they are not also dumped
    // into the JSON tail.
    expect(line).not.toContain('"error":');
    expect(line).not.toContain('"stack":');
  });

  it('adds no trailing JSON when there is no metadata', () => {
    const [line] = capture((logger) => logger.info('Health check endpoints registered'));

    expect(line.trim().endsWith('Health check endpoints registered')).toBe(true);
  });

  it('degrades rather than throwing on metadata that cannot be serialized', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;

    const [line] = capture((logger) => logger.warn('Cycle in metadata', cyclic));

    expect(line).toContain('Cycle in metadata');
    expect(line).toContain('[unserializable metadata]');
  });
});
