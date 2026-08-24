// src/app/api/agent/chat/route.ts
// Main chat endpoint with streaming response

import { createClient } from '@/lib/supabase/server'
import { buildAgentContext } from '@/lib/agent/context'
import { buildSystemPrompt } from '@/lib/agent/prompts'
import { streamChat } from '@/lib/agent/client'
import type { AgentMessage } from '@/lib/agent/types'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { message, conversationId } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Build context and system prompt
    const context = await buildAgentContext(user.id)
    const systemPrompt = buildSystemPrompt(context)

    // Load or create conversation
    let messages: AgentMessage[] = []

    if (conversationId) {
      const { data: convo } = await supabase
        .from('agent_conversations')
        .select('messages')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single()

      if (convo?.messages) {
        messages = convo.messages as AgentMessage[]
      }
    }

    // Add user message
    const userMessage: AgentMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }
    messages.push(userMessage)

    // Format for Anthropic API (just role + content)
    const apiMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Stream from Anthropic
    const stream = await streamChat({
      systemPrompt,
      messages: apiMessages,
    })

    // Collect the full response while streaming to the client
    let fullResponse = ''
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)
        fullResponse += text
        controller.enqueue(chunk)
      },
      async flush() {
        // Save the conversation after streaming completes
        const assistantMessage: AgentMessage = {
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString(),
        }
        messages.push(assistantMessage)

        try {
          if (conversationId) {
            await supabase
              .from('agent_conversations')
              .update({
                messages,
                updated_at: new Date().toISOString(),
              })
              .eq('id', conversationId)
              .eq('user_id', user.id)
          } else {
            await supabase
              .from('agent_conversations')
              .insert({
                user_id: user.id,
                messages,
                context_type: 'general',
              })
          }
        } catch (err) {
          console.error('Failed to save conversation:', err)
        }
      },
    })

    const readableStream = stream.pipeThrough(transformStream)

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Agent chat error:', error)
    return NextResponse.json(
      { error: 'Chat failed', details: String(error) },
      { status: 500 }
    )
  }
}
