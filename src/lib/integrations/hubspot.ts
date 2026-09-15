// src/lib/integrations/hubspot.ts
//
// Native HubSpot connector. OAuth once; then a sync that reads what HubSpot
// knows and feeds it through the same mapping the webhook uses:
//
//   tasks (open)             → chores due on hs_timestamp; completed → retired
//   deals (open, with date)  → "Close: <deal>" chores due on closedate
//   calls / emails / meetings / notes (recent) → signals, so sales blocks
//                              resolve from logged activity
//
// Tokens are AES-256-GCM encrypted at rest (the calendar's crypto), stored in
// the integration's config. Access tokens live 30 minutes; refresh happens
// on demand and rotated refresh tokens are persisted.
//
// Endpoints and scopes per HubSpot's docs (Sept 2026): authorize at
// app.hubspot.com/oauth/authorize, token at api.hubapi.com/oauth/v1/token;
// engagements (tasks, calls, emails, meetings, notes) read under
// crm.objects.contacts.read, deals under crm.objects.deals.read.

import { formatInTimeZone } from 'date-fns-tz'
import type { Db } from '@/lib/supabase/types'
import { decryptToken, encryptToken } from '@/lib/calendar/crypto'
import { processWebhook, type WebhookItem, type WebhookReport } from './webhook'

export const HUBSPOT_SCOPES = ['crm.objects.contacts.read', 'crm.objects.deals.read', 'crm.objects.companies.read']
const AUTHORIZE_URL = 'https://app.hubspot.com/oauth/authorize'
const TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'
const API = 'https://api.hubapi.com'
const REFRESH_MARGIN_MS = 2 * 60_000
const FIRST_SYNC_DAYS = 14

export interface HubspotConfig {
  access_token_enc: string
  refresh_token_enc: string
  expires_at: string
  hub_id?: number | null
  hub_domain?: string | null
  last_sync_at?: string | null
  last_report?: WebhookReport | null
}

export interface HubspotIntegration {
  id: string
  user_id: string
  name: string
  project_id: string | null
  config: HubspotConfig
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

export function hubspotConfigured(): boolean {
  return !!process.env.HUBSPOT_CLIENT_ID && !!process.env.HUBSPOT_CLIENT_SECRET
}

export function redirectUri(origin: string): string {
  return process.env.HUBSPOT_REDIRECT_URI || `${origin}/api/integrations/hubspot/callback`
}

export function authorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('HUBSPOT_CLIENT_ID'),
    redirect_uri: redirectUri(origin),
    scope: HUBSPOT_SCOPES.join(' '),
    state,
  })
  return `${AUTHORIZE_URL}?${params}`
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { message?: string }
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(`HubSpot token request failed: ${res.status} ${json.message ?? ''}`.trim())
  }
  return json as TokenResponse
}

export async function exchangeCode(origin: string, code: string): Promise<HubspotConfig> {
  const t = await tokenRequest({
    grant_type: 'authorization_code',
    client_id: requireEnv('HUBSPOT_CLIENT_ID'),
    client_secret: requireEnv('HUBSPOT_CLIENT_SECRET'),
    redirect_uri: redirectUri(origin),
    code,
  })
  const config: HubspotConfig = {
    access_token_enc: encryptToken(t.access_token),
    refresh_token_enc: encryptToken(t.refresh_token),
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
  }
  // Who did we connect to? Cheap and useful for the settings card.
  try {
    const info = (await (await fetch(`${API}/oauth/v1/access-tokens/${t.access_token}`, { cache: 'no-store' })).json()) as { hub_id?: number; hub_domain?: string }
    config.hub_id = info.hub_id ?? null
    config.hub_domain = info.hub_domain ?? null
  } catch {
    // not fatal
  }
  return config
}

async function freshAccessToken(supabase: Db, integration: HubspotIntegration): Promise<string> {
  const cfg = integration.config
  if (new Date(cfg.expires_at).getTime() - REFRESH_MARGIN_MS > Date.now()) return decryptToken(cfg.access_token_enc)

  const t = await tokenRequest({
    grant_type: 'refresh_token',
    client_id: requireEnv('HUBSPOT_CLIENT_ID'),
    client_secret: requireEnv('HUBSPOT_CLIENT_SECRET'),
    refresh_token: decryptToken(cfg.refresh_token_enc),
  })
  const next: HubspotConfig = {
    ...cfg,
    access_token_enc: encryptToken(t.access_token),
    refresh_token_enc: encryptToken(t.refresh_token),
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
  }
  integration.config = next
  await supabase.from('integrations').update({ config: next }).eq('id', integration.id).eq('user_id', integration.user_id)
  return t.access_token
}

async function hs<T>(supabase: Db, integration: HubspotIntegration, path: string, init?: RequestInit): Promise<T> {
  const token = await freshAccessToken(supabase, integration)
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HubSpot ${path} → ${res.status} ${text.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

interface HsObject {
  id: string
  properties: Record<string, string | null>
}
interface HsList {
  results: HsObject[]
  paging?: { next?: { after: string } }
}

async function listAll(supabase: Db, integration: HubspotIntegration, object: string, properties: string[], maxPages = 3): Promise<HsObject[]> {
  const out: HsObject[] = []
  let after: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ limit: '100', properties: properties.join(',') })
    if (after) params.set('after', after)
    const data = await hs<HsList>(supabase, integration, `/crm/v3/objects/${object}?${params}`)
    out.push(...data.results)
    after = data.paging?.next?.after
    if (!after) break
  }
  return out
}

