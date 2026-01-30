// src/app/(dashboard)/progress/page.tsx
'use client'

import { useState } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from 'date-fns'
import { Clock, TrendingUp, CheckCircle, Target, AlertCircle, Info, Layers } from 'lucide-react'
import { Card, CardHeader, CardTitle, ProgressSkeleton } from '@/components/ui'
import { useAllTasks, useTasksFromAllGoals } from '@/hooks/useTasks'
import { useActiveGoal, useGoals } from '@/hooks/useGoals'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'

export default function ProgressPage() {
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week')
  const [viewMode, setViewMode] = useState<'active' | 'all'>('active')
  
  const { data: activeGoalTasks = [], isLoading: activeTasksLoading } = useAllTasks()
  const { data: allGoalsTasks = [], isLoading: allTasksLoading } = useTasksFromAllGoals()
  const { data: goal } = useActiveGoal()
  const { data: goals = [] } = useGoals()
  const { data: user, isLoading: userLoading } = useUser()

  // Use appropriate tasks based on view mode
  const tasks = viewMode === 'active' ? activeGoalTasks : allGoalsTasks
  const isLoading = viewMode === 'active' ? activeTasksLoading : allTasksLoading

  const dailyHours = user?.daily_hours_available || 6
  const workDays = user?.work_days || [1, 2, 3, 4, 5]

  // Get completed tasks
  const completedTasks = tasks.filter(t => t.status === 'completed' && t.completed_at)
  
  // Calculate stats
  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
  const totalActual = completedTasks.reduce((sum, t) => sum + (t.actual_minutes || t.estimated_minutes || 0), 0)
  
  // This week's data
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const thisWeekCompleted = completedTasks.filter(t => {
    if (!t.completed_at) return false
    const completedDate = new Date(t.completed_at)
    return completedDate >= weekStart && completedDate <= weekEnd
  })

  const thisWeekMinutes = thisWeekCompleted.reduce((sum, t) => sum + (t.actual_minutes || t.estimated_minutes || 0), 0)
  const plannedWeekMinutes = workDays.length * dailyHours * 60

  // Daily breakdown for chart
  const dailyData = daysOfWeek.map(day => {
    const dayTasks = completedTasks.filter(t => {
      if (!t.completed_at) return false
      const completedDate = new Date(t.completed_at)
      return format(completedDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    })
    const actual = dayTasks.reduce((sum, t) => sum + (t.actual_minutes || t.estimated_minutes || 0), 0)
    const isWorkDay = workDays.includes(day.getDay())
    const planned = isWorkDay ? dailyHours * 60 : 0
    
    return {
      date: day,
      planned,
      actual,
      isWorkDay,
    }
  })

  const completionRate = plannedWeekMinutes > 0 
    ? Math.round((thisWeekMinutes / plannedWeekMinutes) * 100) 
    : 0

  const averageDaily = thisWeekCompleted.length > 0
    ? Math.round(thisWeekMinutes / Math.max(1, dailyData.filter(d => d.actual > 0).length))
    : 0

  // Recently completed (last 10)
  const recentlyCompleted = completedTasks
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 10)

  // Count goals with tasks
  const activeGoalsCount = goals.filter(g => g.status === 'active' || g.status === 'paused').length

  if (isLoading || userLoading) {
    return <ProgressSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Progress</h1>
          <p className="text-gray-400 mt-1">Track your time and see how you're doing</p>
        </div>
        
        {/* View Mode Toggle */}
        {activeGoalsCount > 1 && (
          <div className="flex items-center gap-2 p-1 rounded-lg bg-white/5 border border-white/10">
            <button
              onClick={() => setViewMode('active')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'active'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Target className="w-4 h-4" />
              Active Goal
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === 'all'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Layers className="w-4 h-4" />
              All Goals
            </button>
          </div>
        )}
      </div>

      {/* Current View Indicator */}
      {viewMode === 'active' && goal && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Target className="w-4 h-4 text-indigo-400" />
          <span>Showing progress for: <span className="text-white font-medium">{goal.title}</span></span>
        </div>
      )}
      {viewMode === 'all' && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Showing progress for: <span className="text-white font-medium">All {activeGoalsCount} goals</span></span>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="This Week"
          value={`${Math.floor(thisWeekMinutes / 60)}h ${thisWeekMinutes % 60}m`}
          sublabel={`of ${Math.floor(plannedWeekMinutes / 60)}h planned`}
        />
        <StatCard
          icon={TrendingUp}
          label="Daily Average"
          value={`${Math.floor(averageDaily / 60)}h ${averageDaily % 60}m`}
          sublabel="per day"
        />
        <StatCard
          icon={Target}
          label="Completion Rate"
          value={`${completionRate}%`}
          sublabel="of planned time"
          highlight={completionRate >= 80}
        />
        <StatCard
          icon={CheckCircle}
          label="Tasks Completed"
          value={thisWeekCompleted.length.toString()}
          sublabel="this week"
        />
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Time Logged</CardTitle>
          <div className="flex gap-2">
            {['week', 'month'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as 'week' | 'month')}
                className={cn(
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  timeRange === range
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </CardHeader>

        {/* Bar chart */}
        <div className="flex items-end gap-2 h-40 mt-4">
          {dailyData.map((day, index) => {
            const maxValue = Math.max(
              ...dailyData.map(d => Math.max(d.planned, d.actual)),
              dailyHours * 60
            )
            const plannedHeight = maxValue > 0 ? (day.planned / maxValue) * 100 : 0
            const actualHeight = maxValue > 0 ? (day.actual / maxValue) * 100 : 0
            const isDayToday = isToday(day.date)

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-1 h-32 items-end justify-center">
                  {day.isWorkDay && (
                    <div
                      className="w-3 bg-gray-700 rounded-t"
                      style={{ height: `${plannedHeight}%` }}
                    />
                  )}
                  <div
                    className={cn(
                      'w-3 rounded-t transition-all',
                      day.actual >= day.planned && day.planned > 0 ? 'bg-green-500' : 'bg-blue-500',
                      day.actual === 0 && 'bg-gray-700'
                    )}
                    style={{ height: `${Math.max(actualHeight, day.actual > 0 ? 5 : 0)}%` }}
                  />
                </div>
                <span className={cn(
                  'text-xs',
                  isDayToday ? 'text-white font-medium' : 'text-gray-500'
                )}>
                  {format(day.date, 'EEE')}
                </span>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-700 rounded" />
            <span>Planned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span>Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span>Goal met</span>
          </div>
        </div>
      </Card>

      {/* Recent Completions */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Completed</CardTitle>
        </CardHeader>

        {recentlyCompleted.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No completed tasks yet</p>
            <p className="text-sm">Complete a task to see it here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentlyCompleted.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{task.title}</p>
                  <p className="text-xs text-gray-500">
                    {task.completed_at && format(new Date(task.completed_at), 'MMM d')} • {task.actual_minutes || task.estimated_minutes} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>

        <div className="space-y-4">
          {completedTasks.length === 0 ? (
            <InsightItem
              type="info"
              title="Get started"
              description="Complete some tasks to see insights about your productivity patterns."
            />
          ) : completionRate >= 80 ? (
            <InsightItem
              type="success"
              title="You're on track!"
              description="You've completed 80%+ of your planned time this week. Keep it up!"
            />
          ) : completionRate >= 50 ? (
            <InsightItem
              type="warning"
              title="Making progress"
              description={`You've completed ${completionRate}% of planned time. Keep pushing!`}
            />
          ) : (
            <InsightItem
              type="danger"
              title="Behind schedule"
              description="Consider reducing your daily commitments or extending your deadline."
            />
          )}

          {averageDaily > dailyHours * 60 && (
            <InsightItem
              type="info"
              title="High workload"
              description={`Averaging ${Math.floor(averageDaily / 60)}h ${averageDaily % 60}m/day. Remember to take breaks!`}
            />
          )}

          {viewMode === 'active' && goal && (
            <InsightItem
              type="info"
              title="Goal progress"
              description={`${Math.round((totalActual / Math.max(totalEstimated, 1)) * 100)}% of total estimated time completed for "${goal.title}"`}
            />
          )}
          
          {viewMode === 'all' && (
            <InsightItem
              type="info"
              title="Overall progress"
              description={`${Math.round((totalActual / Math.max(totalEstimated, 1)) * 100)}% of total estimated time completed across all goals`}
            />
          )}
        </div>
      </Card>
    </div>
  )
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string
  sublabel: string
  highlight?: boolean
}

function StatCard({ icon: Icon, label, value, sublabel, highlight }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          highlight ? 'bg-emerald-500/10' : 'bg-blue-500/10'
        )}>
          <Icon className={cn('w-4 h-4', highlight ? 'text-emerald-400' : 'text-blue-400')} />
        </div>
      </div>
      <div className="mt-3">
        <div className={cn('text-2xl font-bold', highlight ? 'text-emerald-400' : 'text-white')}>
          {value}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        <div className="text-xs text-gray-600">{sublabel}</div>
      </div>
    </Card>
  )
}

interface InsightItemProps {
  type: 'success' | 'warning' | 'danger' | 'info'
  title: string
  description: string
}

function InsightItem({ type, title, description }: InsightItemProps) {
  const icons = {
    success: CheckCircle,
    warning: AlertCircle,
    danger: AlertCircle,
    info: Info,
  }
  const colors = {
    success: 'border-emerald-500/20 bg-emerald-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    danger: 'border-red-500/20 bg-red-500/5',
    info: 'border-blue-500/20 bg-blue-500/5',
  }
  const iconColors = {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
    info: 'text-blue-400',
  }

  const Icon = icons[type]

  return (
    <div className={cn('p-4 rounded-lg border', colors[type])}>
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 mt-0.5', iconColors[type])} />
        <div>
          <p className="font-medium text-white">{title}</p>
          <p className="text-sm text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  )
}