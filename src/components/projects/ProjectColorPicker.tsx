// src/components/projects/ProjectColorPicker.tsx
'use client'

import { PROJECT_COLORS } from '@/lib/constants'
import { Check } from 'lucide-react'

interface ProjectColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ProjectColorPicker({ value, onChange }: ProjectColorPickerProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-ink-3">Color</label>
      <div className="flex flex-wrap gap-2">
        {PROJECT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className="relative w-8 h-8 rounded-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0A0A0B]"
            style={{ backgroundColor: color }}
          >
            {value === color && (
              <Check className="w-4 h-4 text-ink absolute inset-0 m-auto" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
