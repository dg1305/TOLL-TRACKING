import { all, get, now, run } from '../db/index.js'
import {
  applyStageChange,
  padId,
  PRODUCT_MODALITY,
  PROCESS_STAGES,
  todayISO,
  type ClientOpp,
} from '../catalog.js'

export type OppRow = {
  id: number
  code: string
  customer: string
  location: string | null
  region: string | null
  region_key: string
  customer_type: string | null
  modality: string | null
  product: string | null
  value: number | string
  site_status: string | null
  funding_status: string | null
  expected_closure: string | null
  expected_closure_label: string | null
  sales_status: string | null
  stage: string | null
  probability: number
  process_stage: string
  owner: string | null
  outcome: string
  lost_reason: string | null
  competitor: string | null
  date_lost: string | null
  data_issues: unknown
  created_at: string | null
  last_updated: string | null
}

function parseJsonArray(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw)
      return Array.isArray(v) ? v.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

export function toClient(row: OppRow, remarks: string[] = [], activities: ClientOpp['activities'] = []): ClientOpp {
  return {
    id: row.code,
    dbId: row.id,
    customer: row.customer,
    location: row.location || '',
    region: row.region || '',
    regionKey: row.region_key,
    customerType: row.customer_type || '',
    modality: row.modality || '',
    product: row.product || '',
    value: Number(row.value) || 0,
    siteStatus: row.site_status || '',
    fundingStatus: row.funding_status || '',
    expectedClosure: row.expected_closure || '',
    expectedClosureLabel: row.expected_closure_label || '',
    salesStatus: row.sales_status || '',
    stage: row.stage || 'I',
    probability: Number(row.probability) || 0,
    processStage: row.process_stage,
    owner: row.owner || '',
    remarks,
    activities,
    createdAt: row.created_at || '',
    lastUpdated: row.last_updated || '',
    outcome: row.outcome,
    lostReason: row.lost_reason || '',
    competitor: row.competitor || '',
    dateLost: row.date_lost || '',
    dataIssues: parseJsonArray(row.data_issues),
  }
}

export async function listOpportunities(): Promise<ClientOpp[]> {
  const rows = await all<OppRow>(`SELECT * FROM opportunities ORDER BY id DESC`)
  return rows.map((r) => toClient(r))
}

export async function getOpportunityByCode(code: string): Promise<ClientOpp | undefined> {
  const row = await get<OppRow>(`SELECT * FROM opportunities WHERE code = ?`, [code])
  if (!row) return undefined
  const remarks = await all<{ body: string }>(
    `SELECT body FROM opportunity_remarks WHERE opportunity_id = ? ORDER BY id`,
    [row.id],
  )
  const activities = await all<{ activity_date: string; title: string; note: string }>(
    `SELECT activity_date, title, note FROM opportunity_activities WHERE opportunity_id = ? ORDER BY id`,
    [row.id],
  )
  return toClient(
    row,
    remarks.map((r) => r.body),
    activities.map((a) => ({ date: a.activity_date, title: a.title, note: a.note })),
  )
}

export async function nextCode() {
  const row = await get<{ m: string | null }>(`SELECT MAX(code) as m FROM opportunities`)
  const max = parseInt(String(row?.m || '').split('-').pop() || '0', 10)
  return padId(Number.isFinite(max) ? max + 1 : 1)
}

