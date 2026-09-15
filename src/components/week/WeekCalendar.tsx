// src/components/week/WeekCalendar.tsx
//
// The week, front and center. Seven columns: calendar events in grey, free
// gaps as the faint planning surface, and the planned blocks coloured by
// kind — goal work in brand, recurring commitments in teal, fixed
// commitments dark, habits amber, chores rose. Milestone and target dates
// sit as chips at the top of their day.
//
// Drag a block to move it (15-minute snap, across days); the move locks it
// so the planner leaves it alone. Everything else is read-only here; the
// thread underneath handles the rest.

'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekData } from '@/hooks/useWeek'
import type { WeekBlock } from '@/lib/week/plan'

const PX_PER_HOUR = 52
const SNAP_MINUTES = 15
const MIN_BLOCK_PX = 18

const KIND_STYLES: Record<WeekBlock['kind'], string> = {
  goal: 'bg-brand-500 border-brand-600 text-white',
  flexible: 'bg-teal-500 border-teal-600 text-white',
  fixed: 'bg-ink-2 border-ink text-white',
  habit: 'bg-amber-100 border-amber-300 text-amber-900',
  chore: 'bg-rose-100 border-rose-300 text-rose-900',
}
const KIND_LABELS: Record<WeekBlock['kind'], string> = {
  goal: 'Goal work',
  flexible: 'Recurring',
  fixed: 'Fixed',
  habit: 'Habit',
  chore: 'Chore',
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60_000
}

interface WeekCalendarProps {
  week: WeekData
  onMove: (block: WeekBlock, startsAt: Date, endsAt: Date) => void
  onSelect?: (block: WeekBlock) => void
  selectedId?: string | null
  className?: string
}

