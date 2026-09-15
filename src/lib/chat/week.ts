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
import { upsertCommitment } from '@/lib/week/commitments'
import { loadDayTemplate, startRun } from '@/lib/chains'

export const WEEK_SYSTEM_PROMPT = `You adjust a solo founder's week. Their day is chains, not slots: Rise (after waking, habit links), Work (a ceiling, the only chain the planner fills with goal work), Live (protected — nothing is ever planned into it), Wind down (before bed). A chain is ordered links with durations; only its anchor is on the clock, every later link's time is derived, and finishing a link lights the next. You receive the day template (chains and links), today's runs and where they stand, each day's events, and the planned blocks with ids and times.

Do what they ask with the tools, then confirm in one short sentence. Times are in the founder's timezone. Rules:
- "My morning is gym, shower, then coffee" / "add stretching after gym" / "drop LeetCode" → edit the chain's links (set_chain_links, add_link, remove_link), then replan_week so the calendar reflects it.
- "Work is 6 hours" / "Rise starts at 6:30" / "bed at 11" → update_chain, then replan_week.
- "I'm up" / "starting work now" → start_chain for today's run of that chain.
- Move, resize, add or remove blocks only as asked; never rearrange the rest of the week on your own. A moved block is locked.
- If a requested slot collides with an event or another block, say so and offer the nearest free slot.
- Something recurring that is not part of a chain ("outreach 90 min on Tuesdays") → add_commitment, then replan_week; the planner places it in Work.
- Never add anything to Live unless the user names Live explicitly.
- Marking work done or skipped → resolve_block.
- Under 60 words. No lists unless they ask what is on a day.`

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
    description: 'Record or change a recurring or dated obligation so the planner places it every week. Same title = update the existing one ("gym now runs four days" changes the gym, it does not add a second). Then call replan_week.',
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(['flexible', 'fixed', 'habit', 'chore']),
      days: DaysInput,
      duration_minutes: z.number().int().min(5).max(480),
      fixed_start: z.string().nullable(),
      fixed_end: z.string().nullable(),
      due_date: z.string().nullable(),
    }),
    run: async (input) => {
      if (input.kind === 'fixed' && (!input.fixed_start || !input.fixed_end)) return 'REJECTED: fixed needs fixed_start and fixed_end.'
      if (input.kind === 'chore' && !input.due_date) return 'REJECTED: chores need a due_date.'
      const days = toDayNumbers(input.days)
      if (input.kind !== 'chore' && days.length === 0) return 'REJECTED: days required.'
      const result = await upsertCommitment(supabase, userId, {
        title: input.title,
        kind: input.kind,
        days_of_week: days,
        duration_minutes: input.duration_minutes,
        fixed_start: input.fixed_start,
        fixed_end: input.fixed_end,
        due_date: input.due_date,
      })
      if ('error' in result) return `ERROR: ${result.error}`
      return `${result.action === 'updated' ? 'Updated' : 'Recorded'} "${input.title}". Call replan_week to place it.`
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

  // ---- chains -----------------------------------------------------------------
  const LinkInput = z.object({
    title: z.string(),
    kind: z.enum(['habit', 'fixed', 'flexible', 'goal', 'chore', 'free']).describe('goal = a deep-work slot the planner fills; free = unplanned time'),
    minutes: z.number().int().min(5).max(480),
  })
  const findChain = async (ref: string) => {
    const t = await loadDayTemplate(supabase, userId)
    const r = ref.trim().toLowerCase()
    return { template: t, chain: t.chains.find((c) => c.role === r || c.name.toLowerCase() === r) ?? t.chains.find((c) => c.name.toLowerCase().includes(r)) ?? null }
  }

  const setChainLinks = betaZodTool({
    name: 'set_chain_links',
    description: 'Replace all links of a chain with an ordered list ("my morning is gym, shower, then coffee and LeetCode"). Chain is referenced by role (rise, work, live, winddown) or name.',
    inputSchema: z.object({ chain: z.string(), links: z.array(LinkInput).min(0).max(20) }),
    run: async (input) => {
      const { chain } = await findChain(input.chain)
      if (!chain) return `REJECTED: no chain "${input.chain}".`
      await supabase.from('chain_links').delete().eq('user_id', userId).eq('chain_id', chain.id)
      if (input.links.length > 0) {
        const { error } = await supabase.from('chain_links').insert(input.links.map((l, i) => ({ user_id: userId, chain_id: chain.id, position: i, title: l.title, kind: l.kind, duration_minutes: l.minutes })))
        if (error) return `ERROR: ${error.message}`
      }
      return `${chain.name} is now: ${input.links.map((l) => `${l.title} (${l.minutes}m)`).join(' → ') || 'empty'}. Call replan_week.`
    },
  })

  const addLink = betaZodTool({
    name: 'add_link',
    description: 'Insert a link into a chain, after a named link or at the end.',
    inputSchema: z.object({ chain: z.string(), link: LinkInput, after: z.string().nullable().describe('title of the link to insert after; null = end') }),
    run: async (input) => {
      const { template, chain } = await findChain(input.chain)
      if (!chain) return `REJECTED: no chain "${input.chain}".`
      const links = template.links.filter((l) => l.chainId === chain.id).sort((a, b) => a.position - b.position)
      let at = links.length
      if (input.after) {
        const idx = links.findIndex((l) => l.title.toLowerCase().includes(input.after!.toLowerCase()))
        if (idx >= 0) at = idx + 1
      }
      await Promise.all(links.slice(at).map((l) => supabase.from('chain_links').update({ position: l.position + 1 }).eq('id', l.id)))
      const { error } = await supabase.from('chain_links').insert({ user_id: userId, chain_id: chain.id, position: at, title: input.link.title, kind: input.link.kind, duration_minutes: input.link.minutes })
      return error ? `ERROR: ${error.message}` : `Added "${input.link.title}" to ${chain.name} at position ${at + 1}. Call replan_week.`
    },
  })

  const removeLink = betaZodTool({
    name: 'remove_link',
    description: 'Remove a link from a chain by title.',
    inputSchema: z.object({ chain: z.string(), title: z.string() }),
    run: async (input) => {
      const { template, chain } = await findChain(input.chain)
      if (!chain) return `REJECTED: no chain "${input.chain}".`
      const target = template.links.find((l) => l.chainId === chain.id && l.title.toLowerCase().includes(input.title.toLowerCase()))
      if (!target) return `REJECTED: no link matching "${input.title}" in ${chain.name}.`
      await supabase.from('chain_links').delete().eq('id', target.id).eq('user_id', userId)
      const rest = template.links.filter((l) => l.chainId === chain.id && l.id !== target.id).sort((a, b) => a.position - b.position)
      await Promise.all(rest.map((l, i) => supabase.from('chain_links').update({ position: i }).eq('id', l.id)))
      return `Removed "${target.title}" from ${chain.name}. Call replan_week.`
    },
  })

  const updateChain = betaZodTool({
    name: 'update_chain',
    description: "Change a chain's anchor time (HH:mm), anchor kind, ceiling in minutes, or days.",
    inputSchema: z.object({
      chain: z.string(),
      anchor_time: z.string().nullable(),
      anchor_kind: z.enum(['trigger', 'after_previous', 'clock', 'before_bed']).nullable(),
      target_minutes: z.number().int().min(15).max(960).nullable(),
      days: DaysInput.nullable(),
    }),
    run: async (input) => {
      const { chain } = await findChain(input.chain)
      if (!chain) return `REJECTED: no chain "${input.chain}".`
      const patch: Record<string, unknown> = {}
      if (input.anchor_time) patch.anchor_time = input.anchor_time
      if (input.anchor_kind) patch.anchor_kind = input.anchor_kind
      if (input.target_minutes !== null) patch.target_minutes = input.target_minutes
      if (input.days) patch.days_of_week = toDayNumbers(input.days)
      if (Object.keys(patch).length === 0) return 'Nothing to change.'
      const { error } = await supabase.from('chains').update(patch).eq('id', chain.id).eq('user_id', userId)
      return error ? `ERROR: ${error.message}` : `${chain.name} updated. Call replan_week.`
    },
  })

  const startChain = betaZodTool({
    name: 'start_chain',
    description: "Start today's run of a chain now (\"I'm up\", \"starting work\"). Its remaining links are re-laid from this moment.",
    inputSchema: z.object({ chain: z.string() }),
    run: async (input) => {
      const { chain } = await findChain(input.chain)
      if (!chain) return `REJECTED: no chain "${input.chain}".`
      const { data: run } = await supabase.from('chain_runs').select('id, started_at').eq('user_id', userId).eq('chain_id', chain.id).eq('run_date', ctx.today).maybeSingle()
      if (!run) return `REJECTED: ${chain.name} has no run today (it may not run on this weekday, or the week is not planned yet — call replan_week first).`
      if (run.started_at) return `${chain.name} already started.`
      await startRun(supabase, userId, run.id)
      await replanWeek({ supabase, userId, origin: ctx.origin })
      return `${chain.name} started now; the rest of the chain shifted to follow.`
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

  return [moveBlock, removeBlock, addBlock, resolveBlock, addCommitment, removeCommitment, setChainLinks, addLink, removeLink, updateChain, startChain, replan]
}

export function weekStateBlock(week: WeekView, today: string, template?: { links: Array<{ chainId: string; title: string; kind: string; durationMinutes: number; position: number }> }): string {
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
    chains: week.chains.map((c) => ({
      name: c.name,
      role: c.role,
      anchor: c.anchor_kind === 'before_bed' ? `ends at ${c.anchor_time ?? 'bedtime'}` : `${c.anchor_kind}${c.anchor_time ? ` ${c.anchor_time}` : ''}`,
      ceiling_minutes: c.target_minutes,
      days_of_week: c.days_of_week,
      plannable: c.plannable,
      protected: c.protected,
      links: (template?.links ?? []).filter((l) => l.chainId === c.id).sort((a, b) => a.position - b.position).map((l) => `${l.title} [${l.kind}, ${l.durationMinutes}m]`),
    })),
    today_runs: week.runs.filter((r) => r.date === today).map((r) => ({ chain: r.name, status: r.status, started: !!r.started_at, anchor: clock(r.anchor_at), ends: clock(r.end_at), next_link_position: r.current_position + 1 })),
    days,
    commitments: week.commitments.map((c) => ({ title: c.title, kind: c.kind, days_of_week: c.days_of_week, duration_minutes: c.duration_minutes, fixed: c.fixed_start ? `${c.fixed_start.slice(0, 5)}–${c.fixed_end?.slice(0, 5)}` : null, due_date: c.due_date })),
    goals: week.outcomes.map((o) => `${o.projectName ?? '—'} → ${o.title} (${o.status})`),
  }
  return `<state>\n${JSON.stringify(state, null, 1)}\n</state>`
}
