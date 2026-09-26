import { defineConfig } from 'vite';
import { Buffer } from 'buffer';

export default defineConfig({
  define: {
    // simple-peer and its deps need these Node globals in the browser
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['simple-peer'],
  },
  resolve: {
    alias: {
      // polyfill node built-ins used by simple-peer
      buffer: 'buffer',
      process: 'process/browser',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0].toString();
          }
        },
      },
    },
  },
});
