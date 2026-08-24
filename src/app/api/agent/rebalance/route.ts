// src/app/api/agent/rebalance/route.ts
// Rebalance remaining week when blocks are skipped

import { createClient } from '@/lib/supabase/server'
import { buildAgentContext } from '@/lib/agent/context'
import { buildSystemPrompt, REBALANCE_PROMPT } from '@/lib/agent/prompts'
import { streamChat } from '@/lib/agent/client'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const context = await buildAgentContext(user.id)
    const systemPrompt = buildSystemPrompt(context)

    const stream = await streamChat({
      systemPrompt,
      messages: [{ role: 'user', content: REBALANCE_PROMPT }],
      maxTokens: 2048,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Rebalance error:', error)
    return NextResponse.json(
      { error: 'Rebalance failed', details: String(error) },
      { status: 500 }
    )
  }
}
