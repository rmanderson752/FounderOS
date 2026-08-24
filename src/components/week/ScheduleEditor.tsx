// src/components/week/ScheduleEditor.tsx
'use client'

import { useState, useEffect } from 'react'
import { Save, Check } from 'lucide-react'
import { useSchedule, useSaveSchedule } from '@/hooks/useSchedule'
import { DAY_NAMES } from '@/lib/constants'

interface DayConfig {
  day_of_week: number
  available_hours: number
  is_available: boolean
  notes: string
}

const DEFAULT_SCHEDULE: DayConfig[] = DAY_NAMES.map((_, i) => ({
  day_of_week: i,
  available_hours: i >= 1 && i <= 5 ? 8 : 3, // Mon-Fri 8hrs, Sat-Sun 3hrs
  is_available: true,
  notes: '',
}))

export function ScheduleEditor() {
  const { data: schedule, isLoading } = useSchedule()
  const saveSchedule = useSaveSchedule()
  const [days, setDays] = useState<DayConfig[]>(DEFAULT_SCHEDULE)
  const [saved, setSaved] = useState(false)

  // Load existing schedule
  useEffect(() => {
    if (schedule && schedule.length > 0) {
      const merged = DEFAULT_SCHEDULE.map(defaultDay => {
        const existing = schedule.find(s => s.day_of_week === defaultDay.day_of_week)
        if (existing) {
          return {
            day_of_week: existing.day_of_week,
            available_hours: Number(existing.available_hours),
            is_available: existing.is_available,
            notes: existing.notes || '',
          }
        }
        return defaultDay
      })
      setDays(merged)
    }
  }, [schedule])

  const totalHours = days.reduce((sum, d) => sum + (d.is_available ? d.available_hours : 0), 0)

  const updateDay = (index: number, updates: Partial<DayConfig>) => {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d))
    setSaved(false)
  }

  const handleSave = async () => {
    await saveSchedule.mutateAsync(days)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="h-12 bg-surface-3 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Schedule</h2>
          <p className="text-sm text-ink-3">Set your available hours per day</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-3">
            <span className="text-ink font-semibold">{totalHours}h</span> / week
          </span>
          <button
            onClick={handleSave}
            disabled={saveSchedule.isPending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {days.map((day, index) => (
          <div
            key={day.day_of_week}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              day.is_available
                ? 'bg-white border-line'
                : 'bg-canvas border-line opacity-50'
            }`}
          >
            {/* Toggle */}
            <button
              onClick={() => updateDay(index, { is_available: !day.is_available })}
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${
                day.is_available ? 'bg-blue-600' : 'bg-surface-3'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  day.is_available ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>

            {/* Day name */}
            <span className="text-sm font-medium text-ink w-24">
              {DAY_NAMES[day.day_of_week]}
            </span>

            {/* Hours input */}
            {day.is_available && (
              <>
                <input
                  type="number"
                  value={day.available_hours}
                  onChange={(e) => updateDay(index, {
                    available_hours: Math.max(0, Math.min(16, parseFloat(e.target.value) || 0))
                  })}
                  min="0"
                  max="16"
                  step="0.5"
                  className="w-16 bg-canvas border border-line-strong rounded-md px-2 py-1 text-sm text-ink text-center focus:outline-none focus:border-blue-500 transition-colors"
                />
                <span className="text-xs text-ink-4">hours</span>

                {/* Notes */}
                <input
                  type="text"
                  value={day.notes}
                  onChange={(e) => updateDay(index, { notes: e.target.value })}
                  placeholder="notes (optional)"
                  className="flex-1 bg-transparent border-none text-xs text-ink-4 placeholder:text-ink-4 focus:outline-none focus:text-ink-2"
                />
              </>
            )}

            {!day.is_available && (
              <span className="text-xs text-ink-4">Off</span>
            )}
          </div>
        ))}
      </div>

      {/* Hour bar visualization */}
      <div className="mt-4 p-3 bg-canvas border border-line rounded-lg">
        <div className="flex gap-1 h-8">
          {days.map((day) => (
            <div
              key={day.day_of_week}
              className="flex-1 flex flex-col items-center justify-end"
            >
              {day.is_available && day.available_hours > 0 && (
                <div
                  className="w-full bg-blue-600/30 rounded-sm mb-1"
                  style={{ height: `${(day.available_hours / 12) * 100}%` }}
                />
              )}
              <span className="text-[10px] text-ink-4">
                {DAY_NAMES[day.day_of_week].slice(0, 2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