export async function createOpportunity(body: Record<string, unknown>, userId?: number) {
  const regionKey = body.regionKey === 'west' ? 'west' : 'north'
  const processStage = String(body.processStage || 'new-enquiry')
  const meta = PROCESS_STAGES.find((s) => s.id === processStage) || PROCESS_STAGES[0]
  const code = await nextCode()
  const product = String(body.product || 'ANAMAYA')
  const ts = todayISO()
  const remark = String(body.remark || '').trim()
  const info = await run(`
    INSERT INTO opportunities (
      code, customer, location, region, region_key, customer_type, modality, product, value,
      site_status, funding_status, expected_closure, expected_closure_label, sales_status, stage,
      probability, process_stage, owner, outcome, data_issues, created_at, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', '[]', ?, ?)
  `, [
    code,
    String(body.customer || ''),
    String(body.location || ''),
    regionKey === 'west' ? 'West' : 'Prem Territory',
    regionKey,
    String(body.customerType || 'Diagnostic Centre'),
    PRODUCT_MODALITY[product] || 'MRI',
    product,
    Number(body.value) || 0,
    String(body.siteStatus || 'To Be Identified'),
    String(body.fundingStatus || 'Not Yet Approached Bank'),
    body.expectedClosure || null,
    String(body.expectedClosure || 'Not scheduled'),
    meta.label === 'Proposal / Quotation' ? 'Quotation Submitted' : meta.label,
    meta.stage,
    meta.probability,
    processStage,
    String(body.owner || (regionKey === 'west' ? 'West Sales Team' : 'Prem Kumar Thakur')),
    ts,
    ts,
  ])
  const oppId = info.insertId
  await run(
    `INSERT INTO opportunity_activities (opportunity_id, activity_date, title, note, created_at) VALUES (?, ?, ?, ?, ?)`,
    [oppId, ts, 'Opportunity created', 'Created in 3i Sales Pipeline.', now()],
  )
  if (remark) {
    await run(`INSERT INTO opportunity_remarks (opportunity_id, body, created_by, created_at) VALUES (?, ?, ?, ?)`, [
      oppId, remark, userId ?? null, now(),
    ])
  }
  return getOpportunityByCode(code)
}

export async function persistClientOpp(opp: ClientOpp, extraActivity?: { title: string; note: string }) {
  const row = await get<OppRow>(`SELECT * FROM opportunities WHERE code = ?`, [opp.id])
  if (!row) return undefined
  await run(`
    UPDATE opportunities SET
      customer = ?, location = ?, region = ?, region_key = ?, customer_type = ?, modality = ?, product = ?,
      value = ?, site_status = ?, funding_status = ?, expected_closure = ?, expected_closure_label = ?,
      sales_status = ?, stage = ?, probability = ?, process_stage = ?, owner = ?, outcome = ?,
      lost_reason = ?, competitor = ?, date_lost = ?, last_updated = ?
    WHERE id = ?
  `, [
    opp.customer,
    opp.location || '',
    opp.region || '',
    opp.regionKey || 'north',
    opp.customerType || '',
    opp.modality || '',
    opp.product || '',
    Number(opp.value) || 0,
    opp.siteStatus || '',
    opp.fundingStatus || '',
    opp.expectedClosure || null,
    opp.expectedClosureLabel || '',
    opp.salesStatus || '',
    opp.stage || 'I',
    Number(opp.probability) || 0,
    opp.processStage || 'new-enquiry',
    opp.owner || '',
    opp.outcome || 'open',
    opp.lostReason || '',
    opp.competitor || '',
    opp.dateLost || null,
    opp.lastUpdated || todayISO(),
    row.id,
  ])
  if (extraActivity) {
    await run(
      `INSERT INTO opportunity_activities (opportunity_id, activity_date, title, note, created_at) VALUES (?, ?, ?, ?, ?)`,
      [row.id, todayISO(), extraActivity.title, extraActivity.note, now()],
    )
  }
  return getOpportunityByCode(opp.id)
}

export async function addRemark(code: string, text: string, userId?: number) {
  const row = await get<OppRow>(`SELECT * FROM opportunities WHERE code = ?`, [code])
  if (!row) return undefined
  await run(`INSERT INTO opportunity_remarks (opportunity_id, body, created_by, created_at) VALUES (?, ?, ?, ?)`, [
    row.id, text, userId ?? null, now(),
  ])
  await run(
    `INSERT INTO opportunity_activities (opportunity_id, activity_date, title, note, created_at) VALUES (?, ?, ?, ?, ?)`,
    [row.id, todayISO(), 'Field update', text, now()],
  )
  await run(`UPDATE opportunities SET last_updated = ? WHERE id = ?`, [todayISO(), row.id])
  return getOpportunityByCode(code)
}

export async function changeStage(code: string, processStage: string) {
  const opp = await getOpportunityByCode(code)
  if (!opp) return undefined
  applyStageChange(opp, processStage)
  return persistClientOpp(opp, { title: 'Stage updated', note: 'Moved to ' + processStage })
}

export { applyStageChange }
