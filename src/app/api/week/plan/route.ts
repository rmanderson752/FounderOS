// src/app/api/week/plan/route.ts
// Re-plan the provisional part of the week from goals and commitments.
// Locked, resolved, and already-started blocks stay where they are.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { replanWeek } from '@/lib/week/plan'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const url = new URL(request.url)
  const body = (await request.json().catch(() => ({}))) as { start?: string }
  try {
    const week = await replanWeek({ supabase: caller.supabase, userId: caller.userId, origin: url.origin, weekStart: body.start })
    return NextResponse.json(week)
  } catch (error) {
    console.error('Week plan failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Week plan failed' }, { status: 500 })
  }
}
