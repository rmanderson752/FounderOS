// src/components/week/WeekCalendar.tsx
//
// The week, front and center. Seven columns: calendar events in grey, free
// gaps as the faint planning surface, and the planned blocks coloured by
// kind — goal work in brand, recurring commitments in teal, fixed
// commitments dark, habits amber, chores rose. Milestone and target dates
// sit as chips at the top of their day.
//
// Interaction, all pointer-based and 15-minute snapped:
//   drag a block      moves it, across days too; the preview sits exactly
//                     where it will land and shows the new time
//   drag its bottom   resizes it
//   click a block     selects it (the page opens the editor)
//   click empty space adds a block at that time
// A move or resize locks the block so the planner leaves it alone.

'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekData } from '@/hooks/useWeek'
import type { WeekBlock } from '@/lib/week/plan'

const PX_PER_HOUR = 56
const SNAP_MINUTES = 15
const MIN_BLOCK_MINUTES = 15
const MIN_BLOCK_PX = 18
const GUTTER_PX = 48
const DRAG_THRESHOLD_PX = 4

export const KIND_STYLES: Record<WeekBlock['kind'], string> = {
  goal: 'bg-brand-500 border-brand-600 text-white',
  flexible: 'bg-teal-500 border-teal-600 text-white',
  fixed: 'bg-ink-2 border-ink text-white',
  habit: 'bg-amber-100 border-amber-300 text-amber-900',
  chore: 'bg-rose-100 border-rose-300 text-rose-900',
}
export const KIND_LABELS: Record<WeekBlock['kind'], string> = {
  goal: 'Goal work',
  flexible: 'Recurring',
  fixed: 'Fixed',
  habit: 'Habit',
  chore: 'Chore',
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60_000
}

function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

type Gesture =
  | { mode: 'move'; block: WeekBlock; originX: number; originY: number; colWidth: number; dayShift: number; minuteShift: number; moved: boolean }
  | { mode: 'resize'; block: WeekBlock; originY: number; minuteDelta: number; moved: boolean }

interface WeekCalendarProps {
  week: WeekData
  onMove: (block: WeekBlock, startsAt: Date, endsAt: Date) => void
  onResize: (block: WeekBlock, endsAt: Date) => void
  onSelect?: (block: WeekBlock) => void
  onAddAt?: (startsAt: Date) => void
  selectedId?: string | null
  className?: string
}

