// src/app/(dashboard)/goals/new/page.tsx
// State a goal in a sentence. The conversation does the rest.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { PageTransition } from '@/components/ui'
import { cn } from '@/lib/utils'

export default function NewGoalPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [project, setProject] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!title.trim()) {
      setError('Say what the finished goal looks like, in one sentence.')
      return
    }
    setPending(true)
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft: true, title: title.trim(), target_date: targetDate || null, project: project.trim() ? { name: project.trim() } : null }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Could not create the goal')
      queryClient.invalidateQueries({ queryKey: ['goals-v4'] })
      router.push(`/goals/${body.goal.outcome.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPending(false)
    }
  }

  const field = 'w-full bg-white border border-line rounded-2xl px-4 py-3 text-[15px] text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition'

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">New goal</p>
        <h1 className="text-3xl font-bold text-ink tracking-tight mb-2">What does done look like?</h1>
        <p className="text-[15px] text-ink-3 leading-relaxed mb-8 max-w-xl">
          One sentence. The agent will ask you a few questions — what already exists, what recurs around it, what
          you&apos;re avoiding — then propose the ladder and plan the week around it.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-2">Goal</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Get a software engineering job by December" className={field} autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ink-2 mb-2">Target date <span className="font-normal text-ink-4">(optional)</span></label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-2 mb-2">Project <span className="font-normal text-ink-4">(optional)</span></label>
              <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Job search" className={field} />
            </div>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="button" onClick={submit} disabled={pending} className={cn('inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-5 py-3 text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 transition-colors')}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
            Start the conversation
          </button>
        </div>
      </div>
    </PageTransition>
  )
}
