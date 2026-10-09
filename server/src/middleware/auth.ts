import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { findUserById, toAuthUser } from '../services/accounts.js'
import { fail } from '../utils/response.js'

export type AuthUser = {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string | null
  jobtitle: string | null
  region_key: string | null
  permissions: Record<string, unknown>
  activated: number
  must_change_password: number
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

const secret = () => process.env.JWT_SECRET || 'dev-secret'

export function signToken(user: { id: number; username: string }) {
  return jwt.sign({ sub: user.id, username: user.username }, secret(), { expiresIn: '7d' })
}

function parsePerms(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return {} }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return {}
}

function isTruthy(v: unknown) {
  return v === '1' || v === 1 || v === true || v === 'true'
}

export function hasPermission(permissions: Record<string, unknown> | undefined, permission: string) {
  const p = permissions || {}
  if (isTruthy(p.superuser) || isTruthy(p.admin)) return true
  return isTruthy(p[permission])
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return fail(res, 'Unauthorized', 401)
  }
  try {
    const decoded = jwt.verify(header.slice(7), secret()) as unknown as { sub: number }
    const row = await findUserById(Number(decoded.sub))

    if (!row || !row.activated) return fail(res, 'Unauthorized', 401)
    req.user = toAuthUser(row)
    next()
  } catch {
    return fail(res, 'Unauthorized', 401)
  }
}

export function can(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (hasPermission(req.user?.permissions, permission)) return next()
    return fail(res, `Forbidden: missing ${permission}`, 403)
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (hasPermission(req.user?.permissions, 'admin')) return next()
  return fail(res, 'Forbidden: admin only', 403)
}
