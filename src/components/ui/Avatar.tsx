// src/components/ui/Avatar.tsx
// Sleek avatar component with emoji icons

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
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-lg',
    lg: 'w-16 h-16 text-3xl',
  }

  const avatar = getAvatarById(avatarId || null)

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'rounded-full bg-gradient-to-br flex items-center justify-center transition-all border border-white/10',
        avatar.bg,
        sizes[size],
        onClick && 'hover:scale-105 hover:border-white/20 cursor-pointer',
        !onClick && 'cursor-default',
        className
      )}
    >
      <span className="drop-shadow-md">{avatar.emoji}</span>
    </button>
  )
}