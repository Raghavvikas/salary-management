import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The UI talks to /api on its own origin in every environment, so there is no
    // base URL to configure and no CORS to think about in production.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