async function searchSince(supabase: Db, integration: HubspotIntegration, object: string, properties: string[], since: Date): Promise<HsObject[]> {
  const data = await hs<HsList>(supabase, integration, `/crm/v3/objects/${object}/search`, {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'hs_timestamp', operator: 'GTE', value: String(since.getTime()) }] }],
      sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
      properties,
      limit: 100,
    }),
  })
  return data.results
}

function dateOf(value: string | null | undefined, timeZone: string): string | null {
  if (!value) return null
  const ms = /^\d+$/.test(value) ? Number(value) : Date.parse(value)
  if (Number.isNaN(ms)) return null
  return formatInTimeZone(new Date(ms), timeZone, 'yyyy-MM-dd')
}

function isoOf(value: string | null | undefined): string | null {
  if (!value) return null
  const ms = /^\d+$/.test(value) ? Number(value) : Date.parse(value)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

function strip(html: string | null | undefined, max = 160): string {
  return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export interface SyncResult extends WebhookReport {
  tasks: number
  deals: number
  activities: number
  errors: string[]
}

/** Pull tasks, deals and recent activity; map through the webhook contract. */
export async function syncHubspot(supabase: Db, integration: HubspotIntegration, timeZone: string): Promise<SyncResult> {
  const items: WebhookItem[] = []
  const errors: string[] = []
  const counts = { tasks: 0, deals: 0, activities: 0 }
  const since = integration.config.last_sync_at
    ? new Date(new Date(integration.config.last_sync_at).getTime() - 2 * 86_400_000)
    : new Date(Date.now() - FIRST_SYNC_DAYS * 86_400_000)

  try {
    const tasks = await listAll(supabase, integration, 'tasks', ['hs_task_subject', 'hs_timestamp', 'hs_task_status', 'hs_task_priority', 'hs_task_type', 'hs_body_preview'])
    for (const t of tasks) {
      const due = dateOf(t.properties.hs_timestamp, timeZone)
      const title = t.properties.hs_task_subject?.trim()
      if (!due || !title) continue
      items.push({
        type: 'task',
        title,
        due_date: due,
        duration_minutes: t.properties.hs_task_type === 'CALL' ? 30 : 45,
        external_id: `task:${t.id}`,
        done: t.properties.hs_task_status === 'COMPLETED',
        notes: strip(t.properties.hs_body_preview),
      })
      counts.tasks++
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'tasks failed')
  }

  try {
    const deals = await listAll(supabase, integration, 'deals', ['dealname', 'closedate', 'dealstage', 'amount', 'hs_is_closed'])
    for (const d of deals) {
      const close = dateOf(d.properties.closedate, timeZone)
      const title = d.properties.dealname?.trim()
      if (!close || !title) continue
      items.push({
        type: 'deal',
        title,
        close_date: close,
        stage: d.properties.dealstage ?? undefined,
        amount: d.properties.amount ? Number(d.properties.amount) : undefined,
        external_id: `deal:${d.id}`,
        done: d.properties.hs_is_closed === 'true',
      })
      counts.deals++
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'deals failed')
  }

  const activityKinds: Array<{ object: string; props: string[]; title: (p: Record<string, string | null>) => string; kind: string }> = [
    { object: 'calls', props: ['hs_timestamp', 'hs_call_title', 'hs_call_body', 'hs_call_direction'], title: (p) => p.hs_call_title?.trim() || 'Call', kind: 'call' },
    { object: 'emails', props: ['hs_timestamp', 'hs_email_subject', 'hs_email_direction'], title: (p) => p.hs_email_subject?.trim() || 'Email', kind: 'email' },
    { object: 'meetings', props: ['hs_timestamp', 'hs_meeting_title', 'hs_meeting_body'], title: (p) => p.hs_meeting_title?.trim() || 'Meeting', kind: 'meeting' },
    { object: 'notes', props: ['hs_timestamp', 'hs_note_body'], title: (p) => strip(p.hs_note_body, 80) || 'Note', kind: 'note' },
  ]
  for (const a of activityKinds) {
    try {
      const rows = await searchSince(supabase, integration, a.object, a.props, since)
      for (const r of rows) {
        const at = isoOf(r.properties.hs_timestamp)
        if (!at) continue
        items.push({ type: 'activity', kind: `hubspot_${a.kind}`, title: a.title(r.properties), occurred_at: at, external_id: `${a.object}:${r.id}` })
        counts.activities++
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `${a.object} failed`)
    }
  }

  const report = await processWebhook(supabase, integration.user_id, integration, items)
  const config: HubspotConfig = { ...integration.config, last_sync_at: new Date().toISOString(), last_report: report }
  await supabase.from('integrations').update({ config }).eq('id', integration.id).eq('user_id', integration.user_id)

  return { ...report, ...counts, errors }
}

export async function loadHubspotIntegrations(supabase: Db, userId: string): Promise<HubspotIntegration[]> {
  const { data } = await supabase
    .from('integrations')
    .select('id, user_id, name, project_id, config, active')
    .eq('user_id', userId)
    .eq('kind', 'hubspot')
    .eq('active', true)
  return ((data ?? []) as Array<HubspotIntegration & { active: boolean }>).filter((i) => i.config?.access_token_enc)
}
