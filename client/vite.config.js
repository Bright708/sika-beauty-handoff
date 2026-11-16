import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // reachable from a phone on the same Wi-Fi
    port: 5173,
    // With VITE_API_URL=/ the browser calls /api on this dev server, which forwards to Express.
    // This also works from a phone, which cannot reach "localhost:4000" on your computer.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
