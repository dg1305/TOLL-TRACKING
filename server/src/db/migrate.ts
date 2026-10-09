import dotenv from 'dotenv'
import { runPendingSchemaMigrations } from '../services/schemaMigrate.js'

dotenv.config()

async function migrate() {
  console.log('Running pending schema migrations…')
  const result = await runPendingSchemaMigrations()
  for (const v of result.skipped) console.log(`Skipping ${v} (already applied)`)
  for (const v of result.applied) console.log(`Applied ${v}`)
  console.log(`\nDatabase ready — ${result.table_count} tables`)
  console.log('Migration complete.')
}

migrate().catch((err) => {
  console.error('\nMigration failed:', err.message)
  if (err.code) console.error('Code:', err.code)
  process.exit(1)
})
