// src/app/api/commitments/route.ts
// Recurring and dated obligations. Usually written by the goal conversation;
// this route exists for the CLI and for direct edits.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { validateCommitment, type CommitmentBody } from '@/lib/week/commitments'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data } = await caller.supabase
    .from('commitments')
    .select('id, title, kind, days_of_week, duration_minutes, fixed_start, fixed_end, due_date, active, project_id, outcome_id, notes')
    .eq('user_id', caller.userId)
    .order('kind')
    .order('created_at')
  return NextResponse.json({ commitments: data ?? [] })
}

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as CommitmentBody | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const problem = validateCommitment(body)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const { data, error } = await caller.supabase
    .from('commitments')
    .insert({
      user_id: caller.userId,
      title: body.title!.trim(),
      kind: body.kind,
      days_of_week: body.days_of_week ?? [],
      duration_minutes: body.duration_minutes ?? (body.kind === 'fixed' && body.fixed_start && body.fixed_end ? 60 : 60),
      fixed_start: body.fixed_start ?? null,
      fixed_end: body.fixed_end ?? null,
      due_date: body.due_date ?? null,
      project_id: body.project_id ?? null,
      outcome_id: body.outcome_id ?? null,
      notes: body.notes ?? null,
    })
    .select('id, title, kind, days_of_week, duration_minutes, fixed_start, fixed_end, due_date, active, project_id, outcome_id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commitment: data }, { status: 201 })
}
