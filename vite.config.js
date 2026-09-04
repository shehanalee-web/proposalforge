import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localUploadsPlugin } from './server/localUploadsPlugin.js'
import { emailPlugin } from './server/emailPlugin.js'
import { aiPlugin } from './server/aiPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localUploadsPlugin(), emailPlugin(), aiPlugin()],
})
