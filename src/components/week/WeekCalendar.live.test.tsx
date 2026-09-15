// Renders the real week (from the running dev server, via the CLI token) to a
// string with react-dom/server. Catches runtime errors the typecheck cannot.
//   RUN_LIVE=1 FOS_TOKEN=… npx vitest run src/components/week/WeekCalendar.live.test.tsx
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { WeekCalendar } from './WeekCalendar'
import { reviveWeek } from '@/hooks/useWeek'

const live = process.env.RUN_LIVE === '1' && !!process.env.FOS_TOKEN

describe.skipIf(!live)('WeekCalendar (live render)', () => {
  it('renders the current week without throwing', async () => {
    const res = await fetch('http://localhost:3000/api/week', { headers: { authorization: `Bearer ${process.env.FOS_TOKEN}` } })
    expect(res.ok).toBe(true)
    const week = reviveWeek(await res.json())
    const html = renderToString(React.createElement(WeekCalendar, { week, onMove: () => {}, onResize: () => {} }))
    expect(html).toContain('Goal work')
    for (const b of week.blocks) expect(html).toContain(b.title.slice(0, 20).replace(/&/g, '&amp;').replace(/'/g, '&#x27;'))
    console.log(`rendered ${week.blocks.length} blocks, ${html.length} chars`)
  }, 60_000)
})
