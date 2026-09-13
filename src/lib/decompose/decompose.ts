// src/lib/decompose/decompose.ts
//
// "State your goals and work backwards." One structured-output call turns a
// goal sentence plus what the system can see (project docs, 60 days of
// commit subjects and paths, observed pace) into a validated ladder of
// milestones with candidate deliverables. It runs once per goal and is stored
// with a version number; it is not an agent and it does not loop.
//
// Grounding matters more than cleverness here: the model is told to cite
// commit hashes for anything it marks already done, and the server refuses a
// ladder whose titles collide with project or outcome names.

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { anthropic, addUsage, DECOMPOSE_MODEL, emptyUsage, type UsageTotals } from '@/lib/card/anthropic'
import { validateDeliverable } from '@/lib/planner/validate'
import { LadderSchema, type Ladder } from './schema'

export const DECOMPOSE_SYSTEM_PROMPT = `You reverse-engineer a goal into a ladder of milestones for a solo founder who works in bursts across several projects.

You receive: the goal in the founder's words (with a target date if they gave one), the project it belongs to, any project documentation they keep, the last sixty days of commit subjects and touched paths, and the observed pace in hours per week. Produce a ladder that a card generator can draw one deliverable from every work period.

Requirements:
- 3 to 7 milestones, ordered so each unblocks the next. Each has a definition of done that is observable, an honest estimate of remaining minutes, and 2–4 candidate deliverables of 30–180 minutes each, named as finished artifacts (file, screen, document, message), never as labels ("work on auth" is not a deliverable; "wire Supabase sign-in on app/(auth)/SignInScreen.tsx and verify the happy path on the simulator" is).
- Use the commit history. If the history shows a milestone is already finished, mark already_done true and cite the commit hashes or subjects as evidence. Never invent work that has already shipped. Candidates should name real paths from the history when the work touches existing code.
- Use the founder's vocabulary from the docs and commits. Do not rename their concepts.
- If the docs and history do not say something you had to assume (a stack, a store, a testing approach), list it in assumptions rather than silently deciding.
- Estimates are for this founder at their observed pace, not for a team. Be honest; a slipping projection is more useful than a flattering one.
- For non-code goals (a job search, a deal, a launch), candidates are documents, messages, meetings booked, or forms submitted, with expected_paths empty.`

export interface DecomposeInput {
  goal: string
  targetDate: string | null
  projectName: string | null
  /** Project docs the CLI or the form supplied (README, HNRY.md, notes). Capped by the caller. */
  docs: string | null
  /** `hash subject | paths` lines from git log, newest first. */
  commits: string[]
  paceHoursPerWeek: number | null
  today: string
}

export interface DecomposeResult {
  ladder: Ladder
  usage: UsageTotals
  latencyMs: number
  /** The raw JSON the model returned, stored as provenance. */
  raw: string
  rejected: string[]
}

export const MAX_DOC_CHARS = 32_000

function buildUserMessage(input: DecomposeInput): string {
  const docs = input.docs ? input.docs.slice(0, MAX_DOC_CHARS) : '(none provided)'
  const commits = input.commits.length ? input.commits.slice(0, 200).join('\n') : '(no commit history provided)'
  const pace = input.paceHoursPerWeek === null ? 'not yet observed' : `~${input.paceHoursPerWeek}h/week on this project`

  return [
    `<goal>${input.goal}</goal>`,
    `<target_date>${input.targetDate ?? 'none'}</target_date>`,
    `<today>${input.today}</today>`,
    `<project>${input.projectName ?? 'unspecified'}</project>`,
    `<observed_pace>${pace}</observed_pace>`,
    `<project_docs>\n${docs}\n</project_docs>`,
    `<commit_history newest_first="true">\n${commits}\n</commit_history>`,
  ].join('\n\n')
}

/**
 * Server-side checks the schema cannot express. Returns the reasons anything
 * was rejected; the caller decides whether to surface or retry.
 */
export function auditLadder(ladder: Ladder, forbiddenTitles: string[]): string[] {
  const problems: string[] = []
  const lower = forbiddenTitles.map((t) => t.trim().toLowerCase())
  ladder.milestones.forEach((m, i) => {
    if (lower.includes(m.title.trim().toLowerCase())) {
      problems.push(`milestone ${i + 1} title "${m.title}" equals a project or outcome name`)
    }
    if (m.already_done && m.evidence.length === 0) {
      problems.push(`milestone ${i + 1} is marked already_done without evidence`)
    }
    m.candidates.forEach((c, j) => {
      const verdict = validateDeliverable(c.deliverable, [...forbiddenTitles, m.title])
      if (!verdict.ok) problems.push(`milestone ${i + 1} candidate ${j + 1}: ${verdict.reason}`)
    })
  })
  return problems
}

export async function decomposeOutcome(
  input: DecomposeInput,
  forbiddenTitles: string[]
): Promise<DecomposeResult> {
  const started = Date.now()
  let usage = emptyUsage()
  let rejected: string[] = []
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: buildUserMessage(input) },
  ]

  // One correction pass: if the audit finds label-shaped candidates or an
  // unevidenced already_done, the problems go back once. After that the
  // ladder is returned with the remaining problems attached for the UI.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic().messages.parse({
      model: DECOMPOSE_MODEL,
      max_tokens: 16_000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: zodOutputFormat(LadderSchema) },
      system: [{ type: 'text', text: DECOMPOSE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages,
    })
    usage = addUsage(usage, response.usage)

    const raw = response.content.find((b) => b.type === 'text')?.text ?? ''
    const ladder = response.parsed_output
    if (!ladder) {
      throw new Error(`Decomposition returned no parseable ladder (stop_reason ${response.stop_reason})`)
    }

    rejected = auditLadder(ladder, forbiddenTitles)
    if (rejected.length === 0 || attempt === 1) {
      return { ladder, usage, latencyMs: Date.now() - started, raw, rejected }
    }

    messages.push({ role: 'assistant', content: raw })
    messages.push({
      role: 'user',
      content: `The server rejected parts of that ladder:\n- ${rejected.join('\n- ')}\n\nReturn the corrected ladder in full.`,
    })
  }

  throw new Error('unreachable')
}
