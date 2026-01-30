// src/components/ui/EmptyState.tsx
// Reusable empty state component for displaying placeholder content

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

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
  className 
}: EmptyStateProps) {
  const iconStyles = {
    default: 'bg-indigo-500/10 text-indigo-400',
    success: 'bg-emerald-500/10 text-emerald-400',
    minimal: 'bg-white/5 text-gray-500',
  }

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      <div className={cn(
        'w-14 h-14 rounded-2xl flex items-center justify-center mb-4',
        iconStyles[variant]
      )}>
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-sm mb-6">{description}</p>
      {action && (
        <Button 
          onClick={action.onClick}
          variant={variant === 'success' ? 'secondary' : 'primary'}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