export function WeekCalendar({ week, onMove, onSelect, selectedId, className }: WeekCalendarProps) {
  const days = week.calendar ?? []
  const tz = week.timeZone

  // A shared vertical scale across the week: an hour before the earliest work
  // start to an hour after the latest end, stretched to include any block or
  // event that sits outside the window (gym at 7, a dinner at 20).
  const { dayStartMinutes, dayEndMinutes } = useMemo(() => {
    const local = (d: Date) => Number(formatInTimeZone(d, tz, 'H')) * 60 + Number(formatInTimeZone(d, tz, 'm'))
    let s = 24 * 60
    let e = 0
    for (const d of days) {
      s = Math.min(s, local(d.workWindow.start) - 60)
      e = Math.max(e, local(d.workWindow.end) + 60)
      for (const ev of d.events) {
        if (ev.allDay) continue
        s = Math.min(s, local(ev.start))
        e = Math.max(e, local(ev.end))
      }
    }
    for (const b of week.blocks) {
      s = Math.min(s, local(new Date(b.starts_at)))
      e = Math.max(e, local(new Date(b.ends_at)))
    }
    if (e <= s) return { dayStartMinutes: 8 * 60, dayEndMinutes: 20 * 60 }
    return { dayStartMinutes: Math.max(0, Math.floor(s / 60) * 60), dayEndMinutes: Math.min(24 * 60, Math.ceil(e / 60) * 60) }
  }, [days, tz, week.blocks])

  const height = ((dayEndMinutes - dayStartMinutes) / 60) * PX_PER_HOUR
  const localMinutes = (d: Date) => Number(formatInTimeZone(d, tz, 'H')) * 60 + Number(formatInTimeZone(d, tz, 'm'))
  const offsetPx = (d: Date) => ((localMinutes(d) - dayStartMinutes) / 60) * PX_PER_HOUR
  const heightPx = (a: Date, b: Date) => Math.max((minutesBetween(a, b) / 60) * PX_PER_HOUR, MIN_BLOCK_PX)

  const ticks: number[] = []
  for (let m = Math.ceil(dayStartMinutes / 60) * 60; m < dayEndMinutes; m += 60) ticks.push(m)

  // ---- drag ----------------------------------------------------------------
  const gridRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ block: WeekBlock; dx: number; dy: number; colWidth: number } | null>(null)

  const beginDrag = useCallback((block: WeekBlock, e: React.PointerEvent<HTMLDivElement>) => {
    if (block.status !== 'planned') return
    const grid = gridRef.current
    if (!grid) return
    const colWidth = (grid.clientWidth - 48) / Math.max(1, days.length)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    setDrag({ block, dx: 0, dy: 0, colWidth })

    const move = (ev: PointerEvent) => setDrag((d) => (d ? { ...d, dx: ev.clientX - startX, dy: ev.clientY - startY } : d))
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      setDrag(null)
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
        onSelect?.(block)
        return
      }
      const dayShift = Math.round(dx / colWidth)
      const minuteShift = Math.round((dy / PX_PER_HOUR) * 60 / SNAP_MINUTES) * SNAP_MINUTES
      if (dayShift === 0 && minuteShift === 0) return
      const start = new Date(new Date(block.starts_at).getTime() + dayShift * 86_400_000 + minuteShift * 60_000)
      const end = new Date(new Date(block.ends_at).getTime() + dayShift * 86_400_000 + minuteShift * 60_000)
      onMove(block, start, end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [days.length, onMove, onSelect])

  const now = new Date()
  const nowMinutes = localMinutes(now)
  const nowTop = ((nowMinutes - dayStartMinutes) / 60) * PX_PER_HOUR

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="min-w-[860px]">
        {/* Day headers */}
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
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
                    <span
                      key={i}
                      title={x.label}
                      className={cn(
                        'block truncate text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                        x.kind === 'target' ? 'bg-rose-100 text-rose-800' : 'bg-brand-50 text-brand-700'
                      )}
                    >
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
        <div ref={gridRef} className="grid relative" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))`, height }}>
          {/* Hour gutter */}
          <div className="relative">
            {ticks.map((m) => (
              <div key={m} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-ink-4 tabular-nums" style={{ top: ((m - dayStartMinutes) / 60) * PX_PER_HOUR }}>
                {String(Math.floor(m / 60)).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {days.map((d, col) => {
            const dayBlocks = week.blocks.filter((b) => b.date === d.date)
            return (
              <div key={d.date} className={cn('relative border-l border-line', d.isToday ? 'bg-brand-50/40' : d.isPast ? 'bg-surface-3/60' : 'bg-surface-2')}>
                {ticks.map((m) => (
                  <div key={m} className="absolute left-0 right-0 border-t border-line/70" style={{ top: ((m - dayStartMinutes) / 60) * PX_PER_HOUR }} />
                ))}

                {/* Work window shading */}
                <div className="absolute left-0 right-0 bg-white/70" style={{ top: offsetPx(d.workWindow.start), height: heightPx(d.workWindow.start, d.workWindow.end) }} />

                {/* Free gaps */}
                {d.gaps.map((g) => (
                  <div key={g.start.getTime()} className="absolute left-1 right-1 rounded-lg border border-dashed border-brand-200/80" style={{ top: offsetPx(g.start), height: heightPx(g.start, g.end) }} />
                ))}

                {/* Events */}
                {d.events.filter((e) => !e.allDay).map((e) => {
                  const start = new Date(Math.max(e.start.getTime(), d.workWindow.start.getTime() - 3600_000))
                  const end = new Date(Math.min(e.end.getTime(), d.workWindow.end.getTime() + 3600_000))
                  if (end <= start) return null
                  return (
                    <div
                      key={e.id}
                      title={`${e.title} · ${formatInTimeZone(e.start, tz, 'H:mm')}–${formatInTimeZone(e.end, tz, 'H:mm')}`}
                      className={cn(
                        'absolute rounded-lg border px-1.5 py-0.5 overflow-hidden text-[11px] leading-tight',
                        e.busy ? 'left-1 right-1 bg-white border-line text-ink-2' : 'left-1/2 right-1 bg-surface-2 border-dashed border-line-strong text-ink-4'
                      )}
                      style={{ top: offsetPx(start), height: heightPx(start, end) }}
                    >
                      <span className="font-semibold truncate block">{e.title}</span>
                    </div>
                  )
                })}

                {/* Blocks */}
                {dayBlocks.map((b) => {
                  const start = new Date(b.starts_at)
                  const end = new Date(b.ends_at)
                  const dragging = drag?.block.id === b.id
                  const compact = minutesBetween(start, end) < 40
                  const resolved = b.status !== 'planned'
                  return (
                    <div
                      key={b.id}
                      onPointerDown={(e) => beginDrag(b, e)}
                      title={`${b.title} · ${formatInTimeZone(start, tz, 'H:mm')}–${formatInTimeZone(end, tz, 'H:mm')}${b.rationale ? ` · ${b.rationale}` : ''}`}
                      className={cn(
                        'absolute left-1.5 right-1.5 rounded-xl border px-2 py-1 overflow-hidden select-none touch-none',
                        KIND_STYLES[b.kind],
                        resolved && 'opacity-60',
                        b.status === 'done' && 'ring-2 ring-emerald-400',
                        selectedId === b.id && 'ring-2 ring-offset-1 ring-ink',
                        b.status === 'planned' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                        dragging && 'z-30 shadow-lg'
                      )}
                      style={{
                        top: offsetPx(start),
                        height: heightPx(start, end),
                        transform: dragging ? `translate(${drag!.dx}px, ${drag!.dy}px)` : undefined,
                        zIndex: dragging ? 30 : 10,
                      }}
                    >
                      <p className={cn('font-semibold leading-tight', compact ? 'text-[10px] truncate' : 'text-[11px] line-clamp-3')}>
                        {b.title}
                      </p>
                      {!compact && (
                        <p className="text-[10px] opacity-80 tabular-nums flex items-center gap-1">
                          {formatInTimeZone(start, tz, 'H:mm')}–{formatInTimeZone(end, tz, 'H:mm')}
                          {b.locked && <Lock className="w-2.5 h-2.5" />}
                          {b.status !== 'planned' && <span>· {b.status}</span>}
                        </p>
                      )}
                    </div>
                  )
                })}

                {/* Now line */}
                {d.isToday && nowTop >= 0 && nowTop <= height && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                    <div className="h-0.5 bg-rose-500" />
                    <div className="w-2 h-2 rounded-full bg-rose-500 -mt-[5px] -ml-1" />
                  </div>
                )}
                {col === 0 && null}
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
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-brand-300" /> free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-white border border-line" /> event
          </span>
          <span className="ml-auto">drag a block to move it</span>
        </div>
      </div>
    </div>
  )
}
