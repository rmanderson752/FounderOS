// src/app/api/jobs/daily/route.ts
//
// The one cron. Vercel calls it once a day (vercel.json) with the CRON_SECRET
// bearer. Everything else in the system is push-driven, so this is the only
// scheduled work:
//
//   every day   keep the free-tier database awake; close out yesterday's
//               blocks (resolve once more, then mark 'unobserved' — never
//               'skipped'); build the first-gap card and email it if enabled
//   Sunday      pick this week's rocks (1–3 milestones) and re-date the
//               ladders from observed pace
//   Saturday    roll the week up into one session_events row
//
// It acts per user through the service-role client, so every query filters
// by user_id.

import { NextRequest, NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/request'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildCard, weekStartOf } from '@/lib/card/build'
import { todayIn } from '@/lib/calendar/day'
import { resolveAffectedBlocks } from '@/lib/signals/ingest'
import { loadSignals } from '@/lib/goals/ladder'
import { scoreOutcomes } from '@/lib/planner/select'
import { observedPace } from '@/lib/planner/capacity'
import { pickRocks, rechainDates } from '@/lib/planner/rechain'
import type { PlannerMilestone, PlannerOutcome } from '@/lib/planner/types'
import { emailEnabled, sendCardEmail } from '@/lib/jobs/email'
import { replanWeek } from '@/lib/week/plan'
import type { Db } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface UserRow {
  id: string
  email: string
  timezone: string | null
}

async function closeOutStaleBlocks(supabase: Db, userId: string, now: Date) {
  const cutoff = new Date(now.getTime() - 60 * 60_000).toISOString()
  const { data } = await supabase
    .from('plan_blocks')
    .select('id, project_id, ends_at')
    .eq('user_id', userId)
    .eq('status', 'planned')
    .lt('ends_at', cutoff)
  const stale = (data ?? []) as { id: string; project_id: string | null; ends_at: string }[]
  if (stale.length === 0) return { resolved: 0, unobserved: 0 }

  // One last look for evidence that arrived after the block ended.
  const resolved = await resolveAffectedBlocks(
    supabase,
    userId,
    stale.map((b) => ({ projectId: b.project_id, occurredAt: new Date(b.ends_at) }))
  )
  const resolvedIds = new Set(resolved.map((r) => r.blockId))
  const remaining = stale.filter((b) => !resolvedIds.has(b.id)).map((b) => b.id)
  if (remaining.length > 0) {
    await supabase
      .from('plan_blocks')
      .update({ status: 'unobserved', resolved_by: 'cron', resolved_at: now.toISOString() })
      .in('id', remaining)
      .eq('user_id', userId)
      .eq('status', 'planned')
  }
  return { resolved: resolved.length, unobserved: remaining.length }
}

async function sundayPass(supabase: Db, userId: string, now: Date, today: string) {
  const [{ data: outcomeRows }, { data: projectRows }, signals] = await Promise.all([
    supabase.from('outcomes').select('id, title, project_id, weight, target_date, status').eq('user_id', userId).eq('status', 'active'),
    supabase.from('projects').select('id, name, paused').eq('user_id', userId),
    loadSignals(supabase, userId),
  ])
  const projects = (projectRows ?? []) as { id: string; name: string; paused: boolean }[]
  const outcomes: PlannerOutcome[] = ((outcomeRows ?? []) as Array<{ id: string; title: string; project_id: string | null; weight: number; target_date: string | null; status: PlannerOutcome['status'] }>)
    .filter((o) => !projects.find((p) => p.id === o.project_id)?.paused)
    .map((o) => ({
      id: o.id,
      title: o.title,
      projectId: o.project_id,
      projectName: projects.find((p) => p.id === o.project_id)?.name ?? null,
      weight: o.weight ?? 2,
      targetDate: o.target_date,
      status: o.status,
    }))
  if (outcomes.length === 0) return { rocks: 0, redated: 0 }

  const { data: milestoneRows } = await supabase
    .from('milestones')
    .select('id, outcome_id, title, estimated_minutes, position, status, focus_week, candidates')
    .eq('user_id', userId)
    .in('outcome_id', outcomes.map((o) => o.id))
  const milestones: PlannerMilestone[] = ((milestoneRows ?? []) as Array<{
    id: string; outcome_id: string; title: string; estimated_minutes: number; position: number
    status: PlannerMilestone['status']; focus_week: string | null; candidates: unknown
  }>).map((m) => ({
    id: m.id,
    outcomeId: m.outcome_id,
    title: m.title,
    estimatedMinutes: m.estimated_minutes,
    position: m.position,
    status: m.status,
    focusWeek: m.focus_week,
    candidates: Array.isArray(m.candidates) ? (m.candidates as PlannerMilestone['candidates']) : [],
  }))

  // The week being planned starts tomorrow (Monday).
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const nextMonday = weekStartOf(tomorrow.toISOString().slice(0, 10))
  const ranked = scoreOutcomes({ outcomes, milestones, signals, now, today })
  const rocks = pickRocks(ranked.map((r) => r.outcome.id), milestones, 3)

  // Clear last week's rocks, set this week's.
  await supabase.from('milestones').update({ focus_week: null }).eq('user_id', userId).not('focus_week', 'is', null)
  if (rocks.length > 0) {
    await supabase.from('milestones').update({ focus_week: nextMonday }).in('id', rocks).eq('user_id', userId)
  }

  // Re-date every open milestone from observed pace.
  const pace = observedPace({ signals, now })
  let redated = 0
  for (const outcome of outcomes) {
    const own = milestones.filter((m) => m.outcomeId === outcome.id)
    const dates = rechainDates({ milestones: own, paceMinutesPerWeek: outcome.projectId ? (pace[outcome.projectId] ?? 0) : 0, now })
    for (const d of dates) {
      await supabase.from('milestones').update({ expected_by: d.expectedBy }).eq('id', d.id).eq('user_id', userId)
      redated++
    }
  }
  return { rocks: rocks.length, redated }
}

async function saturdayRollup(supabase: Db, userId: string, today: string) {
  const weekStart = weekStartOf(today)
  const { data } = await supabase
    .from('session_events')
    .select('event, metadata')
    .eq('user_id', userId)
    .gte('event_date', weekStart)
    .lte('event_date', today)
  const events = (data ?? []) as { event: string; metadata: Record<string, unknown> }[]
  const count = (name: string) => events.filter((e) => e.event === name).length
  const rollup = {
    week_start: weekStart,
    cards_viewed: count('card_viewed'),
    cards_generated: count('card_generated'),
    blocks_observed_done: events.filter((e) => e.event === 'block_resolved' && e.metadata?.by === 'observed' && e.metadata?.status === 'done').length,
    blocks_corrected: events.filter((e) => e.event === 'block_resolved' && e.metadata?.by === 'user').length,
    goals_decomposed: count('goal_decomposed'),
  }
  await supabase.from('session_events').insert({ user_id: userId, event: 'week_rollup', event_date: today, metadata: rollup })
  return rollup
}

export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const now = new Date()
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  // Keep-alive: the reason a free-tier project does not pause during a quiet week.
  await supabase.from('users').select('id').limit(1)

  const { data: connections } = await supabase.from('calendar_connections').select('user_id, timezone')
  const report: Record<string, unknown>[] = []

  for (const c of (connections ?? []) as { user_id: string; timezone: string }[]) {
    const { data: user } = await supabase.from('users').select('id, email, timezone').eq('id', c.user_id).maybeSingle()
    if (!user) continue
    const u = user as UserRow
    const timeZone = u.timezone || c.timezone || 'America/New_York'
    const today = todayIn(timeZone, now)
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay()
    const entry: Record<string, unknown> = { user: u.id, today }

    try {
      entry.closed = await closeOutStaleBlocks(supabase, u.id, now)

      if (weekday === 0) {
        entry.sunday = await sundayPass(supabase, u.id, now, today)
        // Lay next week out from goals and commitments. Locked and resolved
        // blocks stay; everything provisional is re-planned.
        const tomorrow = new Date(`${today}T00:00:00Z`)
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        const week = await replanWeek({ supabase, userId: u.id, origin, weekStart: weekStartOf(tomorrow.toISOString().slice(0, 10)), now })
        entry.week = { blocks: week.blocks.length, notes: week.notes.slice(0, 5) }
      }
      if (weekday === 6) entry.saturday = await saturdayRollup(supabase, u.id, today)

      if (weekday >= 1 && weekday <= 5) {
        const result = await buildCard({ supabase, userId: u.id, origin, now })
        entry.card = result.status
        if (result.status === 'ok' && emailEnabled()) {
          const to = process.env.CARD_EMAIL_TO || u.email
          const sent = await sendCardEmail({
            to,
            subject: result.block.deliverable,
            text: `${result.text}\n\n${origin}/`,
          })
          entry.email = sent.ok ? 'sent' : `failed: ${sent.error}`
          await supabase.from('session_events').insert({
            user_id: u.id,
            event: 'card_emailed',
            event_date: today,
            metadata: { block_id: result.block.id, ok: sent.ok, error: sent.error ?? null },
          })
        }
      }
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error)
      console.error('Daily job failed for user', u.id, error)
    }
    report.push(entry)
  }

  return NextResponse.json({ ran_at: now.toISOString(), users: report })
}
