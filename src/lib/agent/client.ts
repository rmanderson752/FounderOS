// src/lib/agent/client.ts
// Anthropic API client wrapper — server-side only

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5-20250929'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicStreamOptions {
  systemPrompt: string
  messages: AnthropicMessage[]
  maxTokens?: number
  temperature?: number
}

/**
 * Call the Anthropic API with streaming.
 * Returns a ReadableStream that yields text deltas.
 */
export async function streamChat({
  systemPrompt,
  messages,
  maxTokens = 1024,
  temperature = 0.7,
}: AnthropicStreamOptions): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error: ${response.status} ${err}`)
  }

  if (!response.body) {
    throw new Error('No response body from Anthropic API')
  }

  // Transform the SSE stream into clean text deltas
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          controller.close()
          return
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()

          if (data === '[DONE]') {
            controller.close()
            return
          }

          try {
            const parsed = JSON.parse(data)

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              controller.enqueue(
                new TextEncoder().encode(parsed.delta.text)
              )
            }

            if (parsed.type === 'message_stop') {
              controller.close()
              return
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    },
    cancel() {
      reader.cancel()
    },
  })
}

/**
 * Non-streaming chat call for simple use cases (e.g., review insights).
 * Returns the complete response text.
 */
export async function chat({
  systemPrompt,
  messages,
  maxTokens = 1024,
  temperature = 0.7,
}: AnthropicStreamOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
}
