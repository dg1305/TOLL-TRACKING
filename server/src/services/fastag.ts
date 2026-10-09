import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { logAction } from './actionLog.js'
import { clock } from '../utils/clock.js'

const PLATE = /^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/
const INLINE = /[A-Z]{2}\s*-?\s*\d{1,2}\s*-?\s*[A-Z]{1,3}\s*-?\s*\d{1,4}|\d{2}\s*-?\s*BH\s*-?\s*\d{4}\s*-?\s*[A-Z]{1,2}/gi
const HEADER_HINT = /vehicle|reg(?:istration)?|number\s*plate|reg\.?\s*no|vrn|fastag|fleet|truck/i
const MAX_VEHICLES = 5000
const READ_LIMIT = 50000

const running = new Set<number>()

export type FastagBatch = {
  id: number
  filename: string
  source: string
  uploaded_by: number | null
  vehicle_count: number
  ok_count: number
  error_count: number
  read_count: number
  status: string
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export type FastagVehicle = {
  id: number
  batch_id: number
  vehicle_reg_no: string
  status: string
  http_status: number | null
  error_message: string | null
  read_count: number
  fetched_at: string | null
}

export type FastagRead = {
  id: number
  batch_id: number
  vehicle_id: number
  vehicle_reg_no: string
  reader_read_time: string | null
  seq_no: string | null
  lane_direction: string | null
  toll_plaza_geocode: string | null
  toll_plaza_name: string | null
  vehicle_type: string | null
  created_at: string
  fetched_at: string | null
  run_id: number | null
}

export function normalizePlate(raw: unknown): string | null {
  const compact = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!PLATE.test(compact)) return null
  return compact
}

function platesInText(value: unknown): string[] {
  const text = String(value ?? '').toUpperCase()
  if (!text.trim()) return []
  const direct = normalizePlate(text)
  if (direct) return [direct]
  const found: string[] = []
  const matches = text.match(INLINE) || []
  for (const match of matches) {
    const plate = normalizePlate(match)
    if (plate) found.push(plate)
  }
  return found
}

export function extractPlates(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })
  if (!rows.length) return []

  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const header = rows[0].map((cell) => String(cell ?? ''))
  const hinted = header
    .map((cell, index) => (HEADER_HINT.test(cell) ? index : -1))
    .filter((index) => index >= 0)

  const fromColumn = (indexes: number[]) => {
    const plates: string[] = []
    const seen = new Set<string>()
    rows.forEach((row, rowIndex) => {
      if (rowIndex === 0 && indexes.some((index) => HEADER_HINT.test(String(row[index] ?? '')))) return
      for (const index of indexes) {
        for (const plate of platesInText(row[index])) {
          if (seen.has(plate)) continue
          seen.add(plate)
          plates.push(plate)
        }
      }
    })
    return plates
  }

  if (hinted.length) {
    const picked = fromColumn(hinted)
    if (picked.length) return picked.slice(0, MAX_VEHICLES)
  }

  const scores = Array.from({ length: width }, (_, index) => fromColumn([index]).length)
  const best = scores.reduce((top, score, index) => (score > scores[top] ? index : top), 0)
  if (scores[best] > 0) return fromColumn([best]).slice(0, MAX_VEHICLES)

  const seen = new Set<string>()
  const plates: string[] = []
  for (const row of rows) {
    for (const cell of row) {
      for (const plate of platesInText(cell)) {
        if (seen.has(plate)) continue
        seen.add(plate)
        plates.push(plate)
        if (plates.length >= MAX_VEHICLES) return plates
      }
    }
  }
  return plates
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function looksLikeRead(row: Record<string, unknown>) {
  return ['vehicleRegNo', 'vehicle_reg_no', 'seqNo', 'seq_no', 'tollPlazaName', 'toll_plaza_name', 'readerReadTime', 'reader_read_time']
    .some((key) => row[key] != null && String(row[key]).trim() !== '')
}

function pick(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value == null || value === '') continue
    if (Array.isArray(value)) {
      const text = value.map((item) => String(item)).filter(Boolean).join(', ')
      if (text) return text.slice(0, 500)
      continue
    }
    return String(value).slice(0, 500)
  }
  return null
}

export function collectRecords(body: unknown): Record<string, unknown>[] {
  if (body == null) return []
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (!trimmed) return []
    try { return collectRecords(JSON.parse(trimmed)) } catch { return [] }
  }
  if (Array.isArray(body)) return body.filter(isRecord)
  if (!isRecord(body)) return []

  for (const key of ['transactions', 'data', 'records', 'rows', 'result', 'payload', 'items', 'list', 'response']) {
    const value = body[key]
    if (Array.isArray(value)) return value.filter(isRecord)
    if (isRecord(value) && looksLikeRead(value)) return [value]
    if (isRecord(value)) {
      const nested = collectRecords(value)
      if (nested.length) return nested
    }
  }
  if (looksLikeRead(body)) return [body]
  return []
}

function apiErrorMessage(body: unknown) {
  if (!isRecord(body)) return null
  const status = String(body.status ?? body.success ?? '').toLowerCase()
  const failed = status === 'error' || status === 'failed' || status === 'false' || body.success === false
  if (!failed) return null
  return pick(body, 'message', 'messages', 'error', 'msg', 'errorMessage') || 'Lookup failed'
}

function clip(value: string | null, max: number) {
  if (!value) return null
  return value.length > max ? value.slice(0, max) : value
}

type StoredRead = FastagRead & { raw_json: unknown }

type FastagRun = {
  id: number
  batch_id: number
  kind: 'fetch' | 'retry'
  started_at: string
  finished_at: string | null
  actor_email: string | null
}

type Store = {
  batches: FastagBatch[]
  vehicles: FastagVehicle[]
  reads: StoredRead[]
  runs: FastagRun[]
}

const activeRun = new Map<number, { id: number, started_at: string }>()

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const dataFile = path.join(dataDir, 'fastag.json')

let memory: Store | null = null
let chain: Promise<void> = Promise.resolve()

function stampParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00'
  return {
    file: `${get('year')}-${get('month')}-${get('day')}_${get('hour')}-${get('minute')}-${get('second')}`,
    label: `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`,
  }
}

function emptyStore(): Store {
  return { batches: [], vehicles: [], reads: [], runs: [] }
}

async function load(): Promise<Store> {
  if (memory) return memory
  try {
    const raw = await fs.readFile(dataFile, 'utf8')
    const parsed = JSON.parse(raw) as Partial<Store>
    memory = {
      batches: Array.isArray(parsed.batches) ? parsed.batches : [],
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
      reads: Array.isArray(parsed.reads) ? parsed.reads : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    }
  } catch {
    memory = emptyStore()
  }
  return memory
}

async function flush(store: Store) {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(dataFile, `${JSON.stringify(store, null, 2)}\n`)
}

function mutate(fn: (store: Store) => void) {
  const job = chain.then(async () => {
    const store = await load()
    fn(store)
    await flush(store)
  })
  chain = job.then(() => undefined, () => undefined)
  return job
}

async function readStore() {
  await chain
  return load()
}

function nextId(rows: { id: number }[]) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
}

function recount(store: Store, batchId: number) {
  const batch = store.batches.find((row) => row.id === batchId)
  if (!batch) return
  const vehicles = store.vehicles.filter((row) => row.batch_id === batchId)
  batch.vehicle_count = vehicles.length
  batch.ok_count = vehicles.filter((row) => row.status === 'ok').length
  batch.error_count = vehicles.filter((row) => row.status === 'error' || row.status === 'empty').length
  batch.read_count = store.reads.filter((row) => row.batch_id === batchId).length
}

function publicRead(row: StoredRead): FastagRead {
  return {
    id: row.id,
    batch_id: row.batch_id,
    vehicle_id: row.vehicle_id,
    vehicle_reg_no: row.vehicle_reg_no,
    reader_read_time: row.reader_read_time,
    seq_no: row.seq_no,
    lane_direction: row.lane_direction,
    toll_plaza_geocode: row.toll_plaza_geocode,
    toll_plaza_name: row.toll_plaza_name,
    vehicle_type: row.vehicle_type,
    created_at: row.created_at,
    fetched_at: row.fetched_at || row.created_at,
    run_id: row.run_id ?? null,
  }
}

export async function listBatches() {
  const store = await readStore()
  return [...store.batches].sort((a, b) => b.id - a.id).slice(0, 100)
}

export async function getBatch(id: number) {
  const store = await readStore()
  return store.batches.find((row) => row.id === id)
}

export async function getBatchDetail(id: number) {
  const store = await readStore()
  const batch = store.batches.find((row) => row.id === id)
  if (!batch) return null
  const vehicles = store.vehicles.filter((row) => row.batch_id === id).sort((a, b) => a.id - b.id)
  const reads = store.reads
    .filter((row) => row.batch_id === id)
    .sort((a, b) => String(b.fetched_at || b.created_at || '').localeCompare(String(a.fetched_at || a.created_at || '')) || b.id - a.id)
    .slice(0, READ_LIMIT)
    .map(publicRead)
  return { batch, vehicles, reads }
}

export async function createBatch(opts: {
  filename: string
  source: 'excel' | 'manual'
  uploadedBy: number | null
  plates: string[]
}) {
  const plates = [...new Set(opts.plates.map((plate) => normalizePlate(plate)).filter((plate): plate is string => !!plate))]
  if (!plates.length) {
    throw new Error('No vehicle numbers found. Use values like CG13BF6032.')
  }
  if (plates.length > MAX_VEHICLES) {
    throw new Error(`A sheet can contain up to ${MAX_VEHICLES} vehicles.`)
  }
  let batchId = 0
  await mutate((store) => {
    batchId = nextId(store.batches)
    store.batches.push({
      id: batchId,
      filename: opts.filename.slice(0, 255),
      source: opts.source,
      uploaded_by: opts.uploadedBy,
      vehicle_count: plates.length,
      ok_count: 0,
      error_count: 0,
      read_count: 0,
      status: 'ready',
      error_message: null,
      created_at: clock(),
      started_at: null,
      finished_at: null,
    })
    for (const plate of plates) {
      store.vehicles.push({
        id: nextId(store.vehicles),
        batch_id: batchId,
        vehicle_reg_no: plate,
        status: 'pending',
        http_status: null,
        error_message: null,
        read_count: 0,
        fetched_at: null,
      })
    }
  })
  const detail = await getBatchDetail(batchId)
  if (!detail) throw new Error('Could not load the uploaded sheet')
  return detail
}

function startRun(store: Store, batchId: number, kind: 'fetch' | 'retry', actorEmail: string | null) {
  const started_at = clock()
  const id = nextId(store.runs)
  store.runs.push({
    id,
    batch_id: batchId,
    kind,
    started_at,
    finished_at: null,
    actor_email: actorEmail,
  })
  activeRun.set(batchId, { id, started_at })
  return id
}

function closeRun(store: Store, batchId: number) {
  const active = activeRun.get(batchId)
  const run = store.runs.find((row) => row.id === active?.id)
  if (run) run.finished_at = clock()
  activeRun.delete(batchId)
}

function addReads(store: Store, batchId: number, vehicleId: number, regNo: string, records: Record<string, unknown>[]) {
  let stored = 0
  const run = activeRun.get(batchId)
  for (const record of records) {
    const seq = clip(pick(record, 'seqNo', 'seq_no', 'seq', 'sequenceNo'), 128)
    const row: StoredRead = {
      id: 0,
      batch_id: batchId,
      vehicle_id: vehicleId,
      vehicle_reg_no: regNo,
      reader_read_time: clip(pick(record, 'readerReadTime', 'reader_read_time', 'readTime', 'read_time'), 40),
      seq_no: seq,
      lane_direction: clip(pick(record, 'laneDirection', 'lane_direction', 'direction'), 16),
      toll_plaza_geocode: clip(pick(record, 'tollPlazaGeocode', 'toll_plaza_geocode', 'geocode'), 80),
      toll_plaza_name: clip(pick(record, 'tollPlazaName', 'toll_plaza_name', 'plazaName', 'plaza'), 191),
      vehicle_type: clip(pick(record, 'vehicleType', 'vehicle_type', 'class'), 32),
      raw_json: record,
      created_at: clock(),
      fetched_at: run?.started_at || clock(),
      run_id: run?.id ?? null,
    }
    const existing = seq && run
      ? store.reads.find((item) => item.run_id === run.id && item.seq_no === seq)
      : undefined
    if (existing) {
      Object.assign(existing, row, { id: existing.id, created_at: existing.created_at })
    } else {
      row.id = nextId(store.reads)
      store.reads.push(row)
    }
    stored += 1
  }
  return stored
}

