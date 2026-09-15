// src/components/week/AddBlockDialog.tsx
// Add something by hand. Opens from the Add button (defaults to the next
// quarter hour) or from a click on empty calendar space (prefilled).

'use client'

import { useEffect, useState } from 'react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekBlock } from '@/lib/week/plan'
import { KIND_LABELS, KIND_STYLES } from './WeekCalendar'

interface AddBlockDialogProps {
  open: boolean
  timeZone: string
  initialStart: Date | null
  onCreate: (input: { title: string; kind: WeekBlock['kind']; starts_at: string; ends_at: string }) => Promise<void>
  onClose: () => void
}

export function AddBlockDialog({ open, timeZone, initialStart, onCreate, onClose }: AddBlockDialogProps) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<WeekBlock['kind']>('chore')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [duration, setDuration] = useState(60)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const base = initialStart ?? new Date(Math.ceil(Date.now() / (15 * 60_000)) * 15 * 60_000)
    setDate(formatInTimeZone(base, timeZone, 'yyyy-MM-dd'))
    setStart(formatInTimeZone(base, timeZone, 'HH:mm'))
    setTitle('')
    setKind('chore')
    setDuration(60)
    setError(null)
  }, [open, initialStart, timeZone])

  if (!open) return null

  const submit = async () => {
    setError(null)
    if (!title.trim()) return setError('Give it a name.')
    const s = fromZonedTime(`${date}T${start}:00`, timeZone)
    if (Number.isNaN(s.getTime())) return setError('Pick a date and time.')
    const e = new Date(s.getTime() + duration * 60_000)
    setPending(true)
    try {
      await onCreate({ title: title.trim(), kind, starts_at: s.toISOString(), ends_at: e.toISOString() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that')
    } finally {
      setPending(false)
    }
  }

  const field = 'bg-surface-3 border border-transparent focus:border-brand-300 rounded-xl px-3 py-2 text-sm text-ink outline-none'

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-semibold text-ink">Add to the week</h3>
          <button type="button" onClick={onClose} className="text-ink-4 hover:text-ink" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="What is it? e.g. Send the September invoice"
          className="w-full bg-surface-3 rounded-2xl px-4 py-3 text-[15px] text-ink placeholder:text-ink-4 outline-none border border-transparent focus:border-brand-300"
          autoFocus
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(KIND_LABELS) as WeekBlock['kind'][]).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold', kind === k ? 'border-ink text-ink' : 'border-line text-ink-3 hover:border-line-strong')}>
              <span className={cn('w-2.5 h-2.5 rounded-sm border', KIND_STYLES[k])} /> {KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} aria-label="Date" />
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={cn(field, 'w-28')} aria-label="Start" />
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={field} aria-label="Duration">
            {[15, 30, 45, 60, 90, 120, 150, 180, 240].map((m) => (
              <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60}h${m % 60 ? ` ${m % 60}m` : ''}`}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-3 hover:text-ink">Cancel</button>
          <button type="button" onClick={submit} disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-600 disabled:opacity-60">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />} Add
          </button>
        </div>
      </div>
    </div>
  )
}
