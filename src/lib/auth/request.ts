// src/lib/auth/request.ts
//
// Resolve who is calling an API route. Two ways in:
//   1. A browser session cookie (Supabase Auth) — the web app.
//   2. `Authorization: Bearer <token>` — the local fos CLI and the git /
//      Claude Code hooks. The token's SHA-256 is looked up on users; the
//      request then runs through the service-role client scoped to that user.
//
// Every route that accepts bearer auth gets an admin client back, so it must
// keep filtering by user_id. Routes that only ever see cookies get the RLS
// client and can lean on it.

import { createHash, randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Db } from '@/lib/supabase/types'

export interface Caller {
  userId: string
  /** 'session' for cookie auth, 'bearer' for the CLI/hooks, 'cron' for the daily job. */
  via: 'session' | 'bearer' | 'cron'
  supabase: Db
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken(): string {
  return `fos_${randomBytes(24).toString('hex')}`
}

export async function resolveCaller(request: NextRequest): Promise<Caller | null> {
  const auth = request.headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    if (!token) return null
    const admin = createAdminClient()
    const { data } = await admin
      .from('users')
      .select('id')
      .eq('hook_token_hash', hashToken(token))
      .maybeSingle()
    if (!data) return null
    return { userId: data.id, via: 'bearer', supabase: admin }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { userId: user.id, via: 'session', supabase: supabase as unknown as Db }
}

/** The daily cron authenticates with a shared secret, then acts per user. */
export function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}