async function lookupVehicle(regNo: string) {
  const token = String(process.env.FASTAG_ACCESS_TOKEN || '').trim()
  if (!token) {
    throw new Error('FASTAG_ACCESS_TOKEN is not set on the server')
  }
  const base = String(process.env.FASTAG_API_BASE || 'https://customer.ktt.io/refex/fastag').replace(/\/$/, '')
  const url = `${base}/${encodeURIComponent(regNo)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-AT-AccessToken': token,
      },
      signal: controller.signal,
    })
    const text = await response.text()
    let body: unknown = text
    try { body = text ? JSON.parse(text) : null } catch { /* keep text */ }
    return { httpStatus: response.status, ok: response.ok, body, text: text.slice(0, 500) }
  } finally {
    clearTimeout(timer)
  }
}

function markVehicle(store: Store, vehicleId: number, patch: Partial<FastagVehicle>) {
  const vehicle = store.vehicles.find((row) => row.id === vehicleId)
  if (vehicle) Object.assign(vehicle, patch)
}

async function fetchOne(batchId: number, vehicle: FastagVehicle) {
  const stamp = clock()
  try {
    const result = await lookupVehicle(vehicle.vehicle_reg_no)
    const failed = result.ok ? apiErrorMessage(result.body) : (apiErrorMessage(result.body) || result.text || `HTTP ${result.httpStatus}`)
    if (!result.ok || failed) {
      await mutate((store) => {
        markVehicle(store, vehicle.id, {
          status: 'error',
          http_status: result.httpStatus,
          error_message: clip(failed || `HTTP ${result.httpStatus}`, 500),
          read_count: 0,
          fetched_at: stamp,
        })
        recount(store, batchId)
      })
      return
    }

    let records = collectRecords(result.body)
    if (!records.length && isRecord(result.body) && Object.keys(result.body).length) {
      records = [result.body]
    }
    if (!records.length) {
      await mutate((store) => {
        markVehicle(store, vehicle.id, {
          status: 'empty',
          http_status: result.httpStatus,
          error_message: 'No toll reads returned',
          read_count: 0,
          fetched_at: stamp,
        })
        recount(store, batchId)
      })
      return
    }

    await mutate((store) => {
      const stored = addReads(store, batchId, vehicle.id, vehicle.vehicle_reg_no, records)
      markVehicle(store, vehicle.id, {
        status: 'ok',
        http_status: result.httpStatus,
        error_message: null,
        read_count: stored,
        fetched_at: stamp,
      })
      recount(store, batchId)
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Timed out waiting for the FASTag API'
      : (error instanceof Error ? error.message : 'Lookup failed')
    await mutate((store) => {
      markVehicle(store, vehicle.id, {
        status: 'error',
        error_message: clip(message, 500),
        fetched_at: stamp,
      })
      recount(store, batchId)
    })
  }
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await fn(items[index])
    }
  })
  await Promise.all(workers)
}

export async function runBatch(batchId: number, actor?: { id: number, email: string | null }) {
  const batch = await getBatch(batchId)
  if (!batch) throw new Error('Sheet not found')
  await mutate((store) => {
    startRun(store, batchId, 'fetch', actor?.email ?? null)
    for (const vehicle of store.vehicles) {
      if (vehicle.batch_id !== batchId) continue
      vehicle.status = 'pending'
      vehicle.http_status = null
      vehicle.error_message = null
      vehicle.read_count = 0
      vehicle.fetched_at = null
    }
    const current = store.batches.find((row) => row.id === batchId)
    if (current) {
      current.status = 'running'
      current.ok_count = 0
      current.error_count = 0
      current.error_message = null
      current.started_at = clock()
      current.finished_at = null
    }
  })
  await logAction({
    userId: actor?.id,
    email: actor?.email,
    actionType: 'fetch_started',
    itemType: 'fastag_batch',
    itemId: batchId,
    note: `Started a full fetch for ${batch.filename}`,
  })

  const store = await readStore()
  const vehicles = store.vehicles.filter((row) => row.batch_id === batchId).sort((a, b) => a.id - b.id)
  const concurrency = Math.max(1, Math.min(8, Number(process.env.FASTAG_CONCURRENCY || 4)))
  try {
    await mapPool(vehicles, concurrency, async (vehicle) => {
      await fetchOne(batchId, vehicle)
    })
    await mutate((current) => {
      const row = current.batches.find((item) => item.id === batchId)
      if (row) {
        row.status = 'done'
        row.finished_at = clock()
        recount(current, batchId)
      }
      closeRun(current, batchId)
    })
    const done = await getBatch(batchId)
    await logAction({
      userId: actor?.id,
      email: actor?.email,
      actionType: 'fetch_finished',
      itemType: 'fastag_batch',
      itemId: batchId,
      note: `Fetch finished. Stored ${done?.ok_count ?? 0}, failed ${done?.error_count ?? 0}, toll reads kept ${done?.read_count ?? 0}.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fetch failed'
    await mutate((current) => {
      const row = current.batches.find((item) => item.id === batchId)
      if (row) {
        row.status = 'failed'
        row.error_message = clip(message, 500)
        row.finished_at = clock()
        recount(current, batchId)
      }
      closeRun(current, batchId)
    })
    await logAction({
      userId: actor?.id,
      email: actor?.email,
      actionType: 'fetch_failed',
      itemType: 'fastag_batch',
      itemId: batchId,
      note: message,
    })
  }
}

