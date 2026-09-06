import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Mirrors the `paths` entries in tsconfig.json. Without these, any test that
  // imports a server module fails at import time with "Cannot find package
  // '@shared/schema'", since most of server/ imports the shared schema.
  resolve: {
    alias: {
      '@shared': path.resolve(rootDir, 'shared'),
      '@': path.resolve(rootDir, 'client/src'),
    },
  },
  test: {
    // Test-only placeholder, NOT a real credential and not a real service.
    // server/auth.ts throws at import time if JWT_SECRET is unset (deliberately
    // no fallback), which blocks importing anything downstream of it.
    //
    // DATABASE_URL is intentionally NOT set here: server/db.ts also throws at
    // import time without it, and we want that to stay loud. A test reaching
    // real db.ts means it forgot to `vi.mock('../db')`, and should fail
    // immediately rather than quietly try to open a connection.
    env: {
      JWT_SECRET: 'test-only-placeholder-not-a-real-secret',
    },
    include: ['server/tests/**/*.test.ts'],
    environment: 'node',
  },
});
