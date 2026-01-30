import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}

const badgeVariants = {
  success: 'bg-green-500/10 text-green-400',
  warning: 'bg-amber-500/10 text-amber-400',
  error: 'bg-red-500/10 text-red-400',
  info: 'bg-blue-500/10 text-blue-400',
  neutral: 'bg-gray-500/10 text-gray-400',
}

function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }
