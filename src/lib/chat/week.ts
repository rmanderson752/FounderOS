// src/lib/chat/week.ts
//
// The calendar thread: "push outreach to Thursday", "drop the gym Friday",
// "add 45 minutes for the invoice tomorrow at 2", "re-plan the week". Small
// tool surface, every write scoped to the user; moves lock the block so the
// planner leaves it alone.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { Db } from '@/lib/supabase/types'
import { loadWeek, replanWeek, type WeekView } from '@/lib/week/plan'

export const WEEK_SYSTEM_PROMPT = `You adjust a solo founder's week on their calendar. You receive the week as it stands: each day's events, free gaps, and the planned blocks (goal work, recurring commitments, habits, chores) with their ids and times, plus the founder's commitments.

Do what they ask with the tools, then confirm in one short sentence. Times are in the founder's timezone. Rules:
- Move, resize, add or remove blocks only as asked; never rearrange the rest of the week on your own.
- A block must sit inside the day's free time; if the requested slot collides with an event or another block, say so and offer the nearest free slot instead of forcing it.
- When they describe something recurring ("every Tuesday", "Mon/Wed/Fri at 7"), record it with add_commitment and then call replan_week so it lands on the calendar.
- "Plan my week" / "re-plan" → replan_week.
- Marking work done or skipped → resolve_block.
- Under 60 words. No lists unless they ask what is on a day.`

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type DayName = (typeof DAY_NAMES)[number]
const DaySchema = z.enum(DAY_NAMES)
function dayNumbers(names: DayName[]): number[] {
  return Array.from(new Set(names.map((n) => DAY_NAMES.indexOf(n)))).sort()
}

export interface WeekThreadContext {
  supabase: Db
  userId: string
  today: string
  origin: string
  timeZone: string
}

function findBlock(week: WeekView, ref: string) {
  const r = ref.trim().toLowerCase()
  const byId = week.blocks.find((b) => b.id === r || b.id.startsWith(r))
  if (byId) return byId
  const matches = week.blocks.filter((b) => b.title.toLowerCase().includes(r))
  return matches.length === 1 ? matches[0] : matches.find((b) => b.status === 'planned') ?? null
}

