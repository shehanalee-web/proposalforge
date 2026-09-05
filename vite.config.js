import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localUploadsPlugin } from './server/localUploadsPlugin.js'
import { emailPlugin } from './server/emailPlugin.js'
import { aiPlugin } from './server/aiPlugin.js'
import { knowledgePlugin } from './server/knowledgePlugin.js'
import { workflowPlugin } from './server/workflowPlugin.js'
import { portalPlugin } from './server/portalPlugin.js'
import { interactionsPlugin } from './server/interactionsPlugin.js'
import { followupPlugin } from './server/followupPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    localUploadsPlugin(),
    emailPlugin(),
    aiPlugin(),
    knowledgePlugin(),
    workflowPlugin(),
    portalPlugin(),
    interactionsPlugin(),
    followupPlugin(),
  ],
})