export function WeekCalendar({ week, onMove, onResize, onSelect, onAddAt, selectedId, className }: WeekCalendarProps) {
  const days = week.calendar ?? []
  const tz = week.timeZone

  const localMinutes = useCallback((d: Date) => Number(formatInTimeZone(d, tz, 'H')) * 60 + Number(formatInTimeZone(d, tz, 'm')), [tz])

  // A shared vertical scale: an hour around the work window, stretched to
  // include any block or event outside it (gym at 7, dinner at 20).
  const { dayStartMinutes, dayEndMinutes } = useMemo(() => {
    let s = 24 * 60
    let e = 0
    for (const d of days) {
      s = Math.min(s, localMinutes(d.workWindow.start) - 60)
      e = Math.max(e, localMinutes(d.workWindow.end) + 60)
      for (const ev of d.events) {
        if (ev.allDay) continue
        s = Math.min(s, localMinutes(ev.start))
        e = Math.max(e, localMinutes(ev.end))
      }
    }
    for (const b of week.blocks) {
      s = Math.min(s, localMinutes(new Date(b.starts_at)))
      e = Math.max(e, localMinutes(new Date(b.ends_at)))
    }
    if (e <= s) return { dayStartMinutes: 8 * 60, dayEndMinutes: 20 * 60 }
    return { dayStartMinutes: Math.max(0, Math.floor(s / 60) * 60), dayEndMinutes: Math.min(24 * 60, Math.ceil(e / 60) * 60) }
  }, [days, week.blocks, localMinutes])

  const height = ((dayEndMinutes - dayStartMinutes) / 60) * PX_PER_HOUR
  const topOf = (d: Date) => ((localMinutes(d) - dayStartMinutes) / 60) * PX_PER_HOUR
  const heightOf = (a: Date, b: Date) => Math.max((minutesBetween(a, b) / 60) * PX_PER_HOUR, MIN_BLOCK_PX)
  const clock = (d: Date) => formatInTimeZone(d, tz, 'H:mm')

  const ticks: number[] = []
  for (let m = Math.ceil(dayStartMinutes / 60) * 60; m < dayEndMinutes; m += 60) ticks.push(m)

  // ---- gestures --------------------------------------------------------------
  const gridRef = useRef<HTMLDivElement>(null)
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const update = (g: Gesture | null) => {
    gestureRef.current = g
    setGesture(g)
  }

  const colWidthNow = () => {
    const grid = gridRef.current
    return grid ? (grid.clientWidth - GUTTER_PX) / Math.max(1, days.length) : 1
  }

  const finish = useCallback(() => {
    const g = gestureRef.current
    update(null)
    if (!g) return
    if (!g.moved) {
      onSelect?.(g.block)
      return
    }
    if (g.mode === 'move') {
      if (g.dayShift === 0 && g.minuteShift === 0) return
      const delta = g.dayShift * 86_400_000 + g.minuteShift * 60_000
      onMove(g.block, new Date(new Date(g.block.starts_at).getTime() + delta), new Date(new Date(g.block.ends_at).getTime() + delta))
    } else {
      if (g.minuteDelta === 0) return
      onResize(g.block, new Date(new Date(g.block.ends_at).getTime() + g.minuteDelta * 60_000))
    }
  }, [onMove, onResize, onSelect])

  const begin = useCallback(
    (block: WeekBlock, mode: 'move' | 'resize', e: React.PointerEvent<HTMLElement>) => {
      if (block.status !== 'planned') return
      e.preventDefault()
      e.stopPropagation()
      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)
      const colWidth = colWidthNow()
      const originX = e.clientX
      const originY = e.clientY
      update(mode === 'move' ? { mode, block, originX, originY, colWidth, dayShift: 0, minuteShift: 0, moved: false } : { mode, block, originY, minuteDelta: 0, moved: false })

      const onPointerMove = (ev: PointerEvent) => {
        const g = gestureRef.current
        if (!g) return
        const dy = ev.clientY - originY
        const dx = ev.clientX - originX
        const moved = g.moved || Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX
        if (g.mode === 'move') {
          const dayShift = Math.max(-6, Math.min(6, Math.round(dx / g.colWidth)))
          const minuteShift = snap((dy / PX_PER_HOUR) * 60)
          update({ ...g, dayShift, minuteShift, moved })
        } else {
          const length = minutesBetween(new Date(g.block.starts_at), new Date(g.block.ends_at))
          const minuteDelta = Math.max(MIN_BLOCK_MINUTES - length, snap((dy / PX_PER_HOUR) * 60))
          update({ ...g, minuteDelta, moved })
        }
      }
      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('keydown', onKey)
        finish()
      }
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          window.removeEventListener('pointermove', onPointerMove)
          window.removeEventListener('pointerup', onPointerUp)
          window.removeEventListener('keydown', onKey)
          update(null)
        }
      }
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('keydown', onKey)
    },
    [finish]
  )

  // Click on empty space → add at that time (snapped).
  const emptyDown = useRef<{ x: number; y: number; date: string } | null>(null)
  const onColumnPointerDown = (date: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    emptyDown.current = { x: e.clientX, y: e.clientY, date }
  }
  const onColumnPointerUp = (date: string, e: React.PointerEvent<HTMLDivElement>) => {
    const down = emptyDown.current
    emptyDown.current = null
    if (!down || down.date !== date || !onAddAt) return
    if (Math.abs(e.clientX - down.x) > DRAG_THRESHOLD_PX || Math.abs(e.clientY - down.y) > DRAG_THRESHOLD_PX) return
    const rect = e.currentTarget.getBoundingClientRect()
    const minutes = dayStartMinutes + snap(((e.clientY - rect.top) / PX_PER_HOUR) * 60)
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
    const mm = String(minutes % 60).padStart(2, '0')
    onAddAt(fromZonedTime(`${date}T${hh}:${mm}:00`, tz))
  }

  // Where the dragged block currently previews.
  const preview = useMemo(() => {
    if (!gesture || !gesture.moved) return null
    const start = new Date(gesture.block.starts_at)
    const end = new Date(gesture.block.ends_at)
    if (gesture.mode === 'move') {
      const delta = gesture.dayShift * 86_400_000 + gesture.minuteShift * 60_000
      const s = new Date(start.getTime() + delta)
      const en = new Date(end.getTime() + delta)
      return { id: gesture.block.id, date: formatInTimeZone(s, tz, 'yyyy-MM-dd'), start: s, end: en }
    }
    return { id: gesture.block.id, date: gesture.block.date, start, end: new Date(end.getTime() + gesture.minuteDelta * 60_000) }
  }, [gesture, tz])

  const now = new Date()
  const nowTop = ((localMinutes(now) - dayStartMinutes) / 60) * PX_PER_HOUR

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="min-w-[860px] select-none">
        {/* Day headers */}
        <div className="grid" style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => {
            const due = week.due.filter((x) => x.date === d.date)
            return (
              <div key={d.date} className={cn('px-2 pb-2 border-b border-line', d.isToday && 'border-b-brand-400')}>
                <p className={cn('text-[11px] font-semibold uppercase tracking-wider', d.isToday ? 'text-brand-600' : 'text-ink-4')}>
                  {formatInTimeZone(d.workWindow.start, tz, 'EEE')}
                </p>
                <p className={cn('text-[17px] font-bold leading-tight tabular-nums', d.isToday ? 'text-ink' : d.isPast ? 'text-ink-4' : 'text-ink-2')}>
                  {formatInTimeZone(d.workWindow.start, tz, 'd')}
                </p>
                <div className="mt-1 space-y-1">
                  {due.map((x, i) => (
                    <span key={i} title={x.label} className={cn('block truncate text-[10px] font-semibold px-1.5 py-0.5 rounded-md', x.kind === 'target' ? 'bg-rose-100 text-rose-800' : 'bg-brand-50 text-brand-700')}>
                      {x.kind === 'target' ? '◆ ' : '◇ '}
                      {x.label}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Grid */}
        <div ref={gridRef} className={cn('grid relative', gesture?.moved && (gesture.mode === 'move' ? 'cursor-grabbing' : 'cursor-ns-resize'))} style={{ gridTemplateColumns: `${GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`, height }}>
          {/* Hour gutter */}
          <div className="relative">
            {ticks.map((m) => (
              <div key={m} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-ink-4 tabular-nums" style={{ top: ((m - dayStartMinutes) / 60) * PX_PER_HOUR }}>
                {String(Math.floor(m / 60)).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dayBlocks = week.blocks.filter((b) => b.date === d.date && b.id !== preview?.id)
            const previewHere = preview && preview.date === d.date ? preview : null
            const dragTarget = gesture?.moved && gesture.mode === 'move' && previewHere
            return (
              <div
                key={d.date}
                onPointerDown={(e) => onColumnPointerDown(d.date, e)}
                onPointerUp={(e) => onColumnPointerUp(d.date, e)}
                className={cn(
                  'relative border-l border-line transition-colors',
                  d.isToday ? 'bg-brand-50/40' : d.isPast ? 'bg-surface-3/60' : 'bg-surface-2',
                  dragTarget && 'bg-brand-50/70',
                  onAddAt && !d.isPast && 'cursor-cell'
                )}
              >
                {ticks.map((m) => (
                  <div key={m} className="absolute left-0 right-0 border-t border-line/70 pointer-events-none" style={{ top: ((m - dayStartMinutes) / 60) * PX_PER_HOUR }} />
                ))}

                {/* Work window shading */}
                <div className="absolute left-0 right-0 bg-white/70 pointer-events-none" style={{ top: topOf(d.workWindow.start), height: heightOf(d.workWindow.start, d.workWindow.end) }} />

                {/* Free gaps */}
                {d.gaps.map((g) => (
                  <div key={g.start.getTime()} className="absolute left-1 right-1 rounded-lg border border-dashed border-brand-200/80 pointer-events-none" style={{ top: topOf(g.start), height: heightOf(g.start, g.end) }} />
                ))}

                {/* Events */}
                {d.events.filter((e) => !e.allDay).map((e) => {
                  const start = new Date(Math.max(e.start.getTime(), d.workWindow.start.getTime() - 3600_000))
                  const end = new Date(Math.min(e.end.getTime(), d.workWindow.end.getTime() + 3600_000))
                  if (end <= start) return null
                  return (
                    <div key={e.id} title={`${e.title} · ${clock(e.start)}–${clock(e.end)}`} className={cn('absolute rounded-lg border px-1.5 py-0.5 overflow-hidden text-[11px] leading-tight', e.busy ? 'left-1 right-1 bg-white border-line text-ink-2' : 'left-1/2 right-1 bg-surface-2 border-dashed border-line-strong text-ink-4')} style={{ top: topOf(start), height: heightOf(start, end) }}>
                      <span className="font-semibold truncate block">{e.title}</span>
                    </div>
                  )
                })}

                {/* Blocks */}
                {dayBlocks.map((b) => (
                  <BlockView key={b.id} block={b} top={topOf(new Date(b.starts_at))} height={heightOf(new Date(b.starts_at), new Date(b.ends_at))} clock={clock} selected={selectedId === b.id} onBegin={begin} />
                ))}

                {/* The block being dragged / resized, at its snapped destination */}
                {previewHere && gesture && (
                  <BlockView block={gesture.block} top={topOf(previewHere.start)} height={heightOf(previewHere.start, previewHere.end)} clock={clock} selected preview previewLabel={`${clock(previewHere.start)}–${clock(previewHere.end)}`} onBegin={begin} />
                )}

                {/* Now line */}
                {d.isToday && nowTop >= 0 && nowTop <= height && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                    <div className="h-0.5 bg-rose-500" />
                    <div className="w-2 h-2 rounded-full bg-rose-500 -mt-[5px] -ml-1" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-ink-3">
          {(Object.keys(KIND_LABELS) as WeekBlock['kind'][]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn('w-2.5 h-2.5 rounded-sm border', KIND_STYLES[k])} />
              {KIND_LABELS[k]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-brand-300" /> free</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-white border border-line" /> event</span>
          <span className="ml-auto">drag to move · drag the bottom edge to resize · click empty space to add</span>
        </div>
      </div>
    </div>
  )
}

function BlockView({
  block,
  top,
  height,
  clock,
  selected,
  preview,
  previewLabel,
  onBegin,
}: {
  block: WeekBlock
  top: number
  height: number
  clock: (d: Date) => string
  selected?: boolean
  preview?: boolean
  previewLabel?: string
  onBegin: (block: WeekBlock, mode: 'move' | 'resize', e: React.PointerEvent<HTMLElement>) => void
}) {
  const start = new Date(block.starts_at)
  const end = new Date(block.ends_at)
  const compact = height < 40
  const resolved = block.status !== 'planned'
  return (
    <div
      onPointerDown={(e) => onBegin(block, 'move', e)}
      title={`${block.title} · ${clock(start)}–${clock(end)}${block.rationale ? ` · ${block.rationale}` : ''}`}
      className={cn(
        'absolute left-1.5 right-1.5 rounded-xl border px-2 py-1 overflow-hidden touch-none',
        KIND_STYLES[block.kind],
        resolved && 'opacity-60',
        block.status === 'done' && 'ring-2 ring-emerald-400',
        selected && !preview && 'ring-2 ring-offset-1 ring-ink',
        preview ? 'z-30 shadow-xl ring-2 ring-ink/40 opacity-95' : 'transition-[top,height] duration-150 ease-out z-10',
        block.status === 'planned' ? 'cursor-grab' : 'cursor-default'
      )}
      style={{ top, height }}
    >
      <p className={cn('font-semibold leading-tight', compact ? 'text-[10px] truncate' : 'text-[11px] line-clamp-3')}>{block.title}</p>
      {!compact && (
        <p className="text-[10px] opacity-80 tabular-nums flex items-center gap-1">
          {previewLabel ?? `${clock(start)}–${clock(end)}`}
          {block.locked && <Lock className="w-2.5 h-2.5" />}
          {block.status !== 'planned' && <span>· {block.status}</span>}
        </p>
      )}
      {preview && compact && previewLabel && <p className="text-[10px] opacity-90 tabular-nums">{previewLabel}</p>}
      {block.status === 'planned' && (
        <div
          onPointerDown={(e) => onBegin(block, 'resize', e)}
          className="absolute left-0 right-0 bottom-0 h-2.5 cursor-ns-resize"
          aria-label="Resize"
        >
          <div className="mx-auto mt-1 w-8 h-1 rounded-full bg-current opacity-30" />
        </div>
      )}
    </div>
  )
}
