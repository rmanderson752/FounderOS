// src/app/api/signals/route.ts
//
// Where the hooks post what happened. Bearer auth only in practice (the CLI
// and the git / Claude Code hooks), though a session works too. Accepts one
// signal or a batch; returns what was stored and which blocks it resolved.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { ingestSignals, type IncomingSignal } from '@/lib/signals/ingest'

export const dynamic = 'force-dynamic'

const SOURCES = new Set(['git', 'session', 'fs', 'manual', 'deploy', 'crm'])

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as IncomingSignal | { signals: IncomingSignal[] } | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const list = 'signals' in body && Array.isArray(body.signals) ? body.signals : [body as IncomingSignal]
  const valid = list.filter((s) => s && SOURCES.has(s.source) && typeof s.kind === 'string' && typeof s.occurred_at === 'string')
  if (valid.length === 0) return NextResponse.json({ error: 'No valid signals' }, { status: 400 })
  if (valid.length > 200) return NextResponse.json({ error: 'At most 200 signals per request' }, { status: 400 })

  try {
    const result = await ingestSignals(caller.supabase, caller.userId, valid)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Signal ingest failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ingest failed' }, { status: 500 })
  }
}

/** Recent signals, for the audit view and `fos doctor`. */
export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const limit = Math.min(200, Number(new URL(request.url).searchParams.get('limit') ?? 50))
  const { data } = await caller.supabase
    .from('signals')
    .select('id, project_id, source, kind, summary, paths, occurred_at, duration_minutes, external_id, created_at')
    .eq('user_id', caller.userId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  return NextResponse.json({ signals: data ?? [] })
}
