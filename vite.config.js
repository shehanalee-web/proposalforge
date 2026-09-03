import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localUploadsPlugin } from './server/localUploadsPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localUploadsPlugin()],
})
