import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/portal/',
  root: 'portal',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        headers: {
          'X-Forwarded-Host': 'localhost:5174',
          'X-Forwarded-Proto': 'http',
        },
      },
    },
  },
  build: {
    outDir: '../dist-portal',
    emptyOutDir: true,
  },
});
