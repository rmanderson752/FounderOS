// src/lib/card/turn.ts
//
// One bounded tool-use turn: the model calls propose_block, the server
// validates against the same gap math the timeline uses, and the model gets
// up to three corrections before the turn fails closed to a deterministic
// fallback. Nothing the model says is trusted until validateBlock accepts it.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'
import { anthropic, addUsage, CARD_MODEL, emptyUsage, type UsageTotals } from './anthropic'
import { CARD_SYSTEM_PROMPT } from './prompt'
import { buildStateBlock, type CardContextInput } from './context'
import { validateBlock } from '@/lib/planner/validate'
import { MIN_WINDOW_MINUTES } from '@/lib/planner/window'
import type { Candidate } from '@/lib/planner/types'

export const MAX_CORRECTIONS = 3

export interface Proposal {
  deliverable: string
  minutes: number
  expected_paths: string[]
  rationale: string
  start_command: string | null
}

export interface TurnResult {
  proposal: Proposal
  startsAt: Date
  endsAt: Date
  /** 'model' when the tool call was accepted; 'fallback' when the turn failed closed. */
  source: 'model' | 'fallback'
  attempts: number
  usage: UsageTotals
  latencyMs: number
  /** The full exchange, for agent_messages. */
  messages: Anthropic.Beta.Messages.BetaMessageParam[]
  stopReason: string | null
}

export interface TurnInput {
  context: CardContextInput
  forbiddenTitles: string[]
  existingBlocks: { start: Date; end: Date }[]
  effort?: 'low' | 'medium' | 'high'
}

const ProposalSchema = z.object({
  deliverable: z.string().describe('A finished artifact, named specifically. Never a project or milestone name.'),
  minutes: z.number().int().min(MIN_WINDOW_MINUTES).describe('Duration in minutes, between 30 and the window length.'),
  expected_paths: z.array(z.string()).describe('Files or folders the work will touch. Empty for non-code work.'),
  rationale: z.string().describe('One short line: why this is the next step toward the milestone.'),
  start_command: z.string().nullable().describe('Shell command that opens the work, or null.'),
})

function fallbackFrom(input: TurnInput): Proposal {
  const m = input.context.milestone
  const fit = (m?.candidates ?? []).find(
    (c: Candidate) => c.estimated_minutes <= input.context.window.minutes
  ) ?? m?.candidates[0]

  if (fit) {
    return {
      deliverable: fit.deliverable,
      minutes: Math.min(input.context.window.minutes, Math.max(MIN_WINDOW_MINUTES, fit.estimated_minutes)),
      expected_paths: fit.expected_paths,
      rationale: `First candidate for "${m?.title}" (fallback: the model did not produce a valid proposal).`,
      start_command: input.context.repoPath ? `cd ${input.context.repoPath} && claude "${fit.deliverable}"` : null,
    }
  }

  // No candidates at all: the smallest honest artifact is a written next step.
  const target = m?.title ?? input.context.outcome.title
  return {
    deliverable: `Write the next three concrete steps for "${target}" into a PLAN.md note, each with the file or screen it touches`,
    minutes: Math.min(input.context.window.minutes, 45),
    expected_paths: ['PLAN.md'],
    rationale: 'No candidates exist yet; a written next step is the smallest artifact that unblocks the milestone.',
    start_command: input.context.repoPath ? `cd ${input.context.repoPath} && claude "write PLAN.md: next three steps for ${target}"` : null,
  }
}

export async function runCardTurn(input: TurnInput): Promise<TurnResult> {
  const started = Date.now()
  const window = input.context.window
  let attempts = 0
  let accepted: Proposal | null = null

  const proposeBlock = betaZodTool({
    name: 'propose_block',
    description:
      'Propose the single deliverable for this work period. The server validates it; a rejection names exactly what to fix.',
    inputSchema: ProposalSchema,
    run: (args) => {
      if (accepted) return 'ACCEPTED (already). Reply with nothing further.'
      attempts += 1

      const startsAt = window.start
      const endsAt = new Date(startsAt.getTime() + args.minutes * 60_000)
      const verdict = validateBlock({
        startsAt,
        endsAt,
        deliverable: args.deliverable,
        window,
        forbiddenTitles: input.forbiddenTitles,
        existingBlocks: input.existingBlocks,
      })

      if (!verdict.ok) {
        if (attempts >= MAX_CORRECTIONS) {
          return `REJECTED: ${verdict.reason}. No more attempts; reply with nothing further.`
        }
        return `REJECTED: ${verdict.reason}. Call propose_block again with that corrected.`
      }

      accepted = {
        deliverable: args.deliverable.trim(),
        minutes: args.minutes,
        expected_paths: args.expected_paths,
        rationale: args.rationale.trim(),
        start_command: args.start_command?.trim() || null,
      }
      return 'ACCEPTED. Reply with nothing further.'
    },
  })

  const runner = anthropic().beta.messages.toolRunner({
    model: CARD_MODEL,
    max_tokens: 4096,
    max_iterations: MAX_CORRECTIONS + 1,
    thinking: { type: 'adaptive' },
    output_config: { effort: input.effort ?? 'medium' },
    // Stable prefix: system prompt + tool list under one breakpoint. The
    // state block varies per call and sits after it, in the user message.
    system: [{ type: 'text', text: CARD_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [proposeBlock],
    messages: [{ role: 'user', content: buildStateBlock(input.context) }],
  })

  let usage = emptyUsage()
  let stopReason: string | null = null
  for await (const message of runner) {
    usage = addUsage(usage, message.usage)
    stopReason = message.stop_reason
    if (accepted) break
  }

  const proposal = accepted ?? fallbackFrom(input)
  const startsAt = window.start
  const endsAt = new Date(startsAt.getTime() + proposal.minutes * 60_000)

  return {
    proposal,
    startsAt,
    endsAt,
    source: accepted ? 'model' : 'fallback',
    attempts,
    usage,
    latencyMs: Date.now() - started,
    messages: [...runner.params.messages],
    stopReason,
  }
}
