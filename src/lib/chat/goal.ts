// src/lib/chat/goal.ts
//
// The goal conversation. Three phases in one thread:
//
//   interview   the agent asks short questions, one per turn, only where the
//               docs and commit history cannot answer — at most five
//   ladder      it proposes the milestone ladder with propose_ladder; the
//               user sees it beside the thread and reacts
//   refine      "that's done", "split 4", "add 90 min every Tuesday for
//               outreach" — the agent edits with tools as they talk; the
//               ladder and the calendar update
//
// The tools are closures over the caller's database access; every write is
// scoped to the user and the outcome.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { Db } from '@/lib/supabase/types'
import { LadderSchema, MilestoneSchema } from '@/lib/decompose/schema'
import { auditLadder } from '@/lib/decompose/decompose'
import { validateDeliverable } from '@/lib/planner/validate'
import { loadLadder } from '@/lib/goals/ladder'
import { replanWeek } from '@/lib/week/plan'
import { upsertCommitment } from '@/lib/week/commitments'

export const GOAL_SYSTEM_PROMPT = `You help a solo founder turn a goal into a ladder of milestones, then keep it true as they work. You talk like a sharp colleague: short, specific, no filler, no lists of questions.

The conversation has three phases. You will be told which the goal is in.

INTERVIEW. Ask what you actually need to build a good ladder and nothing else — at most five questions over the whole conversation, one per message, each a single sentence. Never ask what the docs, the commit history, or the state block already answer. Good questions: what already exists, what "done" looks like to them, what is fixed or recurring around this goal, what they are avoiding. If the goal is clear enough after one or two answers, stop asking and propose.

LADDER. Call propose_ladder once with 3–7 ordered milestones, each with an observable definition of done, an honest estimate at the founder's observed pace, and 2–4 candidate deliverables of 30–180 minutes phrased as finished artifacts naming the file, screen, document, or message. Use their vocabulary. If the history shows a milestone is already finished, mark it already_done with the evidence. Then say in one or two sentences what you assumed and ask them to react.

REFINE. When they react, edit with the tools: update_milestone, add_milestone, remove_milestone, reorder_milestones, set_goal. When they mention something recurring or fixed ("I do outreach Tuesdays", "gym Mon/Wed/Fri at 7", "invoice due the 20th"), capture it with add_commitment so the week planner can place it. When they say the ladder is right, call accept_ladder — that activates the goal and plans the week. Confirm each edit in a few words; do not restate the whole ladder.

Rules:
- One question per message. Never a numbered list of questions.
- Deliverables are finished artifacts, never labels ("work on auth" is not one).
- Do not invent work the commit history shows is done; do not pad the ladder.
- Keep replies under 80 words unless proposing the ladder.
- After a tool result says a change was rejected, fix exactly what it names.`

