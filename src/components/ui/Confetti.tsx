// src/components/ui/Confetti.tsx
// Lightweight confetti burst animation for celebrating task completion
// Renders particles that animate outward and fade using inline styles

'use client'

import { useEffect, useState } from 'react'

interface ConfettiProps {
  active: boolean
  onComplete?: () => void
}

const PARTICLE_COUNT = 12
const COLORS = [
  '#60A5FA', // blue-400
  '#3B82F6', // blue-500
  '#C084FC', // purple-400
  '#A855F7', // purple-500
  '#4ADE80', // green-400
  '#FBBF24', // amber-400
]

export function Confetti({ active, onComplete }: ConfettiProps) {
  const [particles, setParticles] = useState<Array<{
    id: number
    color: string
    x: number
    y: number
    size: number
  }>>([])

  useEffect(() => {
    if (active) {
      // Generate particles with random directions
      const newParticles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (360 / PARTICLE_COUNT) * i + Math.random() * 30
        const velocity = 40 + Math.random() * 40
        const radians = (angle * Math.PI) / 180
        
        return {
          id: i,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          x: Math.cos(radians) * velocity,
          y: Math.sin(radians) * velocity,
          size: 4 + Math.random() * 4,
        }
      })
      setParticles(newParticles)

      // Clear after animation
      const timer = setTimeout(() => {
        setParticles([])
        onComplete?.()
      }, 600)

      return () => clearTimeout(timer)
    }
  }, [active, onComplete])

  if (particles.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute left-1/2 top-1/2 rounded-full animate-confetti-particle"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            '--tx': `${particle.x}px`,
            '--ty': `${particle.y}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}