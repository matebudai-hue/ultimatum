import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { allowedHosts: ['terminal.local'] },
  base: './',
  build: {
    target: ['es2019', 'safari14'],
  },
});