export interface GoalThreadContext {
  supabase: Db
  userId: string
  outcomeId: string
  today: string
  origin: string
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type DayName = (typeof DAY_NAMES)[number]
const DaySchema = z.enum(DAY_NAMES)
function dayNumbers(names: DayName[]): number[] {
  return Array.from(new Set(names.map((n) => DAY_NAMES.indexOf(n)))).sort()
}
const DaysInput = z
  .array(z.union([DaySchema, z.number().int().min(0).max(6)]))
  .describe('Day names, e.g. ["mon","wed","fri"]; "every weekday" is mon–fri. Empty for chores.')
function toDayNumbers(days: (DayName | number)[]): number[] {
  return Array.from(new Set(days.map((d) => (typeof d === 'number' ? d : DAY_NAMES.indexOf(d))))).sort()
}

const CommitmentInput = z.object({
  title: z.string(),
  kind: z.enum(['flexible', 'fixed', 'habit', 'chore']).describe('flexible: weekly block the planner places; fixed: exact time like an event; habit: small and daily; chore: one-off with a due date'),
  days: DaysInput,
  duration_minutes: z.number().int().min(5).max(480),
  fixed_start: z.string().nullable().describe('HH:mm, fixed only'),
  fixed_end: z.string().nullable().describe('HH:mm, fixed only'),
  due_date: z.string().nullable().describe('yyyy-MM-dd, chores only'),
})

export function goalTools(ctx: GoalThreadContext) {
  const { supabase, userId, outcomeId } = ctx

  const forbidden = async (): Promise<string[]> => {
    const [{ data: projects }, { data: outcome }] = await Promise.all([
      supabase.from('projects').select('name').eq('user_id', userId),
      supabase.from('outcomes').select('title').eq('id', outcomeId).maybeSingle(),
    ])
    return [...((projects ?? []) as { name: string }[]).map((p) => p.name), ...(outcome ? [outcome.title as string] : [])]
  }

  const milestonesOrdered = async () => {
    const { data } = await supabase
      .from('milestones')
      .select('id, title, position, status, estimated_minutes, candidates, definition_of_done')
      .eq('user_id', userId)
      .eq('outcome_id', outcomeId)
      .order('position')
    return (data ?? []) as { id: string; title: string; position: number; status: string; estimated_minutes: number; candidates: unknown; definition_of_done: string | null }[]
  }

  const renumber = async () => {
    const rows = await milestonesOrdered()
    await Promise.all(rows.map((m, i) => (m.position === i ? null : supabase.from('milestones').update({ position: i }).eq('id', m.id))))
  }

  const proposeLadder = betaZodTool({
    name: 'propose_ladder',
    description: 'Propose (or fully replace) the milestone ladder for this goal. The server validates it and stores it as a new version.',
    inputSchema: LadderSchema,
    run: async (ladder) => {
      const problems = auditLadder(ladder, await forbidden())
      if (problems.length > 0) return `REJECTED:\n- ${problems.join('\n- ')}\nCall propose_ladder again with those fixed.`

      const { data: current } = await supabase.from('outcomes').select('decomposition_version').eq('id', outcomeId).maybeSingle()
      const version = ((current?.decomposition_version as number | undefined) ?? 0) + 1
      await supabase.from('milestones').delete().eq('user_id', userId).eq('outcome_id', outcomeId)
      const firstOpen = ladder.milestones.findIndex((m) => !m.already_done)
      const { error } = await supabase.from('milestones').insert(
        ladder.milestones.map((m, i) => ({
          user_id: userId,
          outcome_id: outcomeId,
          title: m.title,
          definition_of_done: m.definition_of_done,
          estimated_minutes: m.already_done ? 0 : m.estimated_minutes,
          position: i,
          status: m.already_done ? 'done' : i === firstOpen ? 'active' : 'pending',
          candidates: m.candidates,
          already_done_evidence: m.evidence,
          created_by: 'model',
          decomposition_version: version,
        }))
      )
      if (error) return `ERROR: ${error.message}`
      await supabase
        .from('outcomes')
        .update({ definition_of_done: ladder.definition_of_done, assumptions: ladder.assumptions, decomposition_version: version })
        .eq('id', outcomeId)
        .eq('user_id', userId)
      return `Ladder v${version} saved: ${ladder.milestones.length} milestones. The user can see it beside this thread. Ask them to react; call accept_ladder when they confirm.`
    },
  })

  const updateMilestone = betaZodTool({
    name: 'update_milestone',
    description: 'Change one milestone by its 1-based position: title, definition of done, estimate, status, or candidates.',
    inputSchema: z.object({
      position: z.number().int().min(1),
      title: z.string().nullable(),
      definition_of_done: z.string().nullable(),
      estimated_minutes: z.number().int().min(0).nullable(),
      status: z.enum(['pending', 'active', 'done', 'skipped']).nullable(),
      candidates: z.array(MilestoneSchema.shape.candidates.element).nullable().describe('Replaces all candidates when given'),
    }),
    run: async (input) => {
      const rows = await milestonesOrdered()
      const target = rows[input.position - 1]
      if (!target) return `REJECTED: there is no milestone ${input.position}; the ladder has ${rows.length}.`
      const patch: Record<string, unknown> = {}
      if (input.title) patch.title = input.title
      if (input.definition_of_done) patch.definition_of_done = input.definition_of_done
      if (input.estimated_minutes !== null) patch.estimated_minutes = input.estimated_minutes
      if (input.status) patch.status = input.status
      if (input.candidates) {
        const bad = input.candidates.map((c) => validateDeliverable(c.deliverable, [])).find((v) => !v.ok)
        if (bad && !bad.ok) return `REJECTED: candidate — ${bad.reason}`
        patch.candidates = input.candidates
      }
      if (Object.keys(patch).length === 0) return 'Nothing to change.'
      const { error } = await supabase.from('milestones').update(patch).eq('id', target.id).eq('user_id', userId)
      if (error) return `ERROR: ${error.message}`
      if (input.status === 'done' || input.status === 'skipped') {
        const next = rows.find((m, i) => i > input.position - 1 && m.status === 'pending')
        if (next) await supabase.from('milestones').update({ status: 'active' }).eq('id', next.id)
      }
      return `Milestone ${input.position} updated.`
    },
  })

  const addMilestone = betaZodTool({
    name: 'add_milestone',
    description: 'Insert a milestone after the given 1-based position (0 = at the start).',
    inputSchema: z.object({ after_position: z.number().int().min(0), milestone: MilestoneSchema }),
    run: async (input) => {
      const problems = auditLadder({ definition_of_done: '', assumptions: [], milestones: [input.milestone] }, await forbidden())
      if (problems.length > 0) return `REJECTED:\n- ${problems.join('\n- ')}`
      const rows = await milestonesOrdered()
      const at = Math.min(input.after_position, rows.length)
      await Promise.all(rows.slice(at).map((m) => supabase.from('milestones').update({ position: m.position + 1 }).eq('id', m.id)))
      const { error } = await supabase.from('milestones').insert({
        user_id: userId,
        outcome_id: outcomeId,
        title: input.milestone.title,
        definition_of_done: input.milestone.definition_of_done,
        estimated_minutes: input.milestone.estimated_minutes,
        position: at,
        status: 'pending',
        candidates: input.milestone.candidates,
        already_done_evidence: input.milestone.evidence,
        created_by: 'model',
      })
      if (error) return `ERROR: ${error.message}`
      await renumber()
      return `Inserted as milestone ${at + 1}.`
    },
  })

  const removeMilestone = betaZodTool({
    name: 'remove_milestone',
    description: 'Delete a milestone by its 1-based position.',
    inputSchema: z.object({ position: z.number().int().min(1) }),
    run: async (input) => {
      const rows = await milestonesOrdered()
      const target = rows[input.position - 1]
      if (!target) return `REJECTED: no milestone ${input.position}.`
      await supabase.from('milestones').delete().eq('id', target.id).eq('user_id', userId)
      await renumber()
      return `Removed "${target.title}".`
    },
  })

  const reorderMilestones = betaZodTool({
    name: 'reorder_milestones',
    description: 'Reorder the ladder. Give the current 1-based positions in their new order, e.g. [2,1,3,4].',
    inputSchema: z.object({ order: z.array(z.number().int().min(1)) }),
    run: async (input) => {
      const rows = await milestonesOrdered()
      if (input.order.length !== rows.length || new Set(input.order).size !== rows.length || input.order.some((p) => p > rows.length)) {
        return `REJECTED: order must list each of the ${rows.length} positions exactly once.`
      }
      await Promise.all(input.order.map((from, i) => supabase.from('milestones').update({ position: i }).eq('id', rows[from - 1].id)))
      return 'Reordered.'
    },
  })

  const setGoal = betaZodTool({
    name: 'set_goal',
    description: 'Change the goal itself: title, target date, weight (1–3), or definition of done.',
    inputSchema: z.object({
      title: z.string().nullable(),
      target_date: z.string().nullable().describe('yyyy-MM-dd'),
      weight: z.number().int().min(1).max(3).nullable(),
      definition_of_done: z.string().nullable(),
    }),
    run: async (input) => {
      const patch: Record<string, unknown> = {}
      if (input.title) patch.title = input.title
      if (input.target_date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.target_date)) return 'REJECTED: target_date must be yyyy-MM-dd'
        patch.target_date = input.target_date
      }
      if (input.weight !== null) patch.weight = input.weight
      if (input.definition_of_done) patch.definition_of_done = input.definition_of_done
      if (Object.keys(patch).length === 0) return 'Nothing to change.'
      const { error } = await supabase.from('outcomes').update(patch).eq('id', outcomeId).eq('user_id', userId)
      return error ? `ERROR: ${error.message}` : 'Goal updated.'
    },
  })

  const addCommitment = betaZodTool({
    name: 'add_commitment',
    description: 'Record something recurring or dated the user mentioned, so the week planner places it: a flexible weekly block, a fixed-time commitment, a daily habit, or a dated chore. Same title = update the existing one (use this to change days or times too).',
    inputSchema: CommitmentInput,
    run: async (input) => {
      if (input.kind === 'fixed' && (!input.fixed_start || !input.fixed_end)) return 'REJECTED: fixed commitments need fixed_start and fixed_end (HH:mm).'
      if (input.kind === 'chore' && !input.due_date) return 'REJECTED: chores need a due_date.'
      const days = toDayNumbers(input.days)
      if (input.kind !== 'chore' && days.length === 0) return 'REJECTED: days is required for flexible, fixed and habit.'
      const { data: outcome } = await supabase.from('outcomes').select('project_id').eq('id', outcomeId).maybeSingle()
      const result = await upsertCommitment(supabase, userId, {
        title: input.title,
        kind: input.kind,
        days_of_week: days,
        duration_minutes: input.duration_minutes,
        fixed_start: input.fixed_start,
        fixed_end: input.fixed_end,
        due_date: input.due_date,
        outcome_id: outcomeId,
        project_id: (outcome?.project_id as string | null) ?? null,
      })
      if ('error' in result) return `ERROR: ${result.error}`
      return `${result.action === 'updated' ? 'Updated' : 'Recorded'} "${input.title}" (${input.kind}).`
    },
  })

  const removeCommitment = betaZodTool({
    name: 'remove_commitment',
    description: 'Deactivate a commitment by title.',
    inputSchema: z.object({ title: z.string() }),
    run: async (input) => {
      const { data } = await supabase.from('commitments').select('id, title').eq('user_id', userId).eq('active', true).ilike('title', `%${input.title}%`)
      const rows = (data ?? []) as { id: string; title: string }[]
      if (rows.length === 0) return `No active commitment matches "${input.title}".`
      await supabase.from('commitments').update({ active: false }).in('id', rows.map((r) => r.id))
      return `Removed ${rows.map((r) => `"${r.title}"`).join(', ')}.`
    },
  })

  const acceptLadder = betaZodTool({
    name: 'accept_ladder',
    description: 'The user confirmed the ladder. Activates the goal and plans the week around it.',
    inputSchema: z.object({}),
    run: async () => {
      const rows = await milestonesOrdered()
      if (rows.length === 0) return 'REJECTED: there is no ladder to accept yet; call propose_ladder first.'
      if (!rows.some((m) => m.status === 'active')) {
        const first = rows.find((m) => m.status === 'pending')
        if (first) await supabase.from('milestones').update({ status: 'active' }).eq('id', first.id)
      }
      await supabase.from('outcomes').update({ status: 'active' }).eq('id', outcomeId).eq('user_id', userId)
      try {
        const week = await replanWeek({ supabase, userId, origin: ctx.origin })
        const goalBlocks = week.blocks.filter((b) => b.kind === 'goal' && b.outcome_id === outcomeId).length
        return `Goal is active. The week was planned: ${goalBlocks} block${goalBlocks === 1 ? '' : 's'} for this goal this week.${week.notes.length ? ` Notes: ${week.notes.slice(0, 3).join('; ')}` : ''}`
      } catch (error) {
        return `Goal is active. Week planning failed: ${error instanceof Error ? error.message : 'unknown'} — the user can plan from the calendar.`
      }
    },
  })

  return [proposeLadder, updateMilestone, addMilestone, removeMilestone, reorderMilestones, setGoal, addCommitment, removeCommitment, acceptLadder]
}

