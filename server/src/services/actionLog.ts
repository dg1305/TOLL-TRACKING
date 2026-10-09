import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clock } from '../utils/clock.js'

export type ActivityEntry = {
  id: number
  at: string
  user_id: number | null
  email: string | null
  action: string
  item_type: string | null
  item_id: string | null
  note: string | null
}

type ActivityFile = { entries: ActivityEntry[] }

const dataFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/activity.json')

let memory: ActivityFile | null = null
let chain: Promise<void> = Promise.resolve()

async function load(): Promise<ActivityFile> {
  if (memory) return memory
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile, 'utf8')) as Partial<ActivityFile>
    memory = { entries: Array.isArray(parsed.entries) ? parsed.entries : [] }
  } catch {
    memory = { entries: [] }
  }
  return memory
}

function mutate(fn: (file: ActivityFile) => void) {
  const job = chain.then(async () => {
    const file = await load()
    fn(file)
    await fs.mkdir(path.dirname(dataFile), { recursive: true })
    await fs.writeFile(dataFile, `${JSON.stringify(file, null, 2)}\n`)
  })
  chain = job.then(() => undefined, () => undefined)
  return job
}

export async function logAction(opts: {
  userId?: number | null
  email?: string | null
  actionType: string
  itemType?: string | null
  itemId?: string | number | null
  note?: string | null
}) {
  try {
    await mutate((file) => {
      const id = file.entries.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
      file.entries.push({
        id,
        at: clock(),
        user_id: opts.userId ?? null,
        email: opts.email ?? null,
        action: opts.actionType,
        item_type: opts.itemType ?? null,
        item_id: opts.itemId != null ? String(opts.itemId) : null,
        note: opts.note ?? null,
      })
    })
  } catch (error) {
    console.warn('[activity]', error instanceof Error ? error.message : error)
  }
}

export async function listActivity(limit = 200) {
  await chain
  const file = await load()
  return [...file.entries].sort((a, b) => b.id - a.id).slice(0, limit)
}
