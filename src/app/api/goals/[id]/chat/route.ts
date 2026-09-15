// src/app/api/goals/[id]/chat/route.ts
//
// The goal conversation. GET returns the thread for the page; POST sends
// one message and returns the reply plus which tools ran. The first POST on
// a fresh draft can carry `{ start: true }` instead of text: the agent opens
// with its first question.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { todayIn } from '@/lib/calendar/day'
import { displayText, loadThread, runThreadTurn } from '@/lib/chat/thread'
import { GOAL_SYSTEM_PROMPT, goalStateBlock, goalTools } from '@/lib/chat/goal'
import { loadLadder } from '@/lib/goals/ladder'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const messages = await loadThread(caller.supabase, caller.userId, { outcomeId: params.id, sessionKind: 'goal' }, 200)
  return NextResponse.json({
    messages: messages
      .map((m) => ({ id: m.id, role: m.role, text: displayText(m.content), created_at: m.created_at }))
      .filter((m) => m.text.trim().length > 0 || m.role === 'assistant'),
  })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const url = new URL(request.url)
  const body = (await request.json().catch(() => null)) as { message?: string; start?: boolean; docs?: string | null; commits?: string[] } | null
  if (!body || (!body.message?.trim() && !body.start)) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  const { supabase, userId } = caller
  const { data: outcome } = await supabase.from('outcomes').select('id, status').eq('id', params.id).eq('user_id', userId).maybeSingle()
  if (!outcome) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const today = todayIn('America/New_York')
  const ctx = { supabase, userId, outcomeId: params.id, today, origin: url.origin }
  const history = await loadThread(supabase, userId, { outcomeId: params.id, sessionKind: 'goal' }, 200)
  const questionsAsked = history.filter((m) => m.role === 'assistant' && displayText(m.content).includes('?')).length

  const userMessage = body.start
    ? '(The user just stated this goal and opened the conversation. Begin: one question, or propose the ladder if the state already answers everything.)'
    : body.message!.trim()

  try {
    const result = await runThreadTurn({
      supabase,
      userId,
      key: { outcomeId: params.id, sessionKind: 'goal' },
      systemPrompt: GOAL_SYSTEM_PROMPT,
      stateBlock: await goalStateBlock(ctx, { docs: body.docs ?? null, commits: body.commits ?? [], questionsAsked }),
      tools: goalTools(ctx),
      userMessage,
      today,
      effort: 'medium',
    })
    if (result.capped) return NextResponse.json({ error: `Paused for today: ${result.capped}` }, { status: 429 })
    const goal = await loadLadder(supabase, userId, params.id)
    return NextResponse.json({ reply: result.text, tools: result.toolsCalled, usd: result.usd, latencyMs: result.latencyMs, goal })
  } catch (error) {
    console.error('Goal chat failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Chat failed' }, { status: 500 })
  }
}
