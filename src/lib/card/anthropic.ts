// src/lib/card/anthropic.ts
//
// One client, one model per loop, and the arithmetic to turn a usage object
// into dollars. Server-side only — the key never reaches the browser.
//
// Model choice is DECISIONS.md D4: Opus 5 in the loop (card and decompose),
// Sonnet 5 for side calls in separate requests. Never switch models inside a
// loop — caches are model-scoped.

import Anthropic from '@anthropic-ai/sdk'

export const CARD_MODEL = 'claude-opus-5'
export const DECOMPOSE_MODEL = 'claude-opus-5'
export const SIDE_MODEL = 'claude-sonnet-5'

let client: Anthropic | null = null

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }
  if (!client) client = new Anthropic()
  return client
}

/** USD per million tokens. Cache write is 1.25× input, cache read is 0.1×. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
}

export interface UsageTotals {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export function emptyUsage(): UsageTotals {
  return { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
}

export function addUsage(
  total: UsageTotals,
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number | null
    cache_creation_input_tokens?: number | null
  }
): UsageTotals {
  return {
    input_tokens: total.input_tokens + usage.input_tokens,
    output_tokens: total.output_tokens + usage.output_tokens,
    cache_read_input_tokens: total.cache_read_input_tokens + (usage.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: total.cache_creation_input_tokens + (usage.cache_creation_input_tokens ?? 0),
  }
}

export function usdFor(model: string, usage: UsageTotals): number {
  const price = PRICES[model] ?? PRICES['claude-opus-5']
  const perTok = (n: number, perMillion: number) => (n / 1_000_000) * perMillion
  const usd =
    perTok(usage.input_tokens, price.input) +
    perTok(usage.cache_creation_input_tokens, price.input * 1.25) +
    perTok(usage.cache_read_input_tokens, price.input * 0.1) +
    perTok(usage.output_tokens, price.output)
  return Math.round(usd * 1_000_000) / 1_000_000
}
