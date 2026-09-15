// src/app/api/week/chat/route.ts
// "Push outreach to Thursday." One turn on the calendar thread; returns the
// reply and the refreshed week.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { todayIn } from '@/lib/calendar/day'
import { runThreadTurn } from '@/lib/chat/thread'
import { WEEK_SYSTEM_PROMPT, weekStateBlock, weekTools } from '@/lib/chat/week'
import { loadWeek } from '@/lib/week/plan'
import { ensureDefaultChains, loadDayTemplate } from '@/lib/chains'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const url = new URL(request.url)
  const body = (await request.json().catch(() => null)) as { message?: string; start?: string } | null
  if (!body?.message?.trim()) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  const { supabase, userId } = caller
  try {
    await ensureDefaultChains(supabase, userId)
    const [week, template] = await Promise.all([loadWeek({ supabase, userId, origin: url.origin, weekStart: body.start }), loadDayTemplate(supabase, userId)])
    const today = week.today
    const result = await runThreadTurn({
      supabase,
      userId,
      key: { outcomeId: null, sessionKind: 'week' },
      systemPrompt: WEEK_SYSTEM_PROMPT,
      stateBlock: weekStateBlock(week, today, template),
      tools: weekTools({ supabase, userId, today, origin: url.origin, timeZone: week.timeZone }),
      userMessage: body.message.trim(),
      today,
      effort: 'low',
    })
    if (result.capped) return NextResponse.json({ error: `Paused for today: ${result.capped}` }, { status: 429 })
    const refreshed = await loadWeek({ supabase, userId, origin: url.origin, weekStart: body.start })
    return NextResponse.json({ reply: result.text, tools: result.toolsCalled, usd: result.usd, week: refreshed })
  } catch (error) {
    console.error('Week chat failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Chat failed' }, { status: 500 })
  }
}
