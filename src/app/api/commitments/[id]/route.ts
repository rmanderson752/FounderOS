// src/app/api/commitments/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { validateCommitment, type CommitmentBody } from '@/lib/week/commitments'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as CommitmentBody | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const problem = validateCommitment(body, true)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const patch: Record<string, unknown> = {}
  for (const key of ['title', 'kind', 'days_of_week', 'duration_minutes', 'fixed_start', 'fixed_end', 'due_date', 'project_id', 'outcome_id', 'active', 'notes'] as const) {
    if (body[key] !== undefined) patch[key] = body[key]
  }
  const { data, error } = await caller.supabase
    .from('commitments')
    .update(patch)
    .eq('user_id', caller.userId)
    .eq('id', params.id)
    .select('id, title, kind, days_of_week, duration_minutes, fixed_start, fixed_end, due_date, active, project_id, outcome_id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ commitment: data })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await caller.supabase.from('commitments').delete().eq('user_id', caller.userId).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