export function weekTools(ctx: WeekThreadContext) {
  const { supabase, userId, timeZone } = ctx
  const load = () => loadWeek({ supabase, userId, origin: ctx.origin })
  const at = (date: string, time: string) => fromZonedTime(`${date}T${time.length === 5 ? time + ':00' : time}`, timeZone)

  const moveBlock = betaZodTool({
    name: 'move_block',
    description: 'Move a block (by id prefix or a distinctive part of its title) to a date and start time; optionally change its length. Locks it against re-planning.',
    inputSchema: z.object({
      block: z.string().describe('id prefix or part of the title'),
      date: z.string().describe('yyyy-MM-dd'),
      start_time: z.string().describe('HH:mm in the user\'s timezone'),
      duration_minutes: z.number().int().min(5).max(480).nullable(),
    }),
    run: async (input) => {
      const week = await load()
      const block = findBlock(week, input.block)
      if (!block) return `REJECTED: no block matches "${input.block}". Blocks this week: ${week.blocks.map((b) => `${b.id.slice(0, 8)} ${b.title.slice(0, 40)}`).join('; ')}`
      const minutes = input.duration_minutes ?? Math.round((new Date(block.ends_at).getTime() - new Date(block.starts_at).getTime()) / 60_000)
      const start = at(input.date, input.start_time)
      const end = new Date(start.getTime() + minutes * 60_000)
      const day = week.calendar?.find((d) => d.date === input.date)
      if (day) {
        const collidesEvent = day.events.find((e) => e.busy && e.start < end && e.end > start)
        if (collidesEvent) return `REJECTED: that slot collides with "${collidesEvent.title}" (${formatInTimeZone(collidesEvent.start, timeZone, 'H:mm')}–${formatInTimeZone(collidesEvent.end, timeZone, 'H:mm')}). Offer another slot.`
      }
      const collidesBlock = week.blocks.find((b) => b.id !== block.id && b.status === 'planned' && new Date(b.starts_at) < end && new Date(b.ends_at) > start)
      if (collidesBlock) return `REJECTED: that slot overlaps "${collidesBlock.title.slice(0, 50)}". Offer another slot.`
      const { error } = await supabase
        .from('plan_blocks')
        .update({ starts_at: start.toISOString(), ends_at: end.toISOString(), locked: true, source: 'agent' })
        .eq('id', block.id)
        .eq('user_id', userId)
      return error ? `ERROR: ${error.message}` : `Moved "${block.title.slice(0, 50)}" to ${input.date} ${input.start_time} for ${minutes} min.`
    },
  })

  const removeBlock = betaZodTool({
    name: 'remove_block',
    description: 'Remove a block from the week (by id prefix or part of its title).',
    inputSchema: z.object({ block: z.string() }),
    run: async (input) => {
      const week = await load()
      const block = findBlock(week, input.block)
      if (!block) return `REJECTED: no block matches "${input.block}".`
      const { error } = await supabase.from('plan_blocks').delete().eq('id', block.id).eq('user_id', userId)
      return error ? `ERROR: ${error.message}` : `Removed "${block.title.slice(0, 50)}".`
    },
  })

  const addBlock = betaZodTool({
    name: 'add_block',
    description: 'Add a one-off block on a date at a time. Use kind "chore" for errands, "goal" only when it advances a goal (then name the deliverable as a finished artifact).',
    inputSchema: z.object({
      date: z.string(),
      start_time: z.string(),
      duration_minutes: z.number().int().min(5).max(480),
      title: z.string(),
      kind: z.enum(['goal', 'flexible', 'fixed', 'habit', 'chore']),
    }),
    run: async (input) => {
      const start = at(input.date, input.start_time)
      const end = new Date(start.getTime() + input.duration_minutes * 60_000)
      const { data: plan } = await supabase
        .from('daily_plans')
        .upsert({ user_id: userId, plan_date: input.date, timezone: timeZone, origin: input.date === ctx.today ? 'daily' : 'week_draft', status: 'accepted' }, { onConflict: 'user_id,plan_date' })
        .select('id')
        .single()
      const { error } = await supabase.from('plan_blocks').insert({
        user_id: userId,
        plan_id: plan?.id,
        deliverable: input.title,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: 'planned',
        kind: input.kind,
        source: 'agent',
        locked: true,
      })
      return error ? `ERROR: ${error.message}` : `Added "${input.title}" on ${input.date} at ${input.start_time}.`
    },
  })

  const resolveBlock = betaZodTool({
    name: 'resolve_block',
    description: 'Mark a block done, partial, or skipped because the user said so.',
    inputSchema: z.object({ block: z.string(), status: z.enum(['done', 'partial', 'skipped']) }),
    run: async (input) => {
      const week = await load()
      const block = findBlock(week, input.block)
      if (!block) return `REJECTED: no block matches "${input.block}".`
      const now = new Date().toISOString()
      await Promise.all([
        supabase.from('plan_blocks').update({ status: input.status, resolved_by: 'user', resolved_at: now }).eq('id', block.id).eq('user_id', userId),
        supabase.from('resolution_corrections').insert({ user_id: userId, block_id: block.id, from_status: block.status, to_status: input.status, note: 'via calendar thread' }),
      ])
      return `"${block.title.slice(0, 50)}" → ${input.status}.`
    },
  })

  const addCommitment = betaZodTool({
    name: 'add_commitment',
    description: 'Record a recurring or dated obligation so the planner places it every week.',
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(['flexible', 'fixed', 'habit', 'chore']),
      days: z.array(DaySchema).describe('Day names, e.g. ["tue"]; "every weekday" is mon–fri. Empty for chores.'),
      duration_minutes: z.number().int().min(5).max(480),
      fixed_start: z.string().nullable(),
      fixed_end: z.string().nullable(),
      due_date: z.string().nullable(),
    }),
    run: async (input) => {
      if (input.kind === 'fixed' && (!input.fixed_start || !input.fixed_end)) return 'REJECTED: fixed needs fixed_start and fixed_end.'
      if (input.kind === 'chore' && !input.due_date) return 'REJECTED: chores need a due_date.'
      if (input.kind !== 'chore' && input.days.length === 0) return 'REJECTED: days required.'
      const { days, ...rest } = input
      const { error } = await supabase.from('commitments').insert({ user_id: userId, ...rest, days_of_week: dayNumbers(days) })
      return error ? `ERROR: ${error.message}` : `Recorded "${input.title}". Call replan_week to place it.`
    },
  })

  const removeCommitment = betaZodTool({
    name: 'remove_commitment',
    description: 'Stop a recurring commitment by title.',
    inputSchema: z.object({ title: z.string() }),
    run: async (input) => {
      const { data } = await supabase.from('commitments').select('id, title').eq('user_id', userId).eq('active', true).ilike('title', `%${input.title}%`)
      const rows = (data ?? []) as { id: string; title: string }[]
      if (rows.length === 0) return `No active commitment matches "${input.title}".`
      await supabase.from('commitments').update({ active: false }).in('id', rows.map((r) => r.id))
      await supabase.from('plan_blocks').delete().eq('user_id', userId).eq('status', 'planned').eq('locked', false).in('commitment_id', rows.map((r) => r.id))
      return `Stopped ${rows.map((r) => `"${r.title}"`).join(', ')} and cleared its unplanned blocks.`
    },
  })

  const replan = betaZodTool({
    name: 'replan_week',
    description: 'Re-plan the provisional part of this week from goals and commitments. Locked and resolved blocks stay.',
    inputSchema: z.object({}),
    run: async () => {
      const week = await replanWeek({ supabase, userId, origin: ctx.origin })
      const goal = week.blocks.filter((b) => b.kind === 'goal').length
      return `Week planned: ${week.blocks.length} blocks (${goal} goal).${week.notes.length ? ` Notes: ${week.notes.slice(0, 4).join('; ')}` : ''}`
    },
  })

  return [moveBlock, removeBlock, addBlock, resolveBlock, addCommitment, removeCommitment, replan]
}

