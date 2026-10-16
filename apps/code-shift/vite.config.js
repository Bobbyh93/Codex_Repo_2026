import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// css.postcss is set inline so Vite does not pick up the repository root's PostCSS (Tailwind) config.
export default defineConfig({ plugins: [react()], css: { postcss: { plugins: [] } }, server: { proxy: { '/api': 'http://127.0.0.1:4317', '/live': { target: 'ws://127.0.0.1:4317', ws: true } } } });
