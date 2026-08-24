// src/app/api/agent/review-insights/route.ts
// Generate insights from weekly review data (non-streaming)

import { createClient } from '@/lib/supabase/server'
import { buildAgentContext } from '@/lib/agent/context'
import { buildSystemPrompt, REVIEW_INSIGHTS_PROMPT } from '@/lib/agent/prompts'
import { chat } from '@/lib/agent/client'
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

    const insights = await chat({
      systemPrompt,
      messages: [{ role: 'user', content: REVIEW_INSIGHTS_PROMPT }],
      maxTokens: 512,
      temperature: 0.5,
    })

    return NextResponse.json({ insights })
  } catch (error) {
    console.error('Review insights error:', error)
    return NextResponse.json(
      { error: 'Failed to generate insights', details: String(error) },
      { status: 500 }
    )
  }
}
