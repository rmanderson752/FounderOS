// src/components/ui/EmptyState.tsx
// Friendly empty state — big soft icon bubble, springy entrance

'use client'

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { motion } from 'framer-motion'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: 'default' | 'success' | 'minimal'
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const iconStyles = {
    default: 'bg-brand-50 text-brand-500',
    success: 'bg-emerald-50 text-emerald-600',
    minimal: 'bg-surface-3 text-ink-4',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex flex-col items-center justify-center py-14 px-4 text-center',
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.08, type: 'spring', stiffness: 300, damping: 16 }}
        className={cn(
          'w-20 h-20 rounded-[28px] flex items-center justify-center mb-5',
          iconStyles[variant]
        )}
      >
        <Icon className="w-9 h-9" strokeWidth={1.9} />
      </motion.div>
      <h3 className="text-xl font-semibold text-ink mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-ink-3 max-w-sm mb-7 leading-relaxed">{description}</p>
      {action && (
        <Button
          onClick={action.onClick}
          variant={variant === 'success' ? 'secondary' : 'primary'}
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  )
}
