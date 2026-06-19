import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import { featureRequestDevPlugin } from './server/featureRequestHandler.js'

dotenv.config()

export default defineConfig({
  plugins: [react(), featureRequestDevPlugin()],
})
