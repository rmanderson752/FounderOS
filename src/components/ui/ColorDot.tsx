// src/components/ui/ColorDot.tsx
'use client'

interface ColorDotProps {
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-5 h-5',
}

export function ColorDot({ color, size = 'md', className = '' }: ColorDotProps) {
  return (
    <div
      className={`rounded-full flex-shrink-0 ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
    />
  )
}
