// src/lib/chat/thread.ts
//
// One bounded tool-use turn on a persisted thread. Used by the goal
// conversation (interview → ladder → refine) and by the calendar thread
// ("push outreach to Thursday"). Context assembly follows the same rule as
// the card: a frozen system prompt and tool list under one cache breakpoint,
// a fresh state block regenerated every turn, then the last N messages of
// the thread replayed verbatim, then the new message. Memory lives in
// tables; the transcript never grows unbounded.

import type Anthropic from '@anthropic-ai/sdk'
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool'
import { anthropic, addUsage, CARD_MODEL, emptyUsage, usdFor, type UsageTotals } from '@/lib/card/anthropic'
import { readUsage, overCeiling, recordUsage } from '@/lib/card/usage'
import type { Db } from '@/lib/supabase/types'

export const THREAD_HISTORY = 30

export interface ThreadKey {
  /** The goal this thread belongs to; null for the calendar thread. */
  outcomeId: string | null
  sessionKind: 'goal' | 'week'
}

export interface ThreadMessage {
  id: string
  role: 'user' | 'assistant'
  content: Anthropic.Beta.Messages.BetaMessageParam['content']
  created_at: string
}

export interface TurnInput {
  supabase: Db
  userId: string
  key: ThreadKey
  systemPrompt: string
  stateBlock: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: BetaRunnableTool<any>[]
  userMessage: string
  today: string
  effort?: 'low' | 'medium' | 'high'
  maxIterations?: number
}

export interface TurnOutput {
  text: string
  toolsCalled: string[]
  usage: UsageTotals
  usd: number
  latencyMs: number
  capped: string | null
}

export async function loadThread(supabase: Db, userId: string, key: ThreadKey, limit = THREAD_HISTORY): Promise<ThreadMessage[]> {
  let query = supabase
    .from('agent_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .eq('session_kind', key.sessionKind)
    .order('created_at', { ascending: false })
    .limit(limit)
  query = key.outcomeId ? query.eq('outcome_id', key.outcomeId) : query.is('outcome_id', null)
  const { data } = await query
  return ((data ?? []) as ThreadMessage[]).reverse()
}

/**
 * The API needs a history that starts with a plain user message and keeps
 * every tool_use paired with its tool_result in the next message. Slicing the
 * last N rows can cut inside an exchange, and rows written in one batch can
 * come back in any order, so this rebuilds a valid sequence: orphaned
 * tool_result blocks are dropped, tool_use blocks with no result are
 * stripped, and empty messages disappear.
 */
export function replayable(messages: ThreadMessage[]): Anthropic.Beta.Messages.BetaMessageParam[] {
  type Block = { type: string; id?: string; tool_use_id?: string; text?: string }
  const blocksOf = (m: ThreadMessage): Block[] | string =>
    typeof m.content === 'string' ? m.content : ((m.content as unknown as Block[]) ?? [])

  const isPlainUser = (m: ThreadMessage) => {
    const c = blocksOf(m)
    return m.role === 'user' && (typeof c === 'string' || c.every((b) => b.type === 'text'))
  }
  let start = messages.findIndex(isPlainUser)
  if (start < 0) return []
  const slice = messages.slice(start)

  const out: Anthropic.Beta.Messages.BetaMessageParam[] = []
  for (let i = 0; i < slice.length; i++) {
    const m = slice[i]
    const c = blocksOf(m)
    if (typeof c === 'string') {
      if (c.trim()) out.push({ role: m.role, content: c })
      continue
    }
    if (m.role === 'assistant') {
      const next = slice[i + 1]
      const nextBlocks = next && next.role === 'user' ? blocksOf(next) : null
      const answered = new Set(
        Array.isArray(nextBlocks) ? nextBlocks.filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id) : []
      )
      const kept = c.filter((b) => b.type !== 'tool_use' || answered.has(b.id))
      if (kept.some((b) => b.type === 'text' ? !!b.text?.trim() : b.type !== 'thinking')) {
        out.push({ role: 'assistant', content: kept as unknown as Anthropic.Beta.Messages.BetaMessageParam['content'] })
      }
    } else {
      const prev = out[out.length - 1]
      const prevBlocks = prev && prev.role === 'assistant' && Array.isArray(prev.content) ? (prev.content as unknown as Block[]) : []
      const asked = new Set(prevBlocks.filter((b) => b.type === 'tool_use').map((b) => b.id))
      const kept = c.filter((b) => b.type !== 'tool_result' || asked.has(b.tool_use_id))
      if (kept.length > 0) out.push({ role: 'user', content: kept as unknown as Anthropic.Beta.Messages.BetaMessageParam['content'] })
    }
  }
  return out
}

/** Text a viewer should see for a stored message (tool blocks summarised). */
export function displayText(content: ThreadMessage['content']): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((b) => {
      const block = b as { type: string; text?: string; name?: string }
      if (block.type === 'text') return block.text ?? ''
      if (block.type === 'tool_use') return `⟶ ${block.name}`
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export async function runThreadTurn(input: TurnInput): Promise<TurnOutput> {
  const started = Date.now()
  const { supabase, userId, key } = input

  const usageToday = await readUsage(supabase, userId, input.today)
  const capped = overCeiling(usageToday)
  if (capped) return { text: '', toolsCalled: [], usage: emptyUsage(), usd: 0, latencyMs: 0, capped }

  const history = replayable(await loadThread(supabase, userId, key))
  const userMessage: Anthropic.Beta.Messages.BetaMessageParam = { role: 'user', content: input.userMessage }

  const runner = anthropic().beta.messages.toolRunner({
    model: CARD_MODEL,
    max_tokens: 8192,
    max_iterations: input.maxIterations ?? 6,
    thinking: { type: 'adaptive' },
    output_config: { effort: input.effort ?? 'medium' },
    system: [{ type: 'text', text: input.systemPrompt, cache_control: { type: 'ephemeral' } }],
    tools: input.tools,
    messages: [{ role: 'user', content: input.stateBlock }, ...history, userMessage],
  })

  let usage = emptyUsage()
  const toolsCalled: string[] = []
  let text = ''
  for await (const message of runner) {
    usage = addUsage(usage, message.usage)
    for (const block of message.content) {
      if (block.type === 'tool_use') toolsCalled.push(block.name)
      if (block.type === 'text') text = block.text
    }
  }

  // Persist only what is new this turn: the user message and everything the
  // runner appended after it. The state block is never stored.
  const all = runner.params.messages
  const prefix = 1 + history.length
  const fresh = all.slice(prefix)
  if (fresh.length > 0) {
    // Rows written in one batch would share NOW(); give each its own
    // millisecond so replay order is the order they happened.
    const base = Date.now()
    await supabase.from('agent_messages').insert(
      fresh.map((m, i) => ({
        user_id: userId,
        role: m.role,
        content: m.content,
        plan_date: input.today,
        session_kind: key.sessionKind,
        outcome_id: key.outcomeId,
        created_at: new Date(base + i).toISOString(),
      }))
    )
  }

  const usd = usdFor(CARD_MODEL, usage)
  const latencyMs = Date.now() - started
  await Promise.all([
    recordUsage(supabase, userId, input.today, usage, usd),
    supabase.from('session_events').insert({
      user_id: userId,
      event: 'conversation_turn',
      event_date: input.today,
      usd,
      latency_ms: latencyMs,
      metadata: {
        kind: key.sessionKind,
        outcome_id: key.outcomeId,
        tools: toolsCalled,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read: usage.cache_read_input_tokens,
      },
    }),
  ])

  return { text, toolsCalled, usage, usd, latencyMs, capped: null }
}
