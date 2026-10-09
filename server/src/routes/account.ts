import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { fail, okItem, okMessage } from '../utils/response.js'
import { transformUser } from '../services/users.js'
import { logAction } from '../services/actionLog.js'
import { findUserById, updatePassword, updateProfile } from '../services/accounts.js'

const router = Router()

router.get('/profile', async (req, res) => {
  return okItem(res, await transformUser(req.user!.id))
})

router.patch('/profile', async (req, res) => {
  const first = String(req.body?.first_name || '').trim()
  const last = String(req.body?.last_name || '').trim()
  const phone = String(req.body?.phone || '').trim()
  if (!first) return fail(res, 'First name is required')
  await updateProfile(req.user!.id, { first_name: first, last_name: last, phone })
  await logAction({ userId: req.user!.id, actionType: 'profile_update', itemType: 'user', itemId: req.user!.id })
  return okItem(res, await transformUser(req.user!.id))
})

router.post('/password', async (req, res) => {
  const current = String(req.body?.current_password || '')
  const password = String(req.body?.password || '')
  const confirm = String(req.body?.password_confirmation || password)
  if (password.length < 8) return fail(res, 'Password must be at least 8 characters')
  if (password !== confirm) return fail(res, 'Passwords do not match')

  const row = await findUserById(req.user!.id)
  if (!row) return fail(res, 'User not found', 404)
  if (!req.user!.must_change_password) {
    if (!current || !bcrypt.compareSync(current, row.password)) {
      return fail(res, 'Current password is incorrect', 401)
    }
  }

  await updatePassword(req.user!.id, bcrypt.hashSync(password, 10))
  await logAction({ userId: req.user!.id, actionType: 'password_change', itemType: 'user', itemId: req.user!.id })
  return okMessage(res, 'Password updated')
})

export default router
