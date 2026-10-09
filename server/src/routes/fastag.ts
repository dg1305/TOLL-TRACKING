import { Router } from 'express'
import multer from 'multer'
import { fail, okItem, okList } from '../utils/response.js'
import { listActivity, logAction } from '../services/actionLog.js'
import {
  createBatch,
  extractPlates,
  getBatch,
  exportBatchExcel,
  getBatchDetail,
  isBatchRunning,
  listBatches,
  normalizePlate,
  queueBatch,
  queueRetryFailed,
  runBatch,
} from '../services/fastag.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

function actorOf(req: { user?: { id: number, email: string | null } }) {
  return { id: req.user!.id, email: req.user!.email ?? null }
}

router.get('/activity', async (_req, res) => {
  const rows = await listActivity(200)
  return okList(res, rows)
})

router.get('/batches', async (_req, res) => {
  const rows = await listBatches()
  return okList(res, rows)
})

router.get('/batches/:id/export', async (req, res) => {
  const file = await exportBatchExcel(Number(req.params.id))
  if (!file) return fail(res, 'Sheet not found', 404)
  await logAction({
    userId: req.user?.id,
    email: req.user?.email,
    actionType: 'export',
    itemType: 'fastag_batch',
    itemId: req.params.id,
    note: `Exported ${file.filename}`,
  })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
  return res.send(file.buffer)
})

router.get('/batches/:id', async (req, res) => {
  const detail = await getBatchDetail(Number(req.params.id))
  if (!detail) return fail(res, 'Sheet not found', 404)
  return okItem(res, detail)
})

router.post('/batches', upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) return fail(res, 'Choose an Excel or CSV file')
  const name = file.originalname || 'vehicles.xlsx'
  if (!/\.(xlsx|xls|csv)$/i.test(name)) {
    return fail(res, 'Upload an .xlsx, .xls, or .csv file')
  }
  try {
    const plates = extractPlates(file.buffer)
    const detail = await createBatch({
      filename: name,
      source: 'excel',
      uploadedBy: req.user?.id ?? null,
      plates,
    })
    await logAction({
      userId: req.user?.id,
      email: req.user?.email,
      actionType: 'upload',
      itemType: 'fastag_batch',
      itemId: detail.batch.id,
      note: `Uploaded ${name} with ${detail.batch.vehicle_count} vehicles`,
    })
    return okItem(res, detail, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read the sheet'
    return fail(res, message)
  }
})

router.post('/batches/:id/fetch', async (req, res) => {
  const id = Number(req.params.id)
  const batch = await getBatch(id)
  if (!batch) return fail(res, 'Sheet not found', 404)
  if (batch.status === 'running' && isBatchRunning(id)) {
    return fail(res, 'This sheet is already being fetched', 409)
  }
  if (!String(process.env.FASTAG_ACCESS_TOKEN || '').trim()) {
    return fail(res, 'FASTAG_ACCESS_TOKEN is not set on the server', 500)
  }
  const started = await queueBatch(id, actorOf(req))
  if (!started) return fail(res, 'This sheet is already being fetched', 409)
  const fresh = await getBatch(id)
  return okItem(res, { started: true, batch: fresh }, 202)
})

router.post('/batches/:id/retry-failed', async (req, res) => {
  const id = Number(req.params.id)
  const batch = await getBatch(id)
  if (!batch) return fail(res, 'Sheet not found', 404)
  if (batch.status === 'running' && isBatchRunning(id)) {
    return fail(res, 'This sheet is already being fetched', 409)
  }
  if (!String(process.env.FASTAG_ACCESS_TOKEN || '').trim()) {
    return fail(res, 'FASTAG_ACCESS_TOKEN is not set on the server', 500)
  }
  const count = await queueRetryFailed(id, actorOf(req))
  if (!count) return fail(res, 'No failed vehicles to re-run')
  const fresh = await getBatch(id)
  return okItem(res, { started: true, count, batch: fresh }, 202)
})

router.post('/lookup', async (req, res) => {
  const plate = normalizePlate(req.body?.vehicleRegNo ?? req.body?.vehicle ?? '')
  if (!plate) return fail(res, 'Enter a vehicle number like CG13BF6032')
  if (!String(process.env.FASTAG_ACCESS_TOKEN || '').trim()) {
    return fail(res, 'FASTAG_ACCESS_TOKEN is not set on the server', 500)
  }
  try {
    const detail = await createBatch({
      filename: plate,
      source: 'manual',
      uploadedBy: req.user?.id ?? null,
      plates: [plate],
    })
    await runBatch(detail.batch.id, actorOf(req))
    await logAction({
      userId: req.user?.id,
      email: req.user?.email,
      actionType: 'lookup',
      itemType: 'vehicle',
      itemId: plate,
      note: `Single lookup for ${plate}`,
    })
    const done = await getBatchDetail(detail.batch.id)
    return okItem(res, done)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed'
    return fail(res, message, 500)
  }
})

export default router
