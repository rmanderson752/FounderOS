// src/app/(dashboard)/week/page.tsx
'use client'

import { useState } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, addWeeks, subWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle, Circle, Play, Layers } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button, WeekSkeleton } from '@/components/ui'
import { useTasksFromAllGoals, useUpdateTask } from '@/hooks/useTasks'
import { useGoals } from '@/hooks/useGoals'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/database'

export default function WeekPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  
  const { data: tasks = [], isLoading } = useTasksFromAllGoals()
  const { data: goals = [] } = useGoals()
  const { data: user } = useUser()
  const updateTask = useUpdateTask()

  const dailyHours = user?.daily_hours_available || 6
  const workDays = user?.work_days || [1, 2, 3, 4, 5]

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Active goals count
  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'paused')

  // Group tasks
  const incompleteTasks = tasks.filter(t => t.status !== 'completed')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  // Tasks completed this week
  const completedThisWeek = completedTasks.filter(t => {
    if (!t.completed_at) return false
    const completedDate = new Date(t.completed_at)
    return completedDate >= weekStart && completedDate <= weekEnd
  })

  // Group completed by day
  const getTasksForDay = (day: Date) => {
    return completedThisWeek.filter(t => {
      if (!t.completed_at) return false
      return isSameDay(new Date(t.completed_at), day)
    })
  }

  // Stats
  const totalRemainingMinutes = incompleteTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
  const totalCompletedMinutes = completedThisWeek.reduce((sum, t) => sum + (t.actual_minutes || t.estimated_minutes || 0), 0)
  const workDaysThisWeek = daysOfWeek.filter(d => workDays.includes(d.getDay()))
  const remainingWorkDays = workDaysThisWeek.filter(d => d >= new Date()).length
  const weeklyCapacity = workDaysThisWeek.length * dailyHours * 60

  const handleCompleteTask = async (taskId: string) => {
    await updateTask.mutateAsync({
      id: taskId,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
  }

  const handleUncompleteTask = async (taskId: string) => {
    await updateTask.mutateAsync({
      id: taskId,
      status: 'todo',
      completed_at: null,
    })
  }

  // Group incomplete tasks by goal for better organization
  const tasksByGoal = incompleteTasks.reduce((acc, task) => {
    const goalId = task.goal_id || 'no-goal'
    if (!acc[goalId]) {
      acc[goalId] = []
    }
    acc[goalId].push(task)
    return acc
  }, {} as Record<string, typeof incompleteTasks>)

  if (isLoading) {
    return <WeekSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Week View</h1>
          <p className="text-gray-400 mt-1">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* All Goals Indicator */}
      {activeGoals.length > 1 && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Showing tasks from <span className="text-white font-medium">{activeGoals.length} goals</span></span>
        </div>
      )}

      {/* Week Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">To Complete</div>
          <div className="text-2xl font-bold text-white mt-1">
            {incompleteTasks.length} tasks
          </div>
          <div className="text-sm text-gray-400">
            {Math.floor(totalRemainingMinutes / 60)}h {totalRemainingMinutes % 60}m estimated
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Completed</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {completedThisWeek.length} tasks
          </div>
          <div className="text-sm text-gray-400">
            {Math.floor(totalCompletedMinutes / 60)}h {totalCompletedMinutes % 60}m logged
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Week Capacity</div>
          <div className="text-2xl font-bold text-white mt-1">
            {Math.floor(weeklyCapacity / 60)}h
          </div>
          <div className="text-sm text-gray-400">
            {workDaysThisWeek.length} work days × {dailyHours}h
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Days Left</div>
          <div className="text-2xl font-bold text-white mt-1">
            {remainingWorkDays} days
          </div>
          <div className="text-sm text-gray-400">
            {remainingWorkDays * dailyHours}h remaining capacity
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Backlog - Grouped by Goal */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backlog</CardTitle>
              <span className="text-sm text-gray-400">{incompleteTasks.length} tasks</span>
            </CardHeader>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {incompleteTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">All caught up!</p>
                </div>
              ) : (
                Object.entries(tasksByGoal).map(([goalId, goalTasks]) => {
                  const goal = goals.find(g => g.id === goalId)
                  return (
                    <div key={goalId}>
                      {/* Goal header - only show if multiple goals */}
                      {activeGoals.length > 1 && goal && (
                        <div className="flex items-center gap-2 mb-2 px-2">
                          <div className={cn(
                            'w-2 h-2 rounded-full',
                            goal.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                          )} />
                          <span className="text-xs font-medium text-gray-400 truncate">
                            {goal.title}
                          </span>
                        </div>
                      )}
                      <div className="space-y-1">
                        {goalTasks.map(task => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onComplete={() => handleCompleteTask(task.id)}
                            showGoalIndicator={false}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        {/* Week Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">This Week</CardTitle>
            </CardHeader>

            <div className="grid grid-cols-7 gap-2">
              {daysOfWeek.map(day => {
                const dayTasks = getTasksForDay(day)
                const isWorkDay = workDays.includes(day.getDay())
                const isDayToday = isToday(day)
                const isPast = day < new Date() && !isDayToday
                const dayMinutes = dayTasks.reduce((sum, t) => sum + (t.actual_minutes || t.estimated_minutes || 0), 0)

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'p-2 rounded-xl min-h-[120px] transition-colors border',
                      isDayToday 
                        ? 'bg-white/10 border-indigo-500/30' 
                        : isWorkDay 
                          ? 'bg-white/5 border-transparent' 
                          : 'bg-white/[0.02] border-dashed border-white/10',
                      isPast && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        'text-xs font-medium',
                        isDayToday ? 'text-indigo-400' : 'text-gray-400'
                      )}>
                        {format(day, 'EEE')}
                      </span>
                      <span className={cn(
                        'text-sm font-semibold',
                        isDayToday ? 'text-white' : 'text-gray-300'
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {dayTasks.length > 0 ? (
                      <div className="space-y-1">
                        {dayTasks.slice(0, 3).map(task => (
                          <div
                            key={task.id}
                            className="text-xs p-1.5 rounded bg-emerald-500/10 text-emerald-400 truncate cursor-pointer hover:bg-emerald-500/20"
                            onClick={() => handleUncompleteTask(task.id)}
                            title={task.title}
                          >
                            {task.title}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
                      </div>
                    ) : isWorkDay ? (
                      <div className="text-xs text-gray-600 text-center mt-4">
                        {isPast ? 'No tasks' : `${dailyHours}h available`}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-700 text-center mt-4">
                        Off
                      </div>
                    )}

                    {dayMinutes > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        {Math.floor(dayMinutes / 60)}h {dayMinutes % 60}m
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Goals Context - Show all active goals */}
      {activeGoals.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span className="font-medium text-white">Active Goals</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeGoals.map(goal => (
              <div 
                key={goal.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5"
              >
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  goal.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{goal.title}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(goal.deadline), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

interface TaskRowProps {
  task: Task
  onComplete: () => void
  showGoalIndicator?: boolean
}

function TaskRow({ task, onComplete, showGoalIndicator }: TaskRowProps) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 group">
      <button
        onClick={onComplete}
        className="w-5 h-5 rounded-full border-2 border-gray-600 hover:border-emerald-500 hover:bg-emerald-500/10 transition-colors flex items-center justify-center"
      >
        <CheckCircle className="w-3 h-3 text-transparent group-hover:text-emerald-500" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{task.title}</p>
      </div>
      <span className="text-xs text-gray-500">
        {task.estimated_minutes}m
      </span>
    </div>
  )
}