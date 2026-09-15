// src/app/api/chains/[id]/links/route.ts
// Add a link to a chain (appended, or after a given position).

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'

const KINDS = new Set(['habit', 'fixed', 'flexible', 'goal', 'chore', 'free'])

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { title?: string; kind?: string; duration_minutes?: number; after_position?: number | null; days_of_week?: number[] | null; commitment_id?: string | null } | null
  const title = body?.title?.trim()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  const kind = body?.kind ?? 'habit'
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
  const minutes = Math.max(5, Math.min(480, Number(body?.duration_minutes) || 30))

  const { data: chain } = await caller.supabase.from('chains').select('id').eq('id', params.id).eq('user_id', caller.userId).maybeSingle()
  if (!chain) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: rows } = await caller.supabase.from('chain_links').select('id, position').eq('chain_id', params.id).eq('active', true).order('position')
  const links = (rows ?? []) as { id: string; position: number }[]
  const at = body?.after_position === null || body?.after_position === undefined ? links.length : Math.min(links.length, Math.max(0, body.after_position + 1))
  await Promise.all(links.slice(at).map((l) => caller.supabase.from('chain_links').update({ position: l.position + 1 }).eq('id', l.id)))

  const { data, error } = await caller.supabase
    .from('chain_links')
    .insert({ user_id: caller.userId, chain_id: params.id, position: at, title, kind, duration_minutes: minutes, days_of_week: body?.days_of_week ?? null, commitment_id: body?.commitment_id ?? null })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  return NextResponse.json({ id: data.id, position: at }, { status: 201 })
}
