// src/app/(dashboard)/page.tsx
// Main dashboard page - displays current goal, today's tasks, and progress
// This is the primary view users see when they open the app

'use client'

import { useState, useEffect } from 'react'
import { format, differenceInDays } from 'date-fns'
import { Target, Clock, Plus, ListTodo, PartyPopper, Rocket } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button, EmptyState, ProgressBar, DashboardSkeleton } from '@/components/ui'
import { GoalSetup } from '@/components/goals/GoalSetup'
import { TodayView } from '@/components/goals/TodayView'
import { TaskList } from '@/components/goals/TaskList'
import { useActiveGoal, useCreateGoal, useUpdateGoal } from '@/hooks/useGoals'
import { useAllTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { useUser } from '@/hooks/useUser'
import type { Goal, Task } from '@/types/database'
import { useToast } from '@/components/ui/Toast'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export default function DashboardPage() {
  const [showGoalSetup, setShowGoalSetup] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [showAddTaskInline, setShowAddTaskInline] = useState(false)

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: () => setShowAddTaskInline(true),
    onNewGoal: () => setShowGoalSetup(true),
  })

  // Get user settings
  const { data: user } = useUser()
  const dailyHours = user?.daily_hours_available || 6

  // Real data from Supabase
  const { data: goal, isLoading: goalLoading } = useActiveGoal()
  const { data: tasks = [], isLoading: tasksLoading } = useAllTasks()
  
  // Mutations
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  // Notifications
  const { addToast } = useToast()

  // Calculate stats
  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
  const totalCompleted = tasks
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
  const remainingMinutes = totalEstimated - totalCompleted
  const progressPercent = totalEstimated > 0 ? Math.round((totalCompleted / totalEstimated) * 100) : 0

  // Days until deadline
  const daysRemaining = goal ? Math.max(0, differenceInDays(new Date(goal.deadline), new Date())) : 0
  const hoursPerDay = daysRemaining > 0 
    ? Math.round((remainingMinutes / 60 / daysRemaining) * 10) / 10 
    : remainingMinutes > 0 ? Infinity : 0

  // Today's tasks (incomplete, prioritized)
  const todaysTasks = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => (a.priority || 0) - (b.priority || 0))

  // Check if all tasks are done
  const allTasksCompleted = tasks.length > 0 && todaysTasks.length === 0

  if (goalLoading || tasksLoading) {
    return <DashboardSkeleton />
  }

  // No goal - show setup prompt
  if (!goal && !showGoalSetup) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="p-8">
          <EmptyState
            icon={Target}
            title="Set your goal"
            description="What do you want to accomplish? Set a goal with a deadline and we'll help you break it down and stay on track."
            action={{
              label: 'Set Goal',
              onClick: () => setShowGoalSetup(true),
            }}
          />
        </Card>
      </div>
    )
  }

  // Goal setup flow
  if (showGoalSetup) {
    return (
      <GoalSetup
        onComplete={async (newGoal) => {
          await createGoal.mutateAsync({
            title: newGoal.title,
            description: newGoal.description,
            deadline: newGoal.deadline,
            status: 'active',
          })
          setShowGoalSetup(false)
          addToast('Goal created! Let\'s do this.', 'success')
        }}
        onCancel={() => setShowGoalSetup(false)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Goal Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Target className="w-4 h-4" />
            <span>Current Goal</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{goal?.title}</h1>
          {goal?.description && (
            <p className="text-gray-400 mt-1">{goal.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Deadline</div>
          <div className="text-lg font-semibold text-white">
            {goal && format(new Date(goal.deadline), 'MMM d, yyyy')}
          </div>
          <div className={`text-sm ${daysRemaining <= 7 ? 'text-amber-400' : 'text-gray-400'}`}>
            {daysRemaining} days left
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Progress</span>
          <span className="text-sm font-medium text-white">{progressPercent}%</span>
        </div>
        <ProgressBar value={progressPercent} max={100} />
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{Math.round(totalCompleted / 60)}h completed</span>
          <span>{Math.round(remainingMinutes / 60)}h remaining</span>
        </div>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Focus - Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* No tasks yet */}
          {tasks.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                icon={ListTodo}
                title="No tasks yet"
                description="Break your goal into smaller tasks. What's the first thing you need to do?"
                action={{
                  label: 'Add First Task',
                  onClick: () => setShowAddTaskInline(true),
                }}
              />
            </Card>
          ) : allTasksCompleted ? (
            /* All tasks completed */
            <Card className="p-8">
              <EmptyState
                icon={PartyPopper}
                title="You're all done! 🎉"
                description="Amazing work! You've completed all your tasks. Take a break or add more tasks to keep the momentum going."
                variant="success"
                action={{
                  label: 'Add More Tasks',
                  onClick: () => setShowAddTaskInline(true),
                }}
              />
            </Card>
          ) : (
            /* Normal today view */
            <TodayView
              tasks={todaysTasks}
              dailyHours={dailyHours}
              activeTaskId={activeTaskId}
              onStartTask={(taskId) => setActiveTaskId(taskId)}
              onCompleteTask={async (taskId, actualMinutes) => {
                await updateTask.mutateAsync({
                  id: taskId,
                  status: 'completed',
                  actual_minutes: actualMinutes,
                  completed_at: new Date().toISOString(),
                })
                setActiveTaskId(null)
                addToast('Task completed! 🎉', 'success')
              }}
              onPauseTask={() => setActiveTaskId(null)}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Pace</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Hours needed/day</span>
                <span className={`font-semibold ${hoursPerDay > dailyHours ? 'text-red-400' : 'text-green-400'}`}>
                  {hoursPerDay === Infinity ? '∞' : `${hoursPerDay}h`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Your available</span>
                <span className="font-semibold text-white">{dailyHours}h/day</span>
              </div>
              {hoursPerDay > dailyHours && hoursPerDay !== Infinity && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">
                    ⚠️ You need {(hoursPerDay - dailyHours).toFixed(1)} more hours/day to hit your deadline
                  </p>
                </div>
              )}
              {allTasksCompleted && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400 text-sm">
                    🎯 You're on track! All tasks completed.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* All Tasks */}
          <TaskList
            tasks={tasks}
            showAddTask={showAddTaskInline}
            onShowAddTask={setShowAddTaskInline}
            onAddTask={async (task) => {
              await createTask.mutateAsync({
                ...task,
                goal_id: goal?.id || null,
              } as Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>)
              setShowAddTaskInline(false)
              addToast('Task added!', 'success')
            }}
            onUpdateTask={async (taskId, updates) => {
              await updateTask.mutateAsync({ id: taskId, ...updates })
            }}
            onDeleteTask={async (taskId) => {
              await deleteTask.mutateAsync(taskId)
              addToast('Task deleted', 'info')
            }}
          />
        </div>
      </div>
    </div>
  )
}