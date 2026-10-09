import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { all, get, now, run } from '../db/index.js'
import { fail, okItem, okList, okMessage } from '../utils/response.js'
import { transformUser } from '../services/users.js'
import { requireAdmin } from '../middleware/auth.js'
import { logAction } from '../services/actionLog.js'

const router = Router()

router.get('/', requireAdmin, async (_req, res) => {
  const rows = await all<{ id: number }>(`
    SELECT id FROM users WHERE deleted_at IS NULL ORDER BY id
  `)
  const users = []
  for (const r of rows) {
    users.push(await transformUser(r.id))
  }
  return okList(res, users)
})

router.get('/:id', requireAdmin, async (req, res) => {
  const user = await transformUser(Number(req.params.id))
  if (!user) return fail(res, 'Not found', 404)
  return okItem(res, user)
})

router.post('/', requireAdmin, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const username = String(req.body?.username || email.split('@')[0] || '').trim()
  const first = String(req.body?.first_name || '').trim()
  const last = String(req.body?.last_name || '').trim()
  const password = String(req.body?.password || 'Sales@3i')
  if (!email || !first) return fail(res, 'Email and first name are required')
  const exists = await get(`SELECT id FROM users WHERE email = ? OR username = ?`, [email, username])
  if (exists) return fail(res, 'Email or username already exists')

  const perms = JSON.stringify(req.body?.permissions || { sales: '1', 'opportunities.view': '1', 'opportunities.edit': '1' })
  const ts = now()
  const info = await run(`
    INSERT INTO users (first_name, last_name, username, email, password, jobtitle, region_key, activated, permissions, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?)
  `, [
    first,
    last,
    username,
    email,
    bcrypt.hashSync(password, 10),
    String(req.body?.jobtitle || 'Sales'),
    req.body?.region_key || null,
    perms,
    ts,
    ts,
  ])
  await logAction({ userId: req.user!.id, actionType: 'user_create', itemType: 'user', itemId: info.insertId })
  return okItem(res, await transformUser(info.insertId), 201)
})

router.patch('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const existing = await get(`SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`, [id])
  if (!existing) return fail(res, 'Not found', 404)
  const fields: string[] = []
  const params: unknown[] = []
  const map: Record<string, string> = {
    first_name: 'first_name',
    last_name: 'last_name',
    jobtitle: 'jobtitle',
    region_key: 'region_key',
    phone: 'phone',
    activated: 'activated',
  }
  for (const [k, col] of Object.entries(map)) {
    if (req.body?.[k] !== undefined) {
      fields.push(`${col} = ?`)
      params.push(req.body[k])
    }
  }
  if (req.body?.permissions) {
    fields.push('permissions = ?')
    params.push(JSON.stringify(req.body.permissions))
  }
  if (req.body?.password) {
    fields.push('password = ?')
    params.push(bcrypt.hashSync(String(req.body.password), 10))
  }
  if (!fields.length) return okItem(res, await transformUser(id))
  fields.push('updated_at = ?')
  params.push(now(), id)
  await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params)
  return okItem(res, await transformUser(id))
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user!.id) return fail(res, 'You cannot delete your own account')
  await run(`UPDATE users SET deleted_at = ?, activated = 0 WHERE id = ?`, [now(), id])
  await logAction({ userId: req.user!.id, actionType: 'user_delete', itemType: 'user', itemId: id })
  return okMessage(res, 'User deactivated')
})

export default router
