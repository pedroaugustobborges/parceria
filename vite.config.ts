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
          // Emotion must live alongside MUI — they share React context
          if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/')) return 'vendor-mui';
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          // React + recharts + everything else in one chunk to avoid circular
          // cross-chunk deps (recharts → react-smooth → raf → recharts cycle)
          if (id.includes('node_modules/')) return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
})
