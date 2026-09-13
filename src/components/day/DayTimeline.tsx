// src/components/day/DayTimeline.tsx
//
// The day as a vertical strip: calendar events in grey, free gaps highlighted,
// and the Start Card's block drawn inside the gap it was sized to. A block
// only ever appears here after lib/planner/validate accepted it, so by
// construction it never overlaps an event.

'use client'

import { formatInTimeZone } from 'date-fns-tz'
import { cn } from '@/lib/utils'
import type { DayCalendar, TimeInterval } from '@/lib/calendar/types'

/** Vertical pixels per hour. Enough to read a 30 minute gap's label. */
const PX_PER_HOUR = 64
/** Below this, a block has room for a title but not a time range. */
const MIN_LABEL_MINUTES = 45
/** Below this, a block gets a single compact line. */
const COMPACT_MINUTES = 30
/** Short events still need to be clickable and visible. */
const MIN_BLOCK_PX = 20

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60_000
}

function clockRange(interval: TimeInterval, timeZone: string): string {
  return `${formatInTimeZone(interval.start, timeZone, 'HH:mm')} – ${formatInTimeZone(
    interval.end,
    timeZone,
    'HH:mm'
  )}`
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export interface TimelineBlock extends TimeInterval {
  id: string
  deliverable: string
  status: string
}

interface DayTimelineProps {
  day: DayCalendar
  blocks?: TimelineBlock[]
  className?: string
}

export function DayTimeline({ day, blocks = [], className }: DayTimelineProps) {
  const { workWindow, timeZone } = day
  const windowMinutes = minutesBetween(workWindow.start, workWindow.end)
  if (windowMinutes <= 0) return null

  const height = (windowMinutes / 60) * PX_PER_HOUR
  const offsetPx = (start: Date) => (minutesBetween(workWindow.start, start) / 60) * PX_PER_HOUR
  const heightPx = (interval: TimeInterval) =>
    (minutesBetween(interval.start, interval.end) / 60) * PX_PER_HOUR

  // Hour ticks on the hour, inside the window.
  const ticks: Date[] = []
  const firstTick = new Date(workWindow.start)
  if (firstTick.getMinutes() !== 0) {
    firstTick.setMinutes(60, 0, 0)
  }
  for (let t = firstTick.getTime(); t < workWindow.end.getTime(); t += 3_600_000) {
    ticks.push(new Date(t))
  }

  // All-day events sit above the strip rather than inside it.
  const timedEvents = day.events.filter((e) => !e.allDay)
  const allDayEvents = day.events.filter((e) => e.allDay)

  return (
    <div className={cn('', className)}>
      {allDayEvents.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allDayEvents.map((event) => (
            <span
              key={event.id}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold',
                event.busy ? 'bg-amber-50 text-amber-700' : 'bg-surface-3 text-ink-3'
              )}
            >
              {event.title}
              {!event.busy && <span className="text-ink-4 font-medium">free</span>}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {/* Hour gutter */}
        <div className="relative w-12 flex-shrink-0" style={{ height }}>
          {ticks.map((tick) => (
            <div
              key={tick.getTime()}
              className="absolute right-0 -translate-y-1/2 text-[11px] font-medium text-ink-4 tabular-nums"
              style={{ top: offsetPx(tick) }}
            >
              {formatInTimeZone(tick, timeZone, 'HH:mm')}
            </div>
          ))}
        </div>

        {/* The strip */}
        <div
          className="relative flex-1 rounded-2xl bg-surface-3 overflow-hidden"
          style={{ height }}
        >
          {ticks.map((tick) => (
            <div
              key={tick.getTime()}
              className="absolute left-0 right-0 border-t border-line"
              style={{ top: offsetPx(tick) }}
            />
          ))}

          {/* Free gaps — the planning surface */}
          {day.gaps.map((gap) => {
            const minutes = minutesBetween(gap.start, gap.end)
            return (
              <div
                key={gap.start.getTime()}
                className={cn(
                  'absolute left-1 right-1 rounded-xl bg-brand-50 border border-brand-200 overflow-hidden',
                  minutes < COMPACT_MINUTES ? 'px-2.5 py-0.5 flex items-center' : 'px-3 py-2'
                )}
                style={{ top: offsetPx(gap.start), height: Math.max(heightPx(gap), MIN_BLOCK_PX) }}
              >
                {minutes >= MIN_LABEL_MINUTES ? (
                  <>
                    <p className="text-[13px] font-semibold text-brand-600 leading-tight">
                      {formatDuration(minutes)} free
                    </p>
                    <p className="text-[11px] text-brand-600/70 tabular-nums">
                      {clockRange(gap, timeZone)}
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] font-semibold text-brand-600 leading-none truncate">
                    {formatDuration(minutes)} free
                    <span className="ml-1.5 font-medium text-brand-600/70 tabular-nums">
                      {formatInTimeZone(gap.start, timeZone, 'HH:mm')}
                    </span>
                  </p>
                )}
              </div>
            )
          })}

          {/* The Start Card's blocks: validated against the same gaps, so
              they sit inside them. Status changes the colour, never the shape. */}
          {blocks.map((block) => {
            const clamped = {
              start: new Date(Math.max(block.start.getTime(), workWindow.start.getTime())),
              end: new Date(Math.min(block.end.getTime(), workWindow.end.getTime())),
            }
            if (clamped.end <= clamped.start) return null
            const minutes = minutesBetween(clamped.start, clamped.end)
            const compact = minutes < COMPACT_MINUTES
            const tone =
              block.status === 'done'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : block.status === 'partial'
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : block.status === 'planned'
                    ? 'bg-brand-500 border-brand-600 text-white shadow-sm'
                    : 'bg-surface-2 border-line-strong text-ink-3'
            return (
              <div
                key={block.id}
                title={`${block.deliverable} · ${clockRange(block, timeZone)}`}
                className={cn(
                  'absolute left-2 right-2 rounded-xl overflow-hidden border',
                  compact ? 'px-2.5 py-0.5 flex items-center' : 'px-3 py-2',
                  tone
                )}
                style={{ top: offsetPx(clamped.start), height: Math.max(heightPx(clamped), MIN_BLOCK_PX) }}
              >
                <p className={cn('font-semibold leading-tight', compact ? 'text-[11px] truncate' : 'text-[13px] line-clamp-2')}>
                  {block.deliverable}
                </p>
                {!compact && minutes >= MIN_LABEL_MINUTES && (
                  <p className="text-[11px] opacity-80 tabular-nums">{clockRange(block, timeZone)}</p>
                )}
              </div>
            )
          })}

          {/* Calendar events.
              Busy events span the strip — by construction they never sit on a
              gap. Free events (transparency: transparent) do sit inside gaps,
              so they are inset to the right half, leaving the gap's own label
              readable underneath. */}
          {timedEvents.map((event) => {
            const clamped = {
              start: new Date(Math.max(event.start.getTime(), workWindow.start.getTime())),
              end: new Date(Math.min(event.end.getTime(), workWindow.end.getTime())),
            }
            if (clamped.end <= clamped.start) return null

            const minutes = minutesBetween(clamped.start, clamped.end)
            const compact = minutes < COMPACT_MINUTES
            const label = `${event.title} · ${clockRange(event, timeZone)}`

            return (
              <div
                key={event.id}
                title={label}
                className={cn(
                  'absolute rounded-xl overflow-hidden border',
                  compact ? 'px-2.5 py-0.5 flex items-center' : 'px-3 py-2',
                  event.busy
                    ? 'left-1 right-1 bg-white border-line shadow-xs'
                    : 'left-1/2 right-1 bg-surface-2/90 border-dashed border-line-strong backdrop-blur-[1px]'
                )}
                style={{
                  top: offsetPx(clamped.start),
                  height: Math.max(heightPx(clamped), MIN_BLOCK_PX),
                }}
              >
                <p
                  className={cn(
                    'font-semibold text-ink truncate leading-tight',
                    compact ? 'text-[11px]' : 'text-[13px]'
                  )}
                >
                  {event.title}
                  {compact && (
                    <span className="ml-1.5 font-medium text-ink-4 tabular-nums">
                      {formatInTimeZone(clamped.start, timeZone, 'HH:mm')}
                    </span>
                  )}
                </p>
                {!compact && minutes >= MIN_LABEL_MINUTES && (
                  <p className="text-[11px] text-ink-4 tabular-nums">
                    {clockRange(event, timeZone)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
