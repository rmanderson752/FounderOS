// src/components/ui/Avatar.tsx
// Round emoji avatar on a soft pastel bubble

import { cn } from '@/lib/utils'
import { getAvatarById } from './AvatarSelector'

interface AvatarProps {
  size?: 'sm' | 'md' | 'lg'
  avatarId?: string | null
  className?: string
  onClick?: () => void
}

export function Avatar({ size = 'md', avatarId, className, onClick }: AvatarProps) {
  const sizes = {
    sm: 'w-9 h-9 text-base',
    md: 'w-11 h-11 text-lg',
    lg: 'w-16 h-16 text-3xl',
  }

  const avatar = getAvatarById(avatarId || null)

  const sharedClasses = cn(
    'rounded-full bg-gradient-to-br flex items-center justify-center transition-all',
    'ring-1 ring-inset ring-ink/[0.06] shadow-xs',
    avatar.bg,
    sizes[size],
    className
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(sharedClasses, 'hover:scale-105 active:scale-95 cursor-pointer')}
      >
        <span>{avatar.emoji}</span>
      </button>
    )
  }

  return (
    <div className={sharedClasses}>
      <span>{avatar.emoji}</span>
    </div>
  )
}
