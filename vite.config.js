import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  appType: 'spa',
  server: {
    // Lets Simple Browser / IPv4+IPv6 resolve `localhost` and LAN preview reliably.
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
