import type { Response } from 'express'

export function okList(res: Response, rows: unknown[], total?: number) {
  return res.json({ total: total ?? rows.length, rows })
}

export function okItem(res: Response, payload: unknown, status = 200) {
  return res.status(status).json(payload)
}

export function okMessage(res: Response, messages: string | string[], payload: unknown = null, status = 200) {
  return res.status(status).json({
    status: 'success',
    messages: Array.isArray(messages) ? messages : [messages],
    payload,
  })
}

export function fail(res: Response, messages: string | string[], status = 400, payload: unknown = null) {
  return res.status(status).json({
    status: 'error',
    messages: Array.isArray(messages) ? messages : [messages],
    payload,
  })
}
