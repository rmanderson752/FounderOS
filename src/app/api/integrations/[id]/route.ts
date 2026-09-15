// src/app/api/integrations/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { active?: boolean; name?: string; project_id?: string | null } | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if (body.active !== undefined) patch.active = body.active
  if (body.name?.trim()) patch.name = body.name.trim()
  if (body.project_id !== undefined) patch.project_id = body.project_id
  const { error } = await caller.supabase.from('integrations').update(patch).eq('id', params.id).eq('user_id', caller.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await caller.supabase.from('integrations').delete().eq('id', params.id).eq('user_id', caller.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
