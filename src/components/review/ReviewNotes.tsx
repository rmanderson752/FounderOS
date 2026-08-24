// src/components/review/ReviewNotes.tsx
'use client'

interface ReviewNotesProps {
  value: string
  onChange: (value: string) => void
}

export function ReviewNotes({ value, onChange }: ReviewNotesProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">Reflection</h3>
      <p className="text-xs text-ink-3">
        What went well? What would you change? Any insights from this week?
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your weekly reflection..."
        rows={5}
        className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
      />
    </div>
  )
}
