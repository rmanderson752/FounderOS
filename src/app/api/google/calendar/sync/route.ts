// src/app/api/google/calendar/sync/route.ts
// Push template blocks to Google Calendar as events
// Creates events for the next 4 weeks based on the weekly template

import { createClient } from '@/lib/supabase/server'
import { getValidToken } from '@/lib/google/auth'
import { createEvent, updateEvent, deleteEvent } from '@/lib/google/calendar'
import { getGcalColorId } from '@/lib/google/types'
import type { CalendarEvent } from '@/lib/google/types'
import { NextResponse } from 'next/server'
import { addDays, startOfWeek, format, setHours, setMinutes } from 'date-fns'

const FOUNDER_OS_TAG = 'founder-os-block'
const WEEKS_TO_SYNC = 4

/**
 * Calculate start and end times for a template block on a specific date.
 * Morning: 9am-1pm, Afternoon: 1pm-5pm, Full: 9am-5pm
 * Adjusted by schedule constraints if available.
 */
function getBlockTimes(
  date: Date,
  slot: 'morning' | 'afternoon' | 'full',
  hours: number
): { start: Date; end: Date } {
  let startHour: number
  let endHour: number

  switch (slot) {
    case 'morning':
      startHour = 9
      endHour = 9 + hours
      break
    case 'afternoon':
      startHour = 13
      endHour = 13 + hours
      break
    case 'full':
      startHour = 9
      endHour = 9 + hours
      break
  }

  const start = setMinutes(setHours(date, startHour), 0)
  const end = setMinutes(setHours(date, Math.min(endHour, 23)), 0)

  return { start, end }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get valid token
    const token = await getValidToken(user.id)
    if (!token) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
    }

    // Get calendar ID
    const { data: tokenRow } = await supabase
      .from('google_calendar_tokens')
      .select('calendar_id')
      .eq('user_id', user.id)
      .single()

    const calendarId = tokenRow?.calendar_id || 'primary'

    // Get template blocks with project info
    const { data: blocks, error: blocksError } = await supabase
      .from('template_blocks')
      .select('*, projects(name, color)')
      .eq('user_id', user.id)
      .order('day_of_week', { ascending: true })

    if (blocksError) throw blocksError

    if (!blocks || blocks.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No template blocks to sync' })
    }

    // Calculate the date range: current week start + 4 weeks
    const today = new Date()
    const weekStart = startOfWeek(today, { weekStartsOn: 0 }) // Sunday

    let created = 0
    let updated = 0
    let deleted = 0

    // Track which block IDs we've processed (to find orphans)
    const processedBlockIds = new Set<string>()

    // For each week in the sync range
    for (let weekOffset = 0; weekOffset < WEEKS_TO_SYNC; weekOffset++) {
      const currentWeekStart = addDays(weekStart, weekOffset * 7)

      // For each template block
      for (const block of blocks) {
        processedBlockIds.add(block.id)

        const project = block.projects as { name: string; color: string } | null
        const projectName = project?.name || 'Block'
        const projectColor = project?.color || '#3B82F6'

        // Calculate the actual date for this block in this week
        const blockDate = addDays(currentWeekStart, block.day_of_week)

        // Skip dates in the past
        if (blockDate < today && format(blockDate, 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd')) {
          continue
        }

        const { start, end } = getBlockTimes(blockDate, block.slot, block.hours)
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

        const event: CalendarEvent = {
          summary: `${projectName}`,
          description: `Founder OS block — ${block.hours}h\n${block.slot} slot`,
          start: {
            dateTime: start.toISOString(),
            timeZone,
          },
          end: {
            dateTime: end.toISOString(),
            timeZone,
          },
          colorId: getGcalColorId(projectColor),
          extendedProperties: {
            private: {
              [FOUNDER_OS_TAG]: 'true',
              blockId: block.id,
              weekOffset: String(weekOffset),
            },
          },
        }

        // For the first week: use the stored gcal_event_id to update
        if (weekOffset === 0 && block.gcal_event_id) {
          try {
            await updateEvent(token, calendarId, block.gcal_event_id, event)
            updated++
          } catch {
            // If update fails (event deleted externally), create new
            const newEventId = await createEvent(token, calendarId, event)
            await supabase
              .from('template_blocks')
              .update({ gcal_event_id: newEventId })
              .eq('id', block.id)
            created++
          }
        } else if (weekOffset === 0) {
          // First week, no existing event — create
          const newEventId = await createEvent(token, calendarId, event)
          await supabase
            .from('template_blocks')
            .update({ gcal_event_id: newEventId })
            .eq('id', block.id)
          created++
        } else {
          // Future weeks — always create (no tracking for future weeks)
          await createEvent(token, calendarId, event)
          created++
        }
      }
    }

    // Find and delete orphaned events
    // (blocks that were removed from template but still have gcal_event_id)
    const { data: orphanedBlocks } = await supabase
      .from('template_blocks')
      .select('id, gcal_event_id')
      .eq('user_id', user.id)
      .not('gcal_event_id', 'is', null)

    if (orphanedBlocks) {
      for (const orphan of orphanedBlocks) {
        if (!processedBlockIds.has(orphan.id) && orphan.gcal_event_id) {
          try {
            await deleteEvent(token, calendarId, orphan.gcal_event_id)
            deleted++
          } catch {
            // Ignore delete failures
          }
        }
      }
    }

    // Update last synced timestamp
    await supabase
      .from('google_calendar_tokens')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      created,
      updated,
      deleted,
      total: blocks.length,
    })
  } catch (error) {
    console.error('Calendar sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}
