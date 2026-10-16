import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
// Uses Playwright's Chromium; set CHROMIUM_PATH to use a system Chromium (e.g. /usr/bin/chromium on the Pi).
export default defineConfig({ testDir: './tests', testMatch: 'browser.spec.js', workers: 1, timeout: 300000, use: { baseURL: 'http://127.0.0.1:44320', headless: true, launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } }, webServer: { command: 'node server/index.js', url: 'http://127.0.0.1:44320/api/lobby', env: { PORT: '44320', DATA_DIR: mkdtempSync(path.join(tmpdir(),'code-shift-browser-')), INSTRUCTOR_PASSWORD: 'browser-test-key' }, reuseExistingServer: false } });
