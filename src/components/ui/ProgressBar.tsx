// src/components/ui/ProgressBar.tsx
// Chunky rounded progress track with a soft gradient fill

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function ProgressBar({
  value,
  max = 100,
  className,
  variant = 'default',
  showLabel = false,
  size = 'md',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  const gradients = {
    default: 'bg-gradient-to-r from-brand-400 to-brand-500',
    success: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    warning: 'bg-gradient-to-r from-amber-500 to-orange-500',
    danger: 'bg-gradient-to-r from-rose-500 to-red-500',
  }

  const sizes = {
    sm: 'h-2',
    md: 'h-2.5',
    lg: 'h-3.5',
  }

  return (
    <div className={cn('relative', className)}>
      <div className={cn('bg-surface-3 rounded-full overflow-hidden', sizes[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700 ease-out',
            gradients[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-3 ml-2">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  )
}
