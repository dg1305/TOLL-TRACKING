import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { all, get, now, run, withTransaction } from './index.js'
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_FILE = path.resolve(__dirname, '../../data/opportunities.seed.json')

async function connRun(conn: PoolConnection, sql: string, params: any[] = []) {
  const [result] = await conn.execute<ResultSetHeader>(sql, params)
  return result
}

type SeedUser = {
  first_name: string
  last_name: string
  username: string
  email: string
  password: string
  jobtitle: string
  region_key: string | null
  employee_num: string
  permissions: Record<string, string>
}

const LOGIN_USERS: SeedUser[] = [
  {
    first_name: 'Raghul',
    last_name: 'JE',
    username: 'raghul.je',
    email: 'raghul.je@refex.co.in',
    password: 'RefexAdmin@',
    jobtitle: 'Administrator',
    region_key: null,
    employee_num: 'E0001',
    permissions: { superuser: '1', admin: '1' },
  },
  {
    first_name: 'Prem Kumar',
    last_name: 'Thakur',
    username: 'prem.thakur',
    email: 'prem.thakur@3imedical.com',
    password: 'Sales@3i',
    jobtitle: 'Sales Manager · North',
    region_key: 'north',
    employee_num: 'E0002',
    permissions: { sales: '1', 'opportunities.view': '1', 'opportunities.edit': '1' },
  },
  {
    first_name: 'West',
    last_name: 'Sales',
    username: 'west.sales',
    email: 'west.sales@3imedical.com',
    password: 'Sales@3i',
    jobtitle: 'West Sales Team',
    region_key: 'west',
    employee_num: 'E0003',
    permissions: { sales: '1', 'opportunities.view': '1', 'opportunities.edit': '1' },
  },
]

export async function ensureLoginUsers() {
  const ts = now()
  for (const u of LOGIN_USERS) {
    const hash = bcrypt.hashSync(u.password, 10)
    const perms = JSON.stringify(u.permissions)
    const existing = await get<{ id: number }>(
      'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1',
      [u.email, u.username],
    )
    if (existing?.id) {
      await run(
        `UPDATE users SET password = ?, permissions = ?, activated = 1, first_name = ?, last_name = ?,
         email = ?, username = ?, jobtitle = ?, region_key = ?, employee_num = ?, updated_at = ?
         WHERE id = ?`,
        [hash, perms, u.first_name, u.last_name, u.email, u.username, u.jobtitle, u.region_key, u.employee_num, ts, existing.id],
      )
      console.log(`Updated login user: ${u.email}`)
    } else {
      await run(
        `INSERT INTO users (first_name, last_name, username, email, password, employee_num, jobtitle, region_key, activated, permissions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [u.first_name, u.last_name, u.username, u.email, hash, u.employee_num, u.jobtitle, u.region_key, perms, ts, ts],
      )
      console.log(`Created login user: ${u.email}`)
    }
  }
}

type SeedOpp = {
  id: string
  customer: string
  location?: string
  region?: string
  regionKey?: string
  customerType?: string
  modality?: string
  product?: string
  value?: number
  siteStatus?: string
  fundingStatus?: string
  expectedClosure?: string
  expectedClosureLabel?: string
  salesStatus?: string
  stage?: string
  probability?: number
  processStage?: string
  owner?: string
  remarks?: string[]
  activities?: { date?: string; title?: string; note?: string }[]
  createdAt?: string
  lastUpdated?: string
  outcome?: string
  lostReason?: string
  competitor?: string
  dateLost?: string
  dataIssues?: string[]
}

export async function seedOpportunities(force = false) {
  const existing = await get<{ c: number }>('SELECT COUNT(*) as c FROM opportunities')
  if (!force && Number(existing?.c || 0) > 0) {
    console.log(`Opportunities already seeded (${existing?.c})`)
    return
  }

  if (!fs.existsSync(SEED_FILE)) {
    console.warn('Seed file missing:', SEED_FILE)
    return
  }

  const rows = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as SeedOpp[]
  const ts = now()

  await withTransaction(async (conn) => {
    if (force) {
      await connRun(conn, 'DELETE FROM opportunity_activities')
      await connRun(conn, 'DELETE FROM opportunity_remarks')
      await connRun(conn, 'DELETE FROM opportunities')
    }

    for (const o of rows) {
      const result = await connRun(conn, `
        INSERT INTO opportunities (
          code, customer, location, region, region_key, customer_type, modality, product, value,
          site_status, funding_status, expected_closure, expected_closure_label, sales_status, stage,
          probability, process_stage, owner, outcome, lost_reason, competitor, date_lost, data_issues,
          created_at, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        o.id,
        o.customer || '',
        o.location || '',
        o.region || '',
        o.regionKey || 'north',
        o.customerType || '',
        o.modality || '',
        o.product || '',
        Number(o.value) || 0,
        o.siteStatus || '',
        o.fundingStatus || '',
        o.expectedClosure || null,
        o.expectedClosureLabel || '',
        o.salesStatus || '',
        o.stage || 'I',
        Number(o.probability) || 15,
        o.processStage || 'new-enquiry',
        o.owner || '',
        o.outcome || 'open',
        o.lostReason || '',
        o.competitor || '',
        o.dateLost || null,
        JSON.stringify(o.dataIssues || []),
        o.createdAt || null,
        o.lastUpdated || null,
      ])
      const oppId = Number(result.insertId)
      for (const body of o.remarks || []) {
        await connRun(conn, `INSERT INTO opportunity_remarks (opportunity_id, body, created_at) VALUES (?, ?, ?)`, [oppId, body, ts])
      }
      for (const a of o.activities || []) {
        await connRun(conn, `INSERT INTO opportunity_activities (opportunity_id, activity_date, title, note, created_at) VALUES (?, ?, ?, ?, ?)`, [
          oppId, a.date || null, a.title || '', a.note || '', ts,
        ])
      }
    }
  })

  console.log(`Seeded ${rows.length} opportunities from Excel extract`)
}

export async function seed() {
  const existing = await get<{ c: number }>('SELECT COUNT(*) as c FROM users')
  if (Number(existing?.c || 0) === 0) {
    const ts = now()
    await run(
      `INSERT INTO settings (id, site_name, default_currency, timezone, created_at, updated_at)
       VALUES (1, '3i Sales Funnel', 'INR', 'Asia/Kolkata', ?, ?)`,
      [ts, ts],
    )
    console.log('Seeded 3i Sales Funnel settings')
  } else {
    console.log('Database already has users')
    await run(`UPDATE settings SET site_name = '3i Sales Funnel', default_currency = 'INR' WHERE id = 1`).catch(() => undefined)
  }

  await ensureLoginUsers()
  await seedOpportunities(false)
  console.log('Login: raghul.je@refex.co.in / RefexAdmin@')
  console.log('Login: prem.thakur@3imedical.com / Sales@3i')
  console.log('Login: west.sales@3imedical.com / Sales@3i')
}

const isDirect = process.argv[1]?.includes('seed')
if (isDirect) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
