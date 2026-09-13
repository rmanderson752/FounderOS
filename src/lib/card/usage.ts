// src/lib/card/usage.ts
//
// The cost ceiling. Checked before every model call, incremented after with
// the real counts from the API. Hard limits per user per day; on breach the
// caller gets a friendly cap and no request is made.

import type { Db } from '@/lib/supabase/types'
import type { UsageTotals } from './anthropic'

export const DAILY_LIMITS = {
  turns: 40,
  inputTokens: 600_000,
  outputTokens: 60_000,
}

export interface UsageRow {
  turns: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  usd: number
}

export async function readUsage(supabase: Db, userId: string, usageDate: string): Promise<UsageRow> {
  const { data } = await supabase
    .from('agent_usage')
    .select('turns, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, usd')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .maybeSingle()
  return (
    (data as UsageRow | null) ?? {
      turns: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      usd: 0,
    }
  )
}

export function overCeiling(usage: UsageRow): string | null {
  if (usage.turns >= DAILY_LIMITS.turns) return `daily turn limit (${DAILY_LIMITS.turns}) reached`
  if (usage.input_tokens >= DAILY_LIMITS.inputTokens) return 'daily input-token limit reached'
  if (usage.output_tokens >= DAILY_LIMITS.outputTokens) return 'daily output-token limit reached'
  return null
}

export async function recordUsage(
  supabase: Db,
  userId: string,
  usageDate: string,
  usage: UsageTotals,
  usd: number
): Promise<void> {
  const current = await readUsage(supabase, userId, usageDate)
  await supabase.from('agent_usage').upsert(
    {
      user_id: userId,
      usage_date: usageDate,
      turns: current.turns + 1,
      input_tokens: current.input_tokens + usage.input_tokens,
      output_tokens: current.output_tokens + usage.output_tokens,
      cache_read_tokens: current.cache_read_tokens + usage.cache_read_input_tokens,
      cache_write_tokens: current.cache_write_tokens + usage.cache_creation_input_tokens,
      usd: Math.round((Number(current.usd) + usd) * 1_000_000) / 1_000_000,
    },
    { onConflict: 'user_id,usage_date' }
  )
}
