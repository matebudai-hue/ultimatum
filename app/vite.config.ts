import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forward client SDK traffic only. Emulator management endpoints stay on loopback.
const proxy = {
  '/identitytoolkit.googleapis.com/': 'http://127.0.0.1:9099',
  '/securetoken.googleapis.com/': 'http://127.0.0.1:9099',
  '/google.firestore.v1.Firestore/': 'http://127.0.0.1:8088',
  '/v1/projects/demo-kreditjatek-sandbox/databases/': 'http://127.0.0.1:8088',
};

export default defineConfig({
  plugins: [react()],
  server: { allowedHosts: ['terminal.local'], proxy },
  preview: { proxy },
  base: './',
  build: {
    target: ['es2019', 'safari14'],
  },
});
