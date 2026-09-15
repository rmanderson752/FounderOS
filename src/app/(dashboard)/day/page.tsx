// src/app/(dashboard)/day/page.tsx
//
// Your day as chains. Rise → Work → Live → Wind down by default; each is
// ordered links with durations, and only the anchor is on the clock. Edit
// links inline, reorder them, change anchors and ceilings. The planner fills
// the goal slots in Work; Live is protected.

'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Lock, Plus, Trash2, Wand2, Loader2 } from 'lucide-react'
import { PageTransition, Skeleton } from '@/components/ui'
import { usePlanWeek } from '@/hooks/useWeek'
import { cn } from '@/lib/utils'
import type { DayTemplate } from '@/lib/chains'

const ROLE_TONE: Record<string, string> = {
  rise: 'bg-amber-50 border-amber-200',
  work: 'bg-brand-50 border-brand-200',
  live: 'bg-emerald-50 border-emerald-200',
  winddown: 'bg-indigo-50 border-indigo-200',
  custom: 'bg-surface-2 border-line',
}
const ANCHOR_LABEL: Record<string, string> = {
  trigger: 'when I start it (fallback at)',
  after_previous: 'after the previous chain (fallback at)',
  clock: 'at',
  before_bed: 'ending at bedtime',
}
const KINDS = ['habit', 'fixed', 'flexible', 'goal', 'chore', 'free'] as const
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function minutesLabel(m: number): string {
  return m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}`
}

export default function DayPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['day-template'],
    queryFn: async (): Promise<DayTemplate> => {
      const res = await fetch('/api/chains')
      if (!res.ok) throw new Error('Failed to load your day')
      return res.json()
    },
  })
  const plan = usePlanWeek(null)
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['day-template'] })
    queryClient.invalidateQueries({ queryKey: ['week'] })
    queryClient.invalidateQueries({ queryKey: ['card'] })
  }
  const patchChain = useMutation({
    mutationFn: async (input: { id: string } & Record<string, unknown>) => {
      const { id, ...patch } = input
      await fetch(`/api/chains/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    },
    onSuccess: invalidate,
  })
  const addLink = useMutation({
    mutationFn: async (input: { chainId: string; title: string; kind: string; duration_minutes: number }) => {
      const { chainId, ...body } = input
      await fetch(`/api/chains/${chainId}/links`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    },
    onSuccess: invalidate,
  })
  const patchLink = useMutation({
    mutationFn: async (input: { id: string } & Record<string, unknown>) => {
      const { id, ...patch } = input
      await fetch(`/api/chains/links/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    },
    onSuccess: invalidate,
  })
  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/chains/links/${id}`, { method: 'DELETE' })
    },
    onSuccess: invalidate,
  })

  const [drafts, setDrafts] = useState<Record<string, { title: string; kind: string; minutes: number }>>({})
  const draftFor = (chainId: string) => drafts[chainId] ?? { title: '', kind: 'habit', minutes: 30 }

  return (
    <PageTransition>
      <div className="max-w-3xl">
        <div className="flex items-end justify-between gap-4 mb-2">
          <div>
            <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">Your day</p>
            <h1 className="text-3xl font-bold text-ink tracking-tight">Chains, not slots.</h1>
          </div>
          <button type="button" onClick={() => plan.mutate()} disabled={plan.isPending} className="inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50">
            {plan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" strokeWidth={2} />} Re-plan week
          </button>
        </div>
        <p className="text-[15px] text-ink-3 leading-relaxed mb-8 max-w-xl">
          Only the anchor is on the clock. Every link&apos;s time is derived from the one before it, so a late start shifts the
          chain instead of missing it. Finishing a link lights the next one. The planner fills the <span className="font-semibold text-ink-2">goal</span> slots in Work from your ladders; Live is protected.
        </p>

        {isLoading && <Skeleton className="h-[400px] w-full rounded-3xl" />}

        <div className="space-y-4">
          {data?.chains.map((chain) => {
            const links = data.links.filter((l) => l.chainId === chain.id).sort((a, b) => a.position - b.position)
            const total = links.reduce((s, l) => s + l.durationMinutes, 0)
            const draft = draftFor(chain.id)
            return (
              <section key={chain.id} className={cn('rounded-3xl border p-5', ROLE_TONE[chain.role] ?? ROLE_TONE.custom)}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <input
                    defaultValue={chain.name}
                    onBlur={(e) => e.target.value.trim() !== chain.name && patchChain.mutate({ id: chain.id, name: e.target.value })}
                    className="bg-transparent text-[18px] font-bold text-ink outline-none border-b border-transparent focus:border-ink/30 min-w-[120px]"
                    aria-label="Chain name"
                  />
                  <span className="text-xs text-ink-3">{ANCHOR_LABEL[chain.anchorKind]}</span>
                  <input
                    type="time"
                    defaultValue={chain.anchorTime ?? (chain.anchorKind === 'before_bed' ? (data.bedTime ?? '22:30') : (data.wakeTime ?? '07:00'))}
                    onBlur={(e) => patchChain.mutate({ id: chain.id, anchor_time: e.target.value || null })}
                    className="bg-white/70 rounded-lg px-2 py-1 text-xs text-ink"
                    aria-label="Anchor time"
                  />
                  <select value={chain.anchorKind} onChange={(e) => patchChain.mutate({ id: chain.id, anchor_kind: e.target.value })} className="bg-white/70 rounded-lg px-2 py-1 text-xs text-ink" aria-label="Anchor kind">
                    <option value="trigger">trigger</option>
                    <option value="after_previous">after previous</option>
                    <option value="clock">clock</option>
                    <option value="before_bed">before bed</option>
                  </select>
                  <span className="flex-1" />
                  <label className="text-xs text-ink-3 inline-flex items-center gap-1.5">
                    ceiling
                    <input
                      type="number"
                      min={15}
                      step={15}
                      defaultValue={chain.targetMinutes ?? ''}
                      placeholder="—"
                      onBlur={(e) => patchChain.mutate({ id: chain.id, target_minutes: e.target.value ? Number(e.target.value) : null })}
                      className="w-16 bg-white/70 rounded-lg px-2 py-1 text-xs text-ink"
                    />
                    min
                  </label>
                  {chain.protected && <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800"><Lock className="w-3 h-3" /> protected</span>}
                </div>

                <div className="mt-2 flex gap-1">
                  {DAYS.map((d, i) => {
                    const on = chain.daysOfWeek.includes(i)
                    return (
                      <button key={i} type="button" onClick={() => patchChain.mutate({ id: chain.id, days_of_week: on ? chain.daysOfWeek.filter((x) => x !== i) : [...chain.daysOfWeek, i].sort() })} className={cn('w-6 h-6 rounded-md text-[10px] font-bold', on ? 'bg-ink text-white' : 'bg-white/60 text-ink-4')}>
                        {d}
                      </button>
                    )
                  })}
                  <span className="ml-auto text-xs text-ink-4 self-center">{links.length} link{links.length === 1 ? '' : 's'} · {minutesLabel(total)}</span>
                </div>

                <ol className="mt-4 space-y-1.5">
                  {links.map((l, i) => (
                    <li key={l.id} className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2">
                      <span className="text-[11px] font-bold text-ink-4 w-4 tabular-nums">{i + 1}</span>
                      <input
                        defaultValue={l.title}
                        onBlur={(e) => e.target.value.trim() !== l.title && patchLink.mutate({ id: l.id, title: e.target.value })}
                        className="flex-1 min-w-0 bg-transparent text-sm text-ink outline-none border-b border-transparent focus:border-ink/30"
                        aria-label="Link title"
                      />
                      <select value={l.kind} onChange={(e) => patchLink.mutate({ id: l.id, kind: e.target.value })} className="bg-surface-3 rounded-lg px-2 py-1 text-xs text-ink-2" aria-label="Link kind">
                        {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        defaultValue={l.durationMinutes}
                        onBlur={(e) => Number(e.target.value) !== l.durationMinutes && patchLink.mutate({ id: l.id, duration_minutes: Number(e.target.value) })}
                        className="w-16 bg-surface-3 rounded-lg px-2 py-1 text-xs text-ink-2 tabular-nums"
                        aria-label="Minutes"
                      />
                      <span className="text-[10px] text-ink-4">min</span>
                      <button type="button" onClick={() => patchLink.mutate({ id: l.id, move: 'up' })} disabled={i === 0} className="text-ink-4 hover:text-ink disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => patchLink.mutate({ id: l.id, move: 'down' })} disabled={i === links.length - 1} className="text-ink-4 hover:text-ink disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => deleteLink.mutate(l.id)} className="text-ink-4 hover:text-rose-600" aria-label="Remove link"><Trash2 className="w-3.5 h-3.5" /></button>
                    </li>
                  ))}
                  {links.length === 0 && <li className="text-xs text-ink-4 px-3 py-2">No links yet — {chain.role === 'live' ? 'that is fine; this one is for living.' : 'add the first one below.'}</li>}
                </ol>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={draft.title}
                    onChange={(e) => setDrafts({ ...drafts, [chain.id]: { ...draft, title: e.target.value } })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draft.title.trim()) {
                        addLink.mutate({ chainId: chain.id, title: draft.title.trim(), kind: draft.kind, duration_minutes: draft.minutes })
                        setDrafts({ ...drafts, [chain.id]: { ...draft, title: '' } })
                      }
                    }}
                    placeholder={chain.role === 'rise' ? 'e.g. Shower, then coffee' : chain.role === 'work' ? 'e.g. Inbox, 20 min' : chain.role === 'live' ? 'e.g. Run' : 'e.g. Read'}
                    className="flex-1 bg-white/80 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-4 outline-none border border-transparent focus:border-ink/20"
                  />
                  <select value={draft.kind} onChange={(e) => setDrafts({ ...drafts, [chain.id]: { ...draft, kind: e.target.value } })} className="bg-white/80 rounded-lg px-2 py-2 text-xs text-ink-2">
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input type="number" min={5} step={5} value={draft.minutes} onChange={(e) => setDrafts({ ...drafts, [chain.id]: { ...draft, minutes: Number(e.target.value) } })} className="w-16 bg-white/80 rounded-lg px-2 py-2 text-xs text-ink-2 tabular-nums" />
                  <button type="button" onClick={() => { if (draft.title.trim()) { addLink.mutate({ chainId: chain.id, title: draft.title.trim(), kind: draft.kind, duration_minutes: draft.minutes }); setDrafts({ ...drafts, [chain.id]: { ...draft, title: '' } }) } }} className="inline-flex items-center gap-1 rounded-full bg-ink text-white px-3 py-2 text-xs font-semibold">
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add
                  </button>
                </div>
              </section>
            )
          })}
        </div>

        <p className="text-xs text-ink-4 mt-6">
          You can also say it: &ldquo;my morning is gym, shower, then coffee and LeetCode&rdquo; or &ldquo;add stretching after gym&rdquo; in the planner box on Today.
        </p>
      </div>
    </PageTransition>
  )
}
