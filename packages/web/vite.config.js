import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  base: '/', // Change this if not serving from root
  build: {
    outDir: 'dist',
    // Generate sourcemaps for production
    sourcemap: true,
  },
  server: {
    https: false,
    port: 5173,
    strictPort: true,
    fs: {
      allow: ['..', '/Users/bjornpjo/Developer/vendor/strudel/strudel/packages/core']
    }
  }
})
