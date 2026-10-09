import dotenv from 'dotenv'
import { createApp } from './app.js'
import { seed } from './db/seed.js'
import { runPendingSchemaMigrations } from './services/schemaMigrate.js'
import { ensureUsers } from './services/accounts.js'

dotenv.config()

const port = Number(process.env.PORT) || 4090
const host = process.env.HOST || '0.0.0.0'
const serveClient = process.env.SERVE_CLIENT === 'true'
const publicApp = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '')

try {
  const result = await runPendingSchemaMigrations()
  console.log(`Schema ready — ${result.table_count} tables`)
  await seed()
} catch (e) {
  console.warn('Database is not required for FASTag. Continuing with JSON files.')
  console.warn(e instanceof Error ? e.message : e)
}

await ensureUsers()
console.log('Accounts: server/data/users.json')
console.log('Toll data: server/data/fastag.json')
console.log('Activity: server/data/activity.json')

const app = createApp()

app.listen(port, host, () => {
  console.log(`3i Sales Funnel API listening on http://${host}:${port}`)
  console.log(`Local:  http://localhost:${port}`)
  if (serveClient) {
    console.log(`Mode:   SERVE_CLIENT=true (API + client/out on one port)`)
    if (publicApp) console.log(`Public: ${publicApp}`)
  } else {
    console.log(`Dev:    Vite on :5173 + API on :${port}`)
  }
  console.log(`Health: http://localhost:${port}/api/v1/status`)
  console.log(`Login:  POST http://localhost:${port}/api/v1/login`)
})
