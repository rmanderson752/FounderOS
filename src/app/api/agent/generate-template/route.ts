// src/app/api/agent/generate-template/route.ts
// Generate a weekly template from projects + schedule constraints

import { createClient } from '@/lib/supabase/server'
import { buildAgentContext } from '@/lib/agent/context'
import { buildSystemPrompt, TEMPLATE_GENERATION_PROMPT } from '@/lib/agent/prompts'
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
      messages: [{ role: 'user', content: TEMPLATE_GENERATION_PROMPT }],
      maxTokens: 2048,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Generate template error:', error)
    return NextResponse.json(
      { error: 'Generation failed', details: String(error) },
      { status: 500 }
    )
  }
}
