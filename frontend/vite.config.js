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
              // React and related only in react-vendor
              if (/node_modules[\\/](react|react-dom|react-router|react-router-dom)/.test(id)) return 'react-vendor';
              // pdfjs-dist only in pdfjs-vendor
              if (/node_modules[\\/]pdfjs-dist/.test(id)) return 'pdfjs-vendor';
              // Lodash and similar only in vendor
              if (/node_modules[\\/](lodash|lodash-es|lodash.debounce|lodash.merge|underscore)/.test(id)) return 'vendor';
              // All other node_modules in vendor
              return 'vendor';
            }
          },
        },
    },
  },
})
