import { Router } from 'express'
import {
  CUSTOMER_TYPES,
  FUNDING_STATUSES,
  PIPELINE_STAGES,
  PROCESS_STAGES,
  PRODUCTS,
  SITE_STATUSES,
  LOST_REASONS,
  filterOpps,
  qualityReport,
  weightedValue,
} from '../catalog.js'
import {
  addRemark,
  changeStage,
  createOpportunity,
  getOpportunityByCode,
  listOpportunities,
  persistClientOpp,
} from '../services/opportunities.js'
import { seedOpportunities } from '../db/seed.js'
import { fail, okItem, okMessage } from '../utils/response.js'
import { requireAdmin } from '../middleware/auth.js'
import { logAction } from '../services/actionLog.js'
import { get } from '../db/index.js'

const router = Router()

router.get('/meta', async (_req, res) => {
  const settings = await get<{ site_name: string; default_currency: string }>('SELECT site_name, default_currency FROM settings WHERE id = 1')
  res.json({
    siteName: settings?.site_name || '3i Sales Funnel',
    currency: settings?.default_currency || 'INR',
    products: PRODUCTS,
    customerTypes: CUSTOMER_TYPES,
    siteStatuses: SITE_STATUSES,
    fundingStatuses: FUNDING_STATUSES,
    processStages: PROCESS_STAGES,
    pipelineStages: PIPELINE_STAGES,
    lostReasons: LOST_REASONS,
    owners: ['Prem Kumar Thakur', 'West Sales Team'],
    regions: [
      { key: 'all', label: 'All Regions' },
      { key: 'north', label: 'Prem Territory' },
      { key: 'west', label: 'West' },
    ],
  })
})

router.get('/opportunities', async (req, res) => {
  const rows = filterOpps(await listOpportunities(), req.query as Record<string, unknown>)
  res.json(rows)
})

router.get('/opportunities/:id', async (req, res) => {
  const item = await getOpportunityByCode(req.params.id)
  if (!item) return fail(res, 'Not found', 404)
  res.json(item)
})

router.post('/opportunities', async (req, res) => {
  const created = await createOpportunity(req.body || {}, req.user?.id)
  await logAction({ userId: req.user?.id, actionType: 'opportunity_create', itemType: 'opportunity', itemId: created?.id })
  return okItem(res, created, 201)
})

router.patch('/opportunities/:id', async (req, res) => {
  const item = await getOpportunityByCode(req.params.id)
  if (!item) return fail(res, 'Not found', 404)
  const next = { ...item, ...req.body, lastUpdated: new Date().toISOString().slice(0, 10) }
  const saved = await persistClientOpp(next)
  res.json(saved)
})

router.post('/opportunities/:id/stage', async (req, res) => {
  const updated = await changeStage(req.params.id, String(req.body?.processStage || ''))
  if (!updated) return fail(res, 'Not found', 404)
  await logAction({ userId: req.user?.id, actionType: 'stage_change', itemType: 'opportunity', itemId: req.params.id, note: String(req.body?.processStage || '') })
  res.json(updated)
})

router.post('/opportunities/:id/remarks', async (req, res) => {
  const text = String(req.body?.text || '').trim()
  if (!text) return fail(res, 'Remark required')
  const updated = await addRemark(req.params.id, text, req.user?.id)
  if (!updated) return fail(res, 'Not found', 404)
  res.json(updated)
})

