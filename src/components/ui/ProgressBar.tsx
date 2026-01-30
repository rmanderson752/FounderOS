// src/components/ui/ProgressBar.tsx
// Animated gradient progress bar with shimmer effect

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
    default: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500',
    success: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    warning: 'bg-gradient-to-r from-amber-500 to-orange-400',
    danger: 'bg-gradient-to-r from-rose-500 to-pink-500',
  }

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }

  return (
    <div className={cn('relative', className)}>
      <div className={cn(
        'bg-white/5 rounded-full overflow-hidden',
        sizes[size]
      )}>
        <div 
          className={cn(
            'h-full rounded-full relative overflow-hidden transition-all duration-500 ease-out',
            gradients[variant]
          )}
          style={{ width: `${percentage}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
        </div>
      </div>
      {showLabel && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-medium text-white ml-2">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  )
}