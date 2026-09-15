// src/components/week/BlockEditor.tsx
//
// One block, editable: rename it, change what kind of thing it is, move its
// times precisely, mark it done / partial / skipped, lock or unlock it
// against re-planning, or remove it. Opens when a block is clicked.

'use client'

import { useEffect, useState } from 'react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { Check, Lock, LockOpen, Minus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekBlock } from '@/lib/week/plan'
import { KIND_LABELS, KIND_STYLES } from './WeekCalendar'

export interface BlockPatch {
  deliverable?: string
  kind?: WeekBlock['kind']
  starts_at?: string
  ends_at?: string
  status?: 'planned' | 'done' | 'partial' | 'skipped'
  locked?: boolean
}

interface BlockEditorProps {
  block: WeekBlock
  timeZone: string
  onSave: (patch: BlockPatch) => Promise<void> | void
  onDelete: () => Promise<void> | void
  onClose: () => void
  busy?: boolean
}

export function BlockEditor({ block, timeZone, onSave, onDelete, onClose, busy }: BlockEditorProps) {
  const [title, setTitle] = useState(block.title)
  const [kind, setKind] = useState<WeekBlock['kind']>(block.kind)
  const [date, setDate] = useState(formatInTimeZone(new Date(block.starts_at), timeZone, 'yyyy-MM-dd'))
  const [start, setStart] = useState(formatInTimeZone(new Date(block.starts_at), timeZone, 'HH:mm'))
  const [end, setEnd] = useState(formatInTimeZone(new Date(block.ends_at), timeZone, 'HH:mm'))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(block.title)
    setKind(block.kind)
    setDate(formatInTimeZone(new Date(block.starts_at), timeZone, 'yyyy-MM-dd'))
    setStart(formatInTimeZone(new Date(block.starts_at), timeZone, 'HH:mm'))
    setEnd(formatInTimeZone(new Date(block.ends_at), timeZone, 'HH:mm'))
    setError(null)
  }, [block, timeZone])

  const dirty =
    title.trim() !== block.title ||
    kind !== block.kind ||
    date !== formatInTimeZone(new Date(block.starts_at), timeZone, 'yyyy-MM-dd') ||
    start !== formatInTimeZone(new Date(block.starts_at), timeZone, 'HH:mm') ||
    end !== formatInTimeZone(new Date(block.ends_at), timeZone, 'HH:mm')

  const save = async () => {
    setError(null)
    const s = fromZonedTime(`${date}T${start}:00`, timeZone)
    const e = fromZonedTime(`${date}T${end}:00`, timeZone)
    if (!title.trim()) return setError('Give it a name.')
    if (e <= s) return setError('End must be after start.')
    const patch: BlockPatch = {}
    if (title.trim() !== block.title) patch.deliverable = title.trim()
    if (kind !== block.kind) patch.kind = kind
    if (s.toISOString() !== block.starts_at || e.toISOString() !== block.ends_at) {
      patch.starts_at = s.toISOString()
      patch.ends_at = e.toISOString()
    }
    if (Object.keys(patch).length === 0) return
    await onSave(patch)
  }

  const field = 'bg-surface-3 border border-transparent focus:border-brand-300 rounded-xl px-3 py-2 text-sm text-ink outline-none'
  const planned = block.status === 'planned'

  return (
    <div className="bg-white border border-line rounded-3xl shadow-sm p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={cn('mt-1 w-3 h-3 rounded-sm border flex-shrink-0', KIND_STYLES[kind])} />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className="flex-1 min-w-0 bg-transparent text-[16px] font-semibold text-ink outline-none border-b border-transparent focus:border-line-strong"
          aria-label="Block name"
        />
        <button type="button" onClick={onClose} className="text-ink-4 hover:text-ink" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      {block.rationale && <p className="text-xs text-ink-4 mt-1 ml-6">{block.rationale}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as WeekBlock['kind'])} className={field} aria-label="Kind">
          {(Object.keys(KIND_LABELS) as WeekBlock['kind'][]).map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} aria-label="Date" />
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={cn(field, 'w-28')} aria-label="Start" />
        <span className="text-ink-4 text-sm">to</span>
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={cn(field, 'w-28')} aria-label="End" />
        {dirty && (
          <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 text-white px-3.5 py-2 text-sm font-semibold hover:bg-brand-600 disabled:opacity-60">
            <Check className="w-4 h-4" strokeWidth={2.5} /> Save
          </button>
        )}
      </div>
      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}

      <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-2 text-sm">
        {planned ? (
          <>
            <button type="button" onClick={() => onSave({ status: 'done' })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 font-semibold hover:bg-emerald-100">
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Done
            </button>
            <button type="button" onClick={() => onSave({ status: 'partial' })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-3 py-1.5 font-semibold hover:bg-amber-100">
              <Minus className="w-3.5 h-3.5" strokeWidth={2.5} /> Partial
            </button>
            <button type="button" onClick={() => onSave({ status: 'skipped' })} disabled={busy} className="rounded-full px-3 py-1.5 font-semibold text-ink-3 hover:text-ink">
              Skip
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-3 text-ink-3">{block.status}</span>
            <button type="button" onClick={() => onSave({ status: 'planned' })} disabled={busy} className="text-xs font-semibold text-brand-600">reopen</button>
          </>
        )}
        <span className="flex-1" />
        <button type="button" onClick={() => onSave({ locked: !block.locked })} disabled={busy} title={block.locked ? 'Unlock: let the planner move it' : 'Lock: keep it here when re-planning'} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-ink-3 hover:border-line-strong">
          {block.locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
          {block.locked ? 'Locked' : 'Unlocked'}
        </button>
        <button type="button" onClick={onDelete} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-ink-4 hover:text-rose-600" aria-label="Remove block">
          <Trash2 className="w-4 h-4" /> Remove
        </button>
      </div>
    </div>
  )
}
