// src/lib/jobs/email.ts
// The 7:30 card, by email, through Resend's REST API. No SDK: one POST.
// Disabled unless RESEND_API_KEY is set; the recipient is CARD_EMAIL_TO or
// the user's own email.

export interface EmailInput {
  to: string
  subject: string
  text: string
}

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendCardEmail(input: EmailInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY not set' }
  const from = process.env.CARD_EMAIL_FROM || 'Founder OS <onboarding@resend.dev>'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }),
  })
  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!response.ok) return { ok: false, error: payload.message ?? `HTTP ${response.status}` }
  return { ok: true, id: payload.id }
}
