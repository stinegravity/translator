import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor';
          }

          if (id.includes('framer-motion')) {
            return 'motion-vendor';
          }

          if (id.includes('lucide-react')) {
            return 'icons-vendor';
          }

          if (id.includes('better-auth')) {
            return 'auth-vendor';
          }

          if (id.includes('wavesurfer.js')) {
            return 'audio-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
});
