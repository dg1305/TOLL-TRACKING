import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import type { AuthUser } from '../middleware/auth.js'
import { clock } from '../utils/clock.js'

export type JsonUser = {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  password: string
  phone: string | null
  jobtitle: string | null
  region_key: string | null
  employee_num: string | null
  activated: number
  permissions: Record<string, string>
  must_change_password: number
  created_at: string
  updated_at: string | null
  last_login: string | null
  deleted_at: string | null
}

type ResetToken = {
  id: number
  user_id: number
  token_hash: string
  expires_at: string
  used_at: string | null
  created_at: string
}

type UserFile = {
  users: JsonUser[]
  resets: ResetToken[]
}

const dataFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/users.json')

const DEFAULT_USERS: Array<Omit<JsonUser, 'id' | 'password' | 'created_at' | 'updated_at' | 'last_login' | 'deleted_at'> & { password: string }> = [
  {
    username: 'raghul.je',
    first_name: 'Raghul',
    last_name: 'JE',
    email: 'raghul.je@refex.co.in',
    password: 'RefexAdmin@',
    phone: null,
    jobtitle: 'Administrator',
    region_key: null,
    employee_num: 'E0001',
    activated: 1,
    permissions: { superuser: '1', admin: '1' },
    must_change_password: 0,
  },
  {
    username: 'dickson.g',
    first_name: 'Dickson',
    last_name: 'G',
    email: 'dickson.g@refex.co.in',
    password: 'Welcome@2026',
    phone: null,
    jobtitle: null,
    region_key: null,
    employee_num: null,
    activated: 1,
    permissions: { fastag: '1' },
    must_change_password: 0,
  },
  {
    username: 'rajlaxmi.s',
    first_name: 'Rajlaxmi',
    last_name: 'S',
    email: 'rajlaxmi.s@refex.co.in',
    password: 'Welcome@2026',
    phone: null,
    jobtitle: null,
    region_key: null,
    employee_num: null,
    activated: 1,
    permissions: { fastag: '1' },
    must_change_password: 0,
  },
]

let memory: UserFile | null = null
let chain: Promise<void> = Promise.resolve()

function emptyFile(): UserFile {
  return { users: [], resets: [] }
}

async function load(): Promise<UserFile> {
  if (memory) return memory
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile, 'utf8')) as Partial<UserFile>
    memory = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      resets: Array.isArray(parsed.resets) ? parsed.resets : [],
    }
  } catch {
    memory = emptyFile()
  }
  return memory
}

async function flush(file: UserFile) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true })
  await fs.writeFile(dataFile, `${JSON.stringify(file, null, 2)}\n`)
}

function mutate(fn: (file: UserFile) => void) {
  const job = chain.then(async () => {
    const file = await load()
    fn(file)
    await flush(file)
  })
  chain = job.then(() => undefined, () => undefined)
  return job
}

async function readFileStore() {
  await chain
  return load()
}

function nextUserId(file: UserFile) {
  return file.users.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
}

export function toAuthUser(row: JsonUser): AuthUser {
  return {
    id: row.id,
    username: row.username,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    jobtitle: row.jobtitle,
    region_key: row.region_key,
    permissions: row.permissions,
    activated: row.activated,
    must_change_password: row.must_change_password,
  }
}

export function presentUser(row: JsonUser) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  const permissions = row.permissions || {}
  return {
    id: row.id,
    username: row.username,
    first_name: row.first_name,
    last_name: row.last_name,
    name,
    email: row.email,
    phone: row.phone,
    jobtitle: row.jobtitle,
    region_key: row.region_key,
    employee_num: row.employee_num,
    activated: row.activated,
    must_change_password: Boolean(row.must_change_password),
    permissions,
    is_admin: permissions.admin === '1' || permissions.superuser === '1',
    created_at: row.created_at,
    last_login: row.last_login,
  }
}

export async function ensureUsers() {
  await mutate((file) => {
    const now = clock()
    for (const seed of DEFAULT_USERS) {
      const email = seed.email.toLowerCase()
      if (file.users.some((row) => row.email.toLowerCase() === email && !row.deleted_at)) continue
      file.users.push({
        ...seed,
        id: nextUserId(file),
        email,
        password: bcrypt.hashSync(seed.password, 10),
        created_at: now,
        updated_at: null,
        last_login: null,
        deleted_at: null,
      })
    }
  })
}

export async function findUserByEmail(email: string) {
  const file = await readFileStore()
  const wanted = email.trim().toLowerCase()
  return file.users.find((row) => row.email.toLowerCase() === wanted && !row.deleted_at)
}

export async function findUserById(id: number) {
  const file = await readFileStore()
  return file.users.find((row) => row.id === id && !row.deleted_at)
}

export async function markLogin(id: number) {
  await mutate((file) => {
    const row = file.users.find((user) => user.id === id)
    if (row) row.last_login = clock()
  })
}

export async function updateProfile(id: number, patch: { first_name: string, last_name: string, phone: string }) {
  await mutate((file) => {
    const row = file.users.find((user) => user.id === id && !user.deleted_at)
    if (!row) return
    row.first_name = patch.first_name
    row.last_name = patch.last_name
    row.phone = patch.phone || null
    row.updated_at = clock()
  })
}

export async function updatePassword(id: number, passwordHash: string) {
  await mutate((file) => {
    const row = file.users.find((user) => user.id === id && !user.deleted_at)
    if (!row) return
    row.password = passwordHash
    row.must_change_password = 0
    row.updated_at = clock()
  })
}

export async function saveResetToken(userId: number, tokenHash: string, expiresAt: string) {
  await mutate((file) => {
    const now = clock()
    for (const token of file.resets) {
      if (token.user_id === userId && !token.used_at) token.used_at = now
    }
    const id = file.resets.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
    file.resets.push({
      id,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used_at: null,
      created_at: now,
    })
  })
}

export async function findActiveReset(tokenHash: string) {
  const file = await readFileStore()
  const now = clock()
  return file.resets.find((row) => row.token_hash === tokenHash && !row.used_at && row.expires_at > now)
}

export async function consumeReset(tokenId: number, userId: number) {
  await mutate((file) => {
    const now = clock()
    for (const token of file.resets) {
      if (token.id === tokenId || (token.user_id === userId && !token.used_at)) token.used_at = now
    }
  })
}
