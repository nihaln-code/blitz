import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'localhost',
      'blitz.nimmagadda.com',
      'blitzfantasy.duckdns.org'
    ]
  }
})