router.get('/dashboard', async (req, res) => {
  const opps = filterOpps(await listOpportunities(), req.query as Record<string, unknown>)
  const open = opps.filter((o) => o.outcome === 'open')
  const booked = opps.filter((o) => o.outcome === 'booked')
  const lost = opps.filter((o) => o.outcome === 'lost' || o.outcome === 'cancelled')
  const high = open.filter((o) => Number(o.probability) >= 70)
  res.json({
    kpis: {
      pipeline: open.reduce((s, o) => s + (Number(o.value) || 0), 0),
      opportunities: opps.length,
      open: open.length,
      expected: open.reduce((s, o) => s + weightedValue(o), 0),
      highCount: high.length,
      highValue: high.reduce((s, o) => s + (Number(o.value) || 0), 0),
      booked: booked.reduce((s, o) => s + (Number(o.value) || 0), 0),
      bookedCount: booked.length,
      lost: lost.reduce((s, o) => s + (Number(o.value) || 0), 0),
      lostCount: lost.length,
    },
    stages: PIPELINE_STAGES.map((s) => {
      const rows = open.filter((o) => o.stage === s.id)
      return { ...s, count: rows.length, value: rows.reduce((a, o) => a + (Number(o.value) || 0), 0) }
    }),
    products: Object.entries(
      open.reduce((m: Record<string, { count: number; value: number }>, o) => {
        const p = o.product && o.product !== '—' ? String(o.product) : 'Unspecified'
        if (!m[p]) m[p] = { count: 0, value: 0 }
        m[p].count += 1
        m[p].value += Number(o.value) || 0
        return m
      }, {}),
    ).map(([name, v]) => ({ name, ...v })),
    regions: ['north', 'west'].map((key) => {
      const rows = open.filter((o) => o.regionKey === key)
      const allRows = opps.filter((o) => o.regionKey === key)
      return {
        key,
        name: key === 'north' ? 'North / Prem Territory' : 'West',
        count: rows.length,
        value: rows.reduce((s, o) => s + (Number(o.value) || 0), 0),
        forecast: rows.reduce((s, o) => s + weightedValue(o), 0),
        booked: allRows.filter((o) => o.outcome === 'booked').reduce((s, o) => s + (Number(o.value) || 0), 0),
      }
    }),
  })
})

router.get('/funnel', async (req, res) => {
  const opps = filterOpps(await listOpportunities(), req.query as Record<string, unknown>)
  const stages = PROCESS_STAGES.map((s) => {
    const rows = opps.filter((o) => o.outcome === 'open' && o.processStage === s.id)
    return { ...s, count: rows.length, value: rows.reduce((a, o) => a + (Number(o.value) || 0), 0), ids: rows.map((r) => r.id) }
  })
  const booked = opps.filter((o) => o.outcome === 'booked')
  const lost = opps.filter((o) => o.outcome === 'lost')
  const cancelled = opps.filter((o) => o.outcome === 'cancelled')
  res.json({
    stages,
    booked: { count: booked.length, value: booked.reduce((s, o) => s + (Number(o.value) || 0), 0) },
    lost: { count: lost.length, value: lost.reduce((s, o) => s + (Number(o.value) || 0), 0) },
    cancelled: { count: cancelled.length, value: cancelled.reduce((s, o) => s + (Number(o.value) || 0), 0) },
  })
})

router.get('/forecast', async (req, res) => {
  const opps = filterOpps(await listOpportunities(), req.query as Record<string, unknown>)
  const open = opps.filter((o) => o.outcome === 'open')
  const booked = opps.filter((o) => o.outcome === 'booked')
  const lost = opps.filter((o) => o.outcome === 'lost' || o.outcome === 'cancelled')
  res.json({
    pipeline: open.reduce((s, o) => s + (Number(o.value) || 0), 0),
    weighted: open.reduce((s, o) => s + weightedValue(o), 0),
    booked: booked.reduce((s, o) => s + (Number(o.value) || 0), 0),
    lost: lost.reduce((s, o) => s + (Number(o.value) || 0), 0),
    byProduct: Object.entries(
      open.reduce((m: Record<string, number>, o) => {
        const name = String(o.product || 'Unspecified')
        m[name] = (m[name] || 0) + weightedValue(o)
        return m
      }, {}),
    ).map(([name, value]) => ({ name, value })),
    byStage: PIPELINE_STAGES.map((s) => ({
      label: s.label,
      value: open.filter((o) => o.stage === s.id).reduce((a, o) => a + (Number(o.value) || 0), 0),
    })),
  })
})

router.get('/lost', async (req, res) => {
  const lost = filterOpps(await listOpportunities(), req.query as Record<string, unknown>)
    .filter((o) => o.outcome === 'lost' || o.outcome === 'cancelled')
  res.json(lost)
})

router.get('/quality', async (_req, res) => {
  res.json(qualityReport(await listOpportunities()))
})

router.post('/reset', requireAdmin, async (req, res) => {
  await seedOpportunities(true)
  await logAction({ userId: req.user?.id, actionType: 'data_reset', itemType: 'opportunities' })
  return okMessage(res, 'Data restored from Excel seed', qualityReport(await listOpportunities()))
})

export default router
