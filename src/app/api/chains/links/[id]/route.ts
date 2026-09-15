// src/app/api/chains/links/[id]/route.ts
// Edit, move, or remove a link. Positions are renumbered after a move/delete.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import type { Db } from '@/lib/supabase/types'

const KINDS = new Set(['habit', 'fixed', 'flexible', 'goal', 'chore', 'free'])

async function renumber(supabase: Db, chainId: string) {
  const { data } = await supabase.from('chain_links').select('id, position').eq('chain_id', chainId).eq('active', true).order('position')
  const rows = (data ?? []) as { id: string; position: number }[]
  await Promise.all(rows.map((l, i) => (l.position === i ? null : supabase.from('chain_links').update({ position: i }).eq('id', l.id))))
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { title?: string; kind?: string; duration_minutes?: number; days_of_week?: number[] | null; move?: 'up' | 'down'; position?: number } | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { data: link } = await caller.supabase.from('chain_links').select('id, chain_id, position').eq('id', params.id).eq('user_id', caller.userId).maybeSingle()
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (body.title?.trim()) patch.title = body.title.trim()
  if (body.kind) {
    if (!KINDS.has(body.kind)) return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
    patch.kind = body.kind
  }
  if (body.duration_minutes !== undefined) patch.duration_minutes = Math.max(5, Math.min(480, Number(body.duration_minutes) || 30))
  if (body.days_of_week !== undefined) patch.days_of_week = body.days_of_week
  if (Object.keys(patch).length > 0) {
    const { error } = await caller.supabase.from('chain_links').update(patch).eq('id', link.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.move || body.position !== undefined) {
    const { data: rows } = await caller.supabase.from('chain_links').select('id, position').eq('chain_id', link.chain_id).eq('active', true).order('position')
    const order = ((rows ?? []) as { id: string; position: number }[]).map((r) => r.id)
    const from = order.indexOf(link.id)
    const to = body.move ? Math.max(0, Math.min(order.length - 1, from + (body.move === 'up' ? -1 : 1))) : Math.max(0, Math.min(order.length - 1, Number(body.position)))
    if (from !== to) {
      order.splice(from, 1)
      order.splice(to, 0, link.id)
      await Promise.all(order.map((id, i) => caller.supabase.from('chain_links').update({ position: i }).eq('id', id)))
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: link } = await caller.supabase.from('chain_links').select('id, chain_id').eq('id', params.id).eq('user_id', caller.userId).maybeSingle()
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await caller.supabase.from('chain_links').delete().eq('id', link.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await renumber(caller.supabase, link.chain_id)
  return NextResponse.json({ ok: true })
}
