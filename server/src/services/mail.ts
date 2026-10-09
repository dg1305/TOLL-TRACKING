import nodemailer from 'nodemailer'

function smtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = port === 465
    ? true
    : process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1'
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const fromRaw = process.env.SMTP_FROM || 'noreply'
  const from = fromRaw.includes('@')
    ? fromRaw
    : `"${fromRaw}" <${user}>`

  return { host, port, secure, user, pass, from }
}

export function mailConfigured() {
  const { user, pass } = smtpConfig()
  return Boolean(user && pass)
}

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }) {
  const cfg = smtpConfig()
  if (!cfg.user || !cfg.pass) {
    throw new Error('SMTP is not configured (SMTP_USER / SMTP_PASS)')
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  })

  await transporter.sendMail({
    from: cfg.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html || opts.text.replace(/\n/g, '<br/>'),
  })
}