export function weekStateBlock(week: WeekView, today: string): string {
  const tz = week.timeZone
  const clock = (iso: string | Date) => formatInTimeZone(new Date(iso), tz, 'H:mm')
  const days = (week.calendar ?? []).map((d) => ({
    date: d.date,
    weekday: formatInTimeZone(d.workWindow.start, tz, 'EEE'),
    work_window: `${clock(d.workWindow.start)}–${clock(d.workWindow.end)}`,
    events: d.events.filter((e) => e.busy).map((e) => `${clock(e.start)}–${clock(e.end)} ${e.title}`),
    free_gaps: d.gaps.map((g) => `${clock(g.start)}–${clock(g.end)}`),
    blocks: week.blocks
      .filter((b) => b.date === d.date)
      .map((b) => `${b.id.slice(0, 8)} ${clock(b.starts_at)}–${clock(b.ends_at)} [${b.kind}${b.locked ? ', locked' : ''}, ${b.status}] ${b.title}`),
  }))
  const state = {
    today,
    timezone: tz,
    week_start: week.weekStart,
    days,
    commitments: week.commitments.map((c) => ({ title: c.title, kind: c.kind, days_of_week: c.days_of_week, duration_minutes: c.duration_minutes, fixed: c.fixed_start ? `${c.fixed_start.slice(0, 5)}–${c.fixed_end?.slice(0, 5)}` : null, due_date: c.due_date })),
    goals: week.outcomes.map((o) => `${o.projectName ?? '—'} → ${o.title} (${o.status})`),
  }
  return `<state>\n${JSON.stringify(state, null, 1)}\n</state>`
}
