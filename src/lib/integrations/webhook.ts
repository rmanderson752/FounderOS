// src/lib/integrations/webhook.ts
//
// The inbound contract every CRM can meet through its own automation
// (HubSpot workflows, Attio automations, Pipedrive) or through Zapier /
// Make / n8n. One JSON object, or an array of them:
//
//   activity  { type: "activity", title, occurred_at?, project?, external_id?, notes? }
//             → a signal (source 'crm'); blocks on that project resolve from it
//   task      { type: "task", title, due_date, duration_minutes?, project?, external_id?, done? }
//             → a chore the planner places before due_date; the same
//               external_id updates rather than duplicates; done: true retires it
//   deal      { type: "deal", title, close_date, stage?, amount?, external_id? }
//             → a chore "Close: <title>" due close_date, idempotent on external_id
//
// Unknown keys are kept in metadata. Anything that fails validation is
// reported per item; the rest still lands.

import type { Db } from '@/lib/supabase/types'
import { ingestSignals } from '@/lib/signals/ingest'

export interface WebhookItem {
  type?: string
  title?: string
  occurred_at?: string
  due_date?: string
  close_date?: string
  duration_minutes?: number
  project?: string
  external_id?: string
  notes?: string
  stage?: string
  amount?: number
  done?: boolean
  [key: string]: unknown
}

export interface WebhookReport {
  accepted: number
  rejected: Array<{ index: number; reason: string }>
  signals: number
  chores: number
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function toItems(body: unknown): WebhookItem[] {
  if (Array.isArray(body)) return body as WebhookItem[]
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    // Zapier-style wrapper
    if (Array.isArray(b.items)) return b.items as WebhookItem[]
    return [b as WebhookItem]
  }
  return []
}

export async function processWebhook(
  supabase: Db,
  userId: string,
  integration: { id: string; project_id: string | null; name: string },
  body: unknown
): Promise<WebhookReport> {
  const items = toItems(body)
  const report: WebhookReport = { accepted: 0, rejected: [], signals: 0, chores: 0 }
  const now = new Date().toISOString()

  const { data: projectRows } = await supabase.from('projects').select('id, name').eq('user_id', userId)
  const projects = (projectRows ?? []) as { id: string; name: string }[]
  const projectFor = (item: WebhookItem) =>
    (item.project ? projects.find((p) => p.name.toLowerCase() === String(item.project).toLowerCase())?.id : null) ?? integration.project_id

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (!title) {
      report.rejected.push({ index: i, reason: 'title is required' })
      continue
    }
    const type = String(item.type ?? 'activity').toLowerCase()

    if (type === 'activity') {
      const occurred = item.occurred_at && !Number.isNaN(Date.parse(String(item.occurred_at))) ? String(item.occurred_at) : now
      await ingestSignals(supabase, userId, [
        {
          source: 'crm',
          kind: String(item.kind ?? 'crm_activity').slice(0, 40),
          summary: title + (item.notes ? ` — ${String(item.notes).slice(0, 200)}` : ''),
          occurred_at: occurred,
          external_id: item.external_id ? `crm:${integration.id}:${item.external_id}` : null,
          project: projects.find((p) => p.id === projectFor(item))?.name ?? null,
          integration_id: integration.id,
          metadata: { integration: integration.name, stage: item.stage ?? null, amount: item.amount ?? null },
        },
      ])
      report.signals++
      report.accepted++
      continue
    }

    if (type === 'task' || type === 'deal') {
      const due = type === 'deal' ? item.close_date : item.due_date
      if (!due || !DATE.test(String(due))) {
        report.rejected.push({ index: i, reason: `${type} needs ${type === 'deal' ? 'close_date' : 'due_date'} as yyyy-MM-dd` })
        continue
      }
      const choreTitle = type === 'deal' ? `Close: ${title}` : title
      const externalId = item.external_id ? String(item.external_id) : null
      const row = {
        user_id: userId,
        project_id: projectFor(item),
        title: choreTitle,
        kind: 'chore',
        days_of_week: [] as number[],
        duration_minutes: Math.min(480, Math.max(15, Number(item.duration_minutes) || 45)),
        due_date: String(due),
        active: item.done !== true,
        notes: item.notes ? String(item.notes).slice(0, 500) : item.stage ? `stage: ${item.stage}` : null,
        integration_id: integration.id,
        external_id: externalId,
      }
      if (externalId) {
        const { data: existing } = await supabase
          .from('commitments')
          .select('id')
          .eq('user_id', userId)
          .eq('integration_id', integration.id)
          .eq('external_id', externalId)
          .maybeSingle()
        if (existing) {
          await supabase.from('commitments').update(row).eq('id', existing.id)
          if (item.done === true) {
            await supabase.from('plan_blocks').delete().eq('user_id', userId).eq('commitment_id', existing.id).eq('status', 'planned').eq('locked', false)
          }
          report.chores++
          report.accepted++
          continue
        }
      }
      if (item.done === true) {
        report.accepted++
        continue
      }
      const { error } = await supabase.from('commitments').insert(row)
      if (error) {
        report.rejected.push({ index: i, reason: error.message })
        continue
      }
      report.chores++
      report.accepted++
      continue
    }

    report.rejected.push({ index: i, reason: `unknown type "${type}" (activity, task, deal)` })
  }

  await supabase
    .from('integrations')
    .update({ events_received: (await currentCount(supabase, integration.id)) + report.accepted, last_event_at: now })
    .eq('id', integration.id)

  return report
}

async function currentCount(supabase: Db, id: string): Promise<number> {
  const { data } = await supabase.from('integrations').select('events_received').eq('id', id).maybeSingle()
  return (data?.events_received as number | undefined) ?? 0
}
