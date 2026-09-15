// src/components/settings/IntegrationsCard.tsx
//
// Inbound integrations. A CRM (HubSpot workflows, Attio automations,
// Pipedrive) or Zapier / Make / n8n posts a small JSON shape to a URL
// created here. Activities become signals — so blocks on that project
// resolve from logged calls and emails — and tasks or deals with dates
// become chores the planner places on the calendar.

'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Copy, Plug, Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

interface IntegrationRow {
  id: string
  kind: string
  name: string
  project_id: string | null
  active: boolean
  events_received: number
  last_event_at: string | null
}

const PRESETS = [
  { kind: 'hubspot', label: 'HubSpot' },
  { kind: 'attio', label: 'Attio' },
  { kind: 'pipedrive', label: 'Pipedrive' },
  { kind: 'notion', label: 'Notion' },
  { kind: 'zapier', label: 'Zapier / Make / n8n' },
  { kind: 'webhook', label: 'Any webhook' },
]

export function IntegrationsCard() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [kind, setKind] = useState('hubspot')
  const [minted, setMinted] = useState<{ url: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: async (): Promise<IntegrationRow[]> => {
      const res = await fetch('/api/integrations')
      return res.ok ? ((await res.json()) as { integrations: IntegrationRow[] }).integrations : []
    },
  })

  const createIntegration = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/integrations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name.trim() || PRESETS.find((p) => p.kind === kind)?.label, kind }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed')
      return body as { url: string; integration: IntegrationRow }
    },
    onSuccess: (body) => {
      setMinted({ url: body.url, name: body.integration.name })
      setName('')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
  })

  const toggle = useMutation({
    mutationFn: async (row: IntegrationRow) => {
      await fetch(`/api/integrations/${row.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active: !row.active }) })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/integrations/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
  })

  const copy = async () => {
    if (!minted) return
    try {
      await navigator.clipboard.writeText(minted.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // URL is visible below
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plug className="w-5 h-5 text-ink-3" />
          <CardTitle>Integrations</CardTitle>
        </div>
      </CardHeader>
      <div className="space-y-5">
        <p className="text-sm text-ink-3 leading-relaxed">
          Point your CRM&apos;s automations (or Zapier) at a URL. Logged calls and emails become signals so blocks resolve
          themselves; tasks and deals with dates become chores on the calendar. Each integration gets its own URL; the
          secret is in the URL and shown once.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.kind} type="button" onClick={() => setKind(p.kind)} className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', kind === p.kind ? 'border-ink text-ink' : 'border-line text-ink-3 hover:border-line-strong')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional), e.g. HubSpot — Sales" className="flex-1 bg-surface-3 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-4 outline-none border border-transparent focus:border-brand-300" />
          <Button variant="secondary" size="sm" onClick={() => createIntegration.mutate()} disabled={createIntegration.isPending}>
            <Plus className="w-4 h-4 mr-1.5" /> Create URL
          </Button>
        </div>

        {minted && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-700">Shown once — paste it into {minted.name}:</p>
            <pre className="bg-ink text-[#EDEBE6] rounded-2xl p-3 text-[12px] font-mono whitespace-pre-wrap break-all">{minted.url}</pre>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={copy}><Copy className="w-4 h-4 mr-2" /> {copied ? 'Copied' : 'Copy URL'}</Button>
              <span className="text-xs text-ink-4">POST JSON: {'{'}&quot;type&quot;: &quot;activity&quot; | &quot;task&quot; | &quot;deal&quot;, &quot;title&quot;, &quot;due_date&quot; / &quot;close_date&quot;, &quot;occurred_at&quot;, &quot;project&quot;, &quot;external_id&quot;{'}'}</span>
            </div>
          </div>
        )}

        {data && data.length > 0 && (
          <ul className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
            {data.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className={cn('w-2 h-2 rounded-full', row.active ? 'bg-emerald-500' : 'bg-ink-5')} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink truncate">{row.name} <span className="font-normal text-ink-4">· {row.kind}</span></p>
                  <p className="text-xs text-ink-4">
                    {row.events_received} event{row.events_received === 1 ? '' : 's'}
                    {row.last_event_at ? ` · last ${formatDistanceToNow(new Date(row.last_event_at), { addSuffix: true })}` : ' · nothing received yet'}
                  </p>
                </div>
                <button type="button" onClick={() => toggle.mutate(row)} className="text-xs font-semibold text-ink-3 hover:text-ink">{row.active ? 'Pause' : 'Resume'}</button>
                <button type="button" onClick={() => del.mutate(row.id)} className="text-ink-4 hover:text-rose-600" aria-label="Delete integration"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
