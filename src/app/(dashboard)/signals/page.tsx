// src/app/(dashboard)/signals/page.tsx
// What the system saw. If this page is wrong for three days, stop building on
// it and fix the observer first (DECISIONS.md, Phase 2).

'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { GitCommit, TerminalSquare, FolderOpen, Hand, Rocket } from 'lucide-react'
import { PageTransition, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

interface SignalRow {
  id: string
  project_id: string | null
  source: 'git' | 'session' | 'fs' | 'manual' | 'deploy'
  kind: string
  summary: string
  paths: string[]
  occurred_at: string
  duration_minutes: number | null
}

const ICONS = { git: GitCommit, session: TerminalSquare, fs: FolderOpen, manual: Hand, deploy: Rocket }

export default function SignalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['signals'],
    queryFn: async (): Promise<SignalRow[]> => {
      const res = await fetch('/api/signals?limit=100')
      if (!res.ok) throw new Error('Failed to load signals')
      return ((await res.json()) as { signals: SignalRow[] }).signals
    },
    staleTime: 30_000,
  })
  const { data: projects } = useQuery({
    queryKey: ['projects-v4'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      return res.ok ? ((await res.json()) as { projects: { id: string; name: string }[] }).projects : []
    },
  })
  const nameOf = (id: string | null) => projects?.find((p) => p.id === id)?.name ?? '—'

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">Signals</p>
        <h1 className="text-3xl font-bold text-ink tracking-tight mb-2">What the system saw</h1>
        <p className="text-[15px] text-ink-3 leading-relaxed mb-8 max-w-xl">
          Commits from the post-commit hook, sessions from Claude Code, folder activity from mapped non-git
          folders. Blocks resolve from these. If this is wrong, the card is wrong.
        </p>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        )}

        {!isLoading && data?.length === 0 && (
          <div className="bg-white border border-line rounded-3xl shadow-sm p-6 text-sm text-ink-3 leading-relaxed">
            Nothing observed yet. Run <span className="font-mono">fos map &quot;Name=/path&quot;</span> for each repo, then commit
            something or end a Claude Code session in it.
          </div>
        )}

        <ul className="space-y-2">
          {data?.map((s) => {
            const Icon = ICONS[s.source] ?? Hand
            return (
              <li key={s.id} className="bg-white border border-line rounded-2xl px-4 py-3 flex items-start gap-3">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', s.source === 'git' ? 'bg-brand-50 text-brand-500' : 'bg-surface-3 text-ink-3')}>
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">
                    <span className="font-semibold">{nameOf(s.project_id)}</span>
                    <span className="text-ink-4"> · {s.kind}</span>
                    {s.duration_minutes ? <span className="text-ink-4"> · {s.duration_minutes}m</span> : null}
                  </p>
                  {s.summary && <p className="text-sm text-ink-2 truncate">{s.summary}</p>}
                  {s.paths?.length > 0 && <p className="text-xs text-ink-4 font-mono truncate">{s.paths.slice(0, 3).join(', ')}{s.paths.length > 3 ? ` +${s.paths.length - 3}` : ''}</p>}
                </div>
                <span className="text-xs text-ink-4 whitespace-nowrap">{formatDistanceToNow(new Date(s.occurred_at), { addSuffix: true })}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </PageTransition>
  )
}
