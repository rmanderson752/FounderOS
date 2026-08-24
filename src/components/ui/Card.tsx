// src/components/ui/Card.tsx
// Soft Paper card — white, generously rounded, feather-light shadow

import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  glow?: 'none' | 'indigo' | 'success' | 'warning'
  variant?: 'default' | 'elevated' | 'inset' | 'plain'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = false, glow = 'none', variant = 'default', children, ...props }, ref) => {
    const glowClasses = {
      none: '',
      indigo: 'glow-indigo',
      success: 'glow-success',
      warning: 'glow-warning',
    }

    const variantClasses = {
      default: hover ? 'glass-card' : 'glass-card-static',
      elevated: 'surface-elevated',
      inset: 'surface-inset',
      plain: 'bg-white rounded-3xl border border-line',
    }

    return (
      <div
        ref={ref}
        className={cn(variantClasses[variant], 'p-6', glowClasses[glow], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between mb-4', className)}
      {...props}
    >
      {children}
    </div>
  )
)

CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-[17px] font-semibold text-ink tracking-tight', className)}
      {...props}
    >
      {children}
    </h3>
  )
)

CardTitle.displayName = 'CardTitle'

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props}>
      {children}
    </div>
  )
)

CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardContent }
