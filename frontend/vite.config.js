import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdfjs-dist/build/pdf'],
  },
  build: {
    rollupOptions: {
        // external removed to allow bundling pdfjs-dist
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Prioritize react-vendor, then pdfjs-vendor, then vendor
              if (/node_modules[\\/]react/.test(id)) return 'react-vendor';
              if (/node_modules[\\/]pdfjs-dist/.test(id)) return 'pdfjs-vendor';
              return 'vendor';
            }
          },
        },
    },
  },
})
