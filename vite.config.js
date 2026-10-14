import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Render serves the site on its own domain, so preview must accept any host
  preview: { allowedHosts: true },
})
