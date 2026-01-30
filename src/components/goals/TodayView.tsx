// src/components/goals/TodayView.tsx
// Displays today's tasks with timer functionality
// Allows starting, pausing, and completing tasks with time tracking

'use client'

import { useState, useEffect } from 'react'
import { Play, Pause, Check, Clock, Zap, RotateCcw, Maximize2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button, FocusMode } from '@/components/ui'
import { Confetti } from '@/components/ui/Confetti'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/database'

interface TodayViewProps {
  tasks: Task[]
  dailyHours: number
  activeTaskId: string | null
  onStartTask: (taskId: string) => void
  onCompleteTask: (taskId: string, actualMinutes: number) => void
  onPauseTask: () => void
}

export function TodayView({
  tasks,
  dailyHours,
  activeTaskId,
  onStartTask,
  onCompleteTask,
  onPauseTask,
}: TodayViewProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null)
  const [focusModeTask, setFocusModeTask] = useState<Task | null>(null)

  const [showConfetti, setShowConfetti] = useState(false)
  const [confettiTaskId, setConfettiTaskId] = useState<string | null>(null)

  // Calculate today's planned time
  const todayMinutes = dailyHours * 60
  const plannedMinutes = tasks.reduce((sum, t) => sum + t.estimated_minutes, 0)
  const remainingSlots = todayMinutes - plannedMinutes

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (activeTaskId && timerStartTime) {
      interval = setInterval(() => {
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - timerStartTime.getTime()) / 1000)
        setElapsedSeconds(elapsed)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [activeTaskId, timerStartTime])

  const handleStartTask = (taskId: string) => {
    setTimerStartTime(new Date())
    setElapsedSeconds(0)
    onStartTask(taskId)
  }

  const handlePauseTask = () => {
    onPauseTask()
  }

  const handleCompleteTask = (taskId: string) => {
    const actualMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60))
    
    // Trigger confetti
    setConfettiTaskId(taskId)
    setShowConfetti(true)
    
    // Complete after a brief delay for visual effect
    setTimeout(() => {
      onCompleteTask(taskId, actualMinutes)
      setTimerStartTime(null)
      setElapsedSeconds(0)
    }, 100)
  }

  const handleQuickComplete = (taskId: string, estimatedMinutes: number) => {
    // Trigger confetti
    setConfettiTaskId(taskId)
    setShowConfetti(true)
    
    // Complete with estimated time
    setTimeout(() => {
      onCompleteTask(taskId, estimatedMinutes)
    }, 100)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const activeTask = tasks.find(t => t.id === activeTaskId)

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <CardTitle>Today's Focus</CardTitle>
        </div>
        <div className="text-sm text-gray-400">
          {dailyHours}h available today
        </div>
      </CardHeader>

      {/* Active Task Timer */}
      {activeTask && (
        <div className="relative mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg overflow-visible">
          <Confetti 
            active={showConfetti && confettiTaskId === activeTask.id} 
            onComplete={() => setShowConfetti(false)} 
          />
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-blue-400 font-medium">Working on:</span>
            <span className="text-3xl font-mono text-white">{formatTime(elapsedSeconds)}</span>
          </div>
          <p className="text-white font-medium mb-4">{activeTask.title}</p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePauseTask}
              className="flex-1"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
            <Button
              size="sm"
              onClick={() => handleCompleteTask(activeTask.id)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Done
            </Button>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-400">
              Estimated: {activeTask.estimated_minutes} min | 
              Elapsed: {Math.ceil(elapsedSeconds / 60)} min
            </div>
            <button
              onClick={() => setFocusModeTask(activeTask)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[#1A1A1E]"
              title="Focus mode"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No tasks scheduled for today</p>
            <p className="text-sm">Add tasks to get started</p>
          </div>
        ) : (
          tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              isActive={task.id === activeTaskId}
              isNext={index === 0 && !activeTaskId}
              onStart={() => handleStartTask(task.id)}
              onQuickComplete={() => handleQuickComplete(task.id, task.estimated_minutes)}
              disabled={!!activeTaskId && task.id !== activeTaskId}
              showConfetti={showConfetti && confettiTaskId === task.id}
              onConfettiComplete={() => setShowConfetti(false)}
            />
          ))
        )}
      </div>

      {/* Time Summary */}
      {tasks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#1F1F23]">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Remaining capacity:</span>
            <span className={cn(
              'font-medium',
              remainingSlots < 0 ? 'text-red-400' : 'text-blue-400'
            )}>
              {remainingSlots >= 0 
                ? `${Math.floor(remainingSlots / 60)}h ${remainingSlots % 60}m` 
                : `${Math.abs(Math.floor(remainingSlots / 60))}h ${Math.abs(remainingSlots % 60)}m over`
              }
            </span>
          </div>
        </div>
      )}
    </Card>

    {/* Focus Mode */}
    {focusModeTask && (
      <FocusMode
        task={focusModeTask}
        onComplete={(actualMinutes) => {
          onCompleteTask(focusModeTask.id, actualMinutes)
          setFocusModeTask(null)
        }}
        onClose={() => setFocusModeTask(null)}
      />
    )}
  </>
  )
}

// Individual task row component
interface TaskRowProps {
  task: Task
  isActive: boolean
  isNext: boolean
  onStart: () => void
  onQuickComplete: () => void
  disabled: boolean
  showConfetti: boolean
  onConfettiComplete: () => void
}

function TaskRow({ 
  task, 
  isActive, 
  isNext, 
  onStart, 
  onQuickComplete,
  disabled,
  showConfetti,
  onConfettiComplete,
}: TaskRowProps) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-3 p-3 rounded-lg transition-colors',
        isActive ? 'bg-blue-500/10 border border-blue-500/20' : 
        isNext ? 'bg-[#1A1A1E] border border-[#2A2A30]' : 
        'hover:bg-[#1A1A1E]'
      )}
    >
      <Confetti active={showConfetti} onComplete={onConfettiComplete} />
      
      {/* Play button or status */}
      <button
        onClick={onStart}
        disabled={disabled || isActive}
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
          isActive ? 'bg-blue-500 text-white' :
          disabled ? 'bg-gray-800 text-gray-600 cursor-not-allowed' :
          'bg-[#2A2A30] text-gray-400 hover:bg-blue-500 hover:text-white'
        )}
      >
        {isActive ? (
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-medium truncate',
          isActive ? 'text-white' : 'text-gray-200'
        )}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{task.estimated_minutes} min</span>
          {task.is_recurring && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                {task.recurrence_pattern}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Quick complete button */}
      {!isActive && !disabled && (
        <button
          onClick={onQuickComplete}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-green-500/20 hover:text-green-400 transition-colors"
          title="Mark complete"
        >
          <Check className="w-4 h-4" />
        </button>
      )}

      {/* Time estimate */}
      <div className="text-right">
        <span className={cn(
          'text-sm font-medium',
          isActive ? 'text-blue-400' : 'text-gray-400'
        )}>
          {Math.floor(task.estimated_minutes / 60) > 0 && `${Math.floor(task.estimated_minutes / 60)}h `}
          {task.estimated_minutes % 60}m
        </span>
      </div>
    </div>
  )
}