// src/components/ui/FocusMode.tsx
// Full-screen distraction-free focus mode for deep work
// Shows only the current task with a large timer

'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Play, Pause, Check, Coffee, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/database'

interface FocusModeProps {
  task: Task
  onComplete: (actualMinutes: number) => void
  onClose: () => void
  onSkip?: () => void
}

export function FocusMode({ task, onComplete, onClose, onSkip }: FocusModeProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showBreakPrompt, setShowBreakPrompt] = useState(false)

  const estimatedSeconds = (task.estimated_minutes || 30) * 60
  const progress = Math.min((elapsedSeconds / estimatedSeconds) * 100, 100)
  const isOvertime = elapsedSeconds > estimatedSeconds

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning])

  // Break prompt after 45 minutes
  useEffect(() => {
    if (elapsedSeconds > 0 && elapsedSeconds % (45 * 60) === 0 && isRunning) {
      setShowBreakPrompt(true)
      setIsRunning(false)
    }
  }, [elapsedSeconds, isRunning])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.target?.toString().includes('input')) {
        e.preventDefault()
        setIsRunning(prev => !prev)
      }
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const formatTime = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  const handleComplete = () => {
    const actualMinutes = Math.ceil(elapsedSeconds / 60)
    onComplete(actualMinutes)
  }

  const dismissBreakPrompt = () => {
    setShowBreakPrompt(false)
    setIsRunning(true)
  }

  return (
    <div className="fixed inset-0 bg-[#0A0A0B] z-50 flex flex-col">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 text-gray-500 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Task title */}
        <h1 className="text-2xl md:text-4xl font-bold text-white text-center max-w-2xl mb-8">
          {task.title}
        </h1>

        {/* Large timer */}
        <div className={cn(
          'text-7xl md:text-9xl font-mono font-bold mb-8 transition-colors',
          isOvertime ? 'text-amber-400' : 'text-white'
        )}>
          {formatTime(elapsedSeconds)}
        </div>

        {/* Progress ring */}
        <div className="relative w-64 h-64 mb-8">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="128"
              cy="128"
              r="120"
              fill="none"
              stroke="#1F1F23"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="128"
              cy="128"
              r="120"
              fill="none"
              stroke={isOvertime ? '#F59E0B' : '#3B82F6'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 120}
              strokeDashoffset={2 * Math.PI * 120 * (1 - progress / 100)}
              className="transition-all duration-1000"
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-gray-400 text-sm mb-1">Estimated</span>
            <span className="text-white text-xl font-semibold">
              {task.estimated_minutes} min
            </span>
            {isOvertime && (
              <span className="text-amber-400 text-sm mt-2">
                +{Math.ceil((elapsedSeconds - estimatedSeconds) / 60)} min over
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {onSkip && (
            <button
              onClick={onSkip}
              className="p-4 rounded-full bg-[#1A1A1E] text-gray-400 hover:text-white hover:bg-[#2A2A30] transition-colors"
              title="Skip task"
            >
              <SkipForward className="w-6 h-6" />
            </button>
          )}
          
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={cn(
              'p-6 rounded-full transition-all',
              isRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            )}
          >
            {isRunning ? (
              <Pause className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8 ml-1" />
            )}
          </button>

          <button
            onClick={handleComplete}
            className="p-4 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            title="Complete task"
          >
            <Check className="w-6 h-6" />
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center gap-6 mt-8 text-sm text-gray-500">
          <span>
            <kbd className="px-2 py-1 bg-[#1A1A1E] rounded text-gray-400">Space</kbd>
            {' '}Play/Pause
          </span>
          <span>
            <kbd className="px-2 py-1 bg-[#1A1A1E] rounded text-gray-400">Esc</kbd>
            {' '}Exit
          </span>
        </div>
      </div>

      {/* Break prompt modal */}
      {showBreakPrompt && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-[#141417] border border-[#1F1F23] rounded-xl p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Coffee className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Time for a break?</h2>
            <p className="text-gray-400 mb-6">
              You've been focused for 45 minutes. Taking short breaks helps maintain productivity.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={dismissBreakPrompt}
                className="px-4 py-2 bg-[#1A1A1E] text-white rounded-lg hover:bg-[#2A2A30] transition-colors"
              >
                Keep going
              </button>
              <button
                onClick={() => {
                  setShowBreakPrompt(false)
                  // Could add a 5-min break timer here
                }}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                Take 5 min break
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}