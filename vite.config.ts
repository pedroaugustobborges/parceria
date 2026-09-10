import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/@mui/icons-material')) return 'vendor-mui-icons';
          // Group emotion with MUI — they share React context and must initialize together
          if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/')) return 'vendor-mui';
          // Include scheduler (React internals) alongside React
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) return 'vendor-react';
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          if (id.includes('node_modules/')) return 'vendor-misc';
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
})
