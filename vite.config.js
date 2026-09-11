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
import { livingPlugin } from './server/livingPlugin.js'
import { forgePlugin } from './server/forgePlugin.js'
import { commercialClosePlugin } from './server/commercialClosePlugin.js'
import { integrationsIntakePlugin } from './server/integrationsIntakePlugin.js'
import { integrationsRulesPlugin } from './server/integrationsRulesPlugin.js'
import { integrationsIntentsPlugin } from './server/integrationsIntentsPlugin.js'
import { integrationsWebhooksPlugin } from './server/integrationsWebhooksPlugin.js'
import { integrationsCrmPlugin } from './server/integrationsCrmPlugin.js'
import { integrationsActivitiesPlugin } from './server/integrationsActivitiesPlugin.js'
import { integrationsActivityAuthoringPlugin } from './server/integrationsActivityAuthoringPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    integrationsIntakePlugin(),
    integrationsRulesPlugin(),
    integrationsIntentsPlugin(),
    integrationsWebhooksPlugin(),
    integrationsCrmPlugin(),
    integrationsActivitiesPlugin(),
    integrationsActivityAuthoringPlugin(),
    localUploadsPlugin(),
    emailPlugin(),
    aiPlugin(),
    knowledgePlugin(),
    workflowPlugin(),
    portalPlugin(),
    interactionsPlugin(),
    followupPlugin(),
    livingPlugin(),
    forgePlugin(),
    commercialClosePlugin(),
  ],
})
