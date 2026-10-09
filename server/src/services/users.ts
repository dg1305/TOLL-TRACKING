import type { AuthUser } from '../middleware/auth.js'
import { findUserById, presentUser } from './accounts.js'

export async function transformUser(id: number) {
  const row = await findUserById(id)
  if (!row) return null
  return presentUser(row)
}

export function publicUser(user: AuthUser) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return {
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    name,
    email: user.email,
    jobtitle: user.jobtitle,
    region_key: user.region_key,
    permissions: user.permissions,
    must_change_password: Boolean(user.must_change_password),
  }
}
