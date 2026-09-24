import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    allowedHosts: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        kelola_kapal: resolve(__dirname, 'kelola_kapal.html'),
        staff_dashboard: resolve(__dirname, 'staff_dashboard.html'),
        user_management: resolve(__dirname, 'user_management.html'),
        staff: resolve(__dirname, 'staff.html')
      }
    }
  }
});
