// src/components/settings/WorkWindowCard.tsx
//
// The clock boundaries gap math subtracts events from. One start and one end
// applied to the days you work; days switched off produce no card. Stored on
// schedule_constraints.work_start / work_end (migration 004). Null falls back
// to 09:00–19:00 in lib/calendar/gaps.

'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button, Input } from '@/components/ui'
import { useSchedule } from '@/hooks/useSchedule'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

export function WorkWindowCard() {
  const { data: schedule } = useSchedule()
  const queryClient = useQueryClient()
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('19:00')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!schedule || schedule.length === 0) return
    const first = schedule.find((s) => s.is_available) ?? schedule[0]
    const ws = (first as unknown as { work_start?: string | null }).work_start
    const we = (first as unknown as { work_end?: string | null }).work_end
    if (ws) setStart(ws.slice(0, 5))
    if (we) setEnd(we.slice(0, 5))
    setDays(schedule.filter((s) => s.is_available).map((s) => s.day_of_week))
  }, [schedule])

  const save = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const rows = DAYS.map((d) => ({
        user_id: user.id,
        day_of_week: d.value,
        is_available: days.includes(d.value),
        work_start: start,
        work_end: end,
      }))
      const { error } = await supabase.from('schedule_constraints').upsert(rows, { onConflict: 'user_id,day_of_week' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-ink-3" />
          <CardTitle>Work window</CardTitle>
        </div>
      </CardHeader>
      <div className="space-y-5">
        <p className="text-sm text-ink-3 leading-relaxed">
          Gaps are what is left after your events, inside this window. The card is never sized outside it.
        </p>
        <div className="flex items-center gap-3">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-32" />
          <span className="text-ink-4">to</span>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-32" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDays((prev) => (prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value]))}
              className={cn(
                'w-12 h-11 rounded-xl text-sm font-semibold transition',
                days.includes(d.value) ? 'bg-brand-500 text-white' : 'bg-surface-3 text-ink-3 hover:bg-surface-4'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {saved ? <><Check className="w-4 h-4 mr-2" /> Saved</> : 'Save window'}
        </Button>
      </div>
    </Card>
  )
}
