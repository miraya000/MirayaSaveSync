import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Menggunakan path relatif untuk asset
  server: {
    port: 5175
  }
})