/** The state block: the goal, its ladder, its commitments, docs and history. */
export async function goalStateBlock(ctx: GoalThreadContext, extras: { docs: string | null; commits: string[]; questionsAsked: number }): Promise<string> {
  const { supabase, userId, outcomeId } = ctx
  const view = await loadLadder(supabase, userId, outcomeId)
  if (!view) return '<state>{"error":"goal not found"}</state>'
  const { data: commitments } = await supabase
    .from('commitments')
    .select('title, kind, days_of_week, duration_minutes, fixed_start, fixed_end, due_date')
    .eq('user_id', userId)
    .eq('active', true)

  const phase = view.outcome.status === 'draft' ? (view.milestones.length === 0 ? 'interview' : 'ladder proposed, awaiting reaction') : 'refine (goal is active)'

  const state = {
    today: ctx.today,
    phase,
    questions_asked_so_far: extras.questionsAsked,
    goal: {
      title: view.outcome.title,
      target_date: view.outcome.target_date,
      weight: view.outcome.weight,
      definition_of_done: view.outcome.definition_of_done,
      project: view.outcome.project?.name ?? null,
      repo_path: view.outcome.project?.repo_path ?? null,
      status: view.outcome.status,
    },
    ladder: view.milestones.map((m, i) => ({
      position: i + 1,
      title: m.title,
      status: m.status,
      estimated_minutes: m.estimated_minutes,
      definition_of_done: m.definition_of_done,
      candidates: m.candidates.map((c) => c.deliverable),
    })),
    pace: view.pace_line,
    commitments: (commitments ?? []) as unknown[],
    project_docs: extras.docs ? extras.docs.slice(0, 20_000) : null,
    commit_history_newest_first: extras.commits.slice(0, 120),
  }
  return `<state>\n${JSON.stringify(state, null, 1)}\n</state>`
}