async function finishBatch(batchId: number, status: 'done' | 'failed', errorMessage?: string) {
  await mutate((current) => {
    const row = current.batches.find((item) => item.id === batchId)
    if (!row) return
    row.status = status
    row.error_message = errorMessage ? clip(errorMessage, 500) : null
    row.finished_at = clock()
    recount(current, batchId)
  })
}

async function runRetry(batchId: number, failedIds: Set<number>, actor?: { id: number, email: string | null }) {
  const fresh = await readStore()
  const vehicles = fresh.vehicles.filter((row) => failedIds.has(row.id))
  const concurrency = Math.max(1, Math.min(8, Number(process.env.FASTAG_CONCURRENCY || 4)))
  try {
    await mapPool(vehicles, concurrency, async (vehicle) => {
      await fetchOne(batchId, vehicle)
    })
    await mutate((current) => closeRun(current, batchId))
    await finishBatch(batchId, 'done')
    const done = await getBatch(batchId)
    await logAction({
      userId: actor?.id,
      email: actor?.email,
      actionType: 'retry_finished',
      itemType: 'fastag_batch',
      itemId: batchId,
      note: `Retry finished. Failed remaining ${done?.error_count ?? 0}. Toll reads kept ${done?.read_count ?? 0}.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fetch failed'
    await mutate((current) => closeRun(current, batchId))
    await finishBatch(batchId, 'failed', message)
    await logAction({
      userId: actor?.id,
      email: actor?.email,
      actionType: 'retry_failed',
      itemType: 'fastag_batch',
      itemId: batchId,
      note: message,
    })
  }
}

export async function queueRetryFailed(batchId: number, actor?: { id: number, email: string | null }) {
  if (running.has(batchId)) return 0
  const store = await readStore()
  if (!store.batches.some((row) => row.id === batchId)) throw new Error('Sheet not found')
  const failedIds = new Set(
    store.vehicles.filter((row) => row.batch_id === batchId && row.status === 'error').map((row) => row.id),
  )
  if (!failedIds.size) return 0
  running.add(batchId)
  try {
    await mutate((current) => {
      startRun(current, batchId, 'retry', actor?.email ?? null)
      for (const vehicle of current.vehicles) {
        if (!failedIds.has(vehicle.id)) continue
        vehicle.status = 'pending'
        vehicle.http_status = null
        vehicle.error_message = null
        vehicle.read_count = 0
        vehicle.fetched_at = null
      }
      const batch = current.batches.find((row) => row.id === batchId)
      if (batch) {
        batch.status = 'running'
        batch.error_message = null
        batch.started_at = clock()
        batch.finished_at = null
        recount(current, batchId)
      }
    })
    await logAction({
      userId: actor?.id,
      email: actor?.email,
      actionType: 'retry_started',
      itemType: 'fastag_batch',
      itemId: batchId,
      note: `Re-running ${failedIds.size} failed vehicle${failedIds.size === 1 ? '' : 's'}`,
    })
  } catch (error) {
    running.delete(batchId)
    throw error
  }
  void runRetry(batchId, failedIds, actor).finally(() => running.delete(batchId))
  return failedIds.size
}

export async function queueBatch(batchId: number, actor?: { id: number, email: string | null }) {
  if (running.has(batchId)) return false
  running.add(batchId)
  try {
    await mutate((store) => {
      const row = store.batches.find((item) => item.id === batchId)
      if (!row) return
      row.status = 'running'
      row.error_message = null
      row.started_at = clock()
      row.finished_at = null
    })
  } catch (error) {
    running.delete(batchId)
    throw error
  }
  void runBatch(batchId, actor).finally(() => running.delete(batchId))
  return true
}

export async function exportBatchExcel(id: number) {
  const detail = await getBatchDetail(id)
  if (!detail) return null
  const stamp = stampParts()
  const rows = detail.reads.map((row) => ({
    Vehicle: row.vehicle_reg_no,
    'Read time': row.reader_read_time || '',
    'Seq no': row.seq_no || '',
    Direction: row.lane_direction || '',
    'Toll plaza': row.toll_plaza_name || '',
    Geocode: row.toll_plaza_geocode || '',
    Type: row.vehicle_type || '',
    'Fetched at': row.fetched_at || row.created_at || '',
    'Exported at': stamp.label,
  }))
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{
    Vehicle: '',
    'Read time': '',
    'Seq no': '',
    Direction: '',
    'Toll plaza': '',
    Geocode: '',
    Type: '',
    'Fetched at': '',
    'Exported at': stamp.label,
  }])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Stored responses')
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return {
    filename: `fastag-responses-${stamp.file}.xlsx`,
    buffer,
  }
}

export function isBatchRunning(batchId: number) {
  return running.has(batchId)
}
