// src/app/(dashboard)/goals/new/page.tsx
// State a goal. One sentence, a date, a project. Optionally paste the docs
// you keep for it so the ladder is grounded in your own vocabulary; from the
// terminal, `fos goal` gathers docs and commit history automatically.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { PageTransition } from '@/components/ui'
import { useCreateGoal } from '@/hooks/useGoals4'
import { cn } from '@/lib/utils'

export default function NewGoalPage() {
  const router = useRouter()
  const create = useCreateGoal()
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [project, setProject] = useState('')
  const [weight, setWeight] = useState(2)
  const [docs, setDocs] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!title.trim()) {
      setError('Say what the finished goal looks like, in one sentence.')
      return
    }
    try {
      const result = await create.mutateAsync({
        title: title.trim(),
        target_date: targetDate || null,
        project: project.trim() ? { name: project.trim() } : null,
        weight,
        docs: docs.trim() || null,
      })
      router.push(`/goals/${result.goal.outcome.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  const field = 'w-full bg-white border border-line rounded-2xl px-4 py-3 text-[15px] text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition'

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">New goal</p>
        <h1 className="text-3xl font-bold text-ink tracking-tight mb-2">What does done look like?</h1>
        <p className="text-[15px] text-ink-3 leading-relaxed mb-8 max-w-xl">
          One sentence, ideally with a number and a date. The ladder is drafted from this, your docs, and your commit
          history — then it is yours to edit.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-2">Goal</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="HNRY TestFlight beta to 5 testers"
              className={field}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ink-2 mb-2">Target date</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-2 mb-2">Project</label>
              <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="HNRY" className={field} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-2 mb-2">Weight</label>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeight(w)}
                    className={cn(
                      'flex-1 rounded-2xl border py-3 text-sm font-semibold transition',
                      weight === w ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-line text-ink-3 hover:border-line-strong'
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-2">
              Docs <span className="font-normal text-ink-4">(optional — README, notes, a spec; grounds the ladder in your words)</span>
            </label>
            <textarea
              value={docs}
              onChange={(e) => setDocs(e.target.value)}
              rows={6}
              placeholder="Paste anything you keep about this project."
              className={cn(field, 'font-mono text-[13px] leading-relaxed')}
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={create.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-5 py-3 text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
              {create.isPending ? 'Reverse-engineering…' : 'Build the ladder'}
            </button>
            <p className="text-xs text-ink-4">Takes 20–60 seconds. One model call; stored with a version number.</p>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
