// src/components/ui/Card.tsx
// Premium glass-morphism card with subtle animations

import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  glow?: 'none' | 'indigo' | 'success' | 'warning'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = false, glow = 'none', children, ...props }, ref) => {
    const glowClasses = {
      none: '',
      indigo: 'glow-indigo',
      success: 'glow-success', 
      warning: 'glow-warning',
    }

    return (
      <div
        ref={ref}
        className={cn(
          hover ? 'glass-card' : 'glass-card-static',
          'p-5',
          glowClasses[glow],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between mb-4', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('text-lg font-semibold text-white', className)}
        {...props}
      >
        {children}
      </h3>
    )
  }
)

CardTitle.displayName = 'CardTitle'

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('', className)} {...props}>
        {children}
      </div>
    )
  }
)

CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardContent }