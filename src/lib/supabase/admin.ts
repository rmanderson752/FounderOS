// src/lib/supabase/admin.ts
//
// Service-role client for code paths that have no browser session: the CLI
// and hook bearer path (/api/signals, /api/card with Authorization: Bearer)
// and the daily cron. RLS does not apply to this client, so every query made
// with it MUST filter by user_id explicitly. Server only; never imported by
// client components.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Db } from './types'

let admin: Db | null = null

export function createAdminClient(): Db {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  if (!admin) {
    admin = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Next.js patches global fetch with a data cache; PostgREST reads are
      // plain GETs with stable URLs and would be served stale. Never cache.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    })
  }
  return admin
}
