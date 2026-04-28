import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { writeFileSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-redirects',
      closeBundle() {
        writeFileSync('dist/_redirects', '/* /index.html 200\n');
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
