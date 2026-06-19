import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { mountFeatureRequestRoute } from './featureRequestHandler.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true }))
mountFeatureRequestRoute(app)

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
