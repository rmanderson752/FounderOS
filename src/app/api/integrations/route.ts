// src/app/api/integrations/route.ts
// Manage inbound integrations. Session auth. The webhook token is returned
// once at creation; only its hash is stored.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller, hashToken } from '@/lib/auth/request'
import { randomBytes } from 'crypto'

const KINDS = new Set(['webhook', 'hubspot', 'attio', 'pipedrive', 'notion', 'zapier'])

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data } = await caller.supabase
    .from('integrations')
    .select('id, kind, name, project_id, active, events_received, last_event_at, created_at')
    .eq('user_id', caller.userId)
    .order('created_at')
  return NextResponse.json({ integrations: data ?? [] })
}

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller || caller.via === 'bearer') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { name?: string; kind?: string; project_id?: string | null } | null
  const name = body?.name?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const kind = body?.kind ?? 'webhook'
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'invalid kind' }, { status: 400 })

  const token = `whk_${randomBytes(18).toString('hex')}`
  const { data, error } = await caller.supabase
    .from('integrations')
    .insert({ user_id: caller.userId, kind, name, token_hash: hashToken(token), project_id: body?.project_id ?? null })
    .select('id, kind, name, project_id, active, events_received, last_event_at, created_at')
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  return NextResponse.json({ integration: data, token, url: `${origin}/api/integrations/webhook/${token}` }, { status: 201 })
}
