// src/components/daily/TaskList.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { TaskItem } from './TaskItem'
import type { Task } from '@/types/database'

interface TaskListProps {
  tasks: Task[]
  projectId: string
  projectName: string
  blockColor: string
  isLoading: boolean
}

export function TaskList({ tasks, projectId, projectName, blockColor, isLoading }: TaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          project_id: projectId,
          title,
          status: 'todo',
          estimated_minutes: 0,
          priority: tasks.length,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-tasks'] })
      setNewTaskTitle('')
      inputRef.current?.focus()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    addTask.mutate(newTaskTitle.trim())
  }

  useEffect(() => {
    if (isAdding) inputRef.current?.focus()
  }, [isAdding])

  const completedCount = tasks.filter(t => t.status === 'completed').length
  const incompleteTasks = tasks.filter(t => t.status !== 'completed')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  if (isLoading) {
    return (
      <div className="p-5 bg-white border border-line rounded-3xl shadow-sm">
        <div className="space-y-3">
          <div className="h-4 bg-surface-3 rounded w-1/3 relative overflow-hidden">
            <div className="shimmer-wave absolute inset-0" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-surface-3 rounded relative overflow-hidden">
              <div className="shimmer-wave absolute inset-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-white border border-line rounded-3xl shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-line">
        <h2 className="text-sm font-semibold text-ink tracking-tight">Tasks</h2>
        {tasks.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 bg-ink/[0.04] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: blockColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
              <span className="text-xs text-ink-4 tabular-nums">
                {completedCount}/{tasks.length}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="p-2">
        {incompleteTasks.length === 0 && completedTasks.length === 0 && (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-ink-4">No tasks for {projectName}</p>
            <p className="text-xs text-ink-4 mt-1">Press + below to get started</p>
          </div>
        )}

        {/* Incomplete tasks */}
        <AnimatePresence mode="popLayout">
          {incompleteTasks.map((task) => (
            <TaskItem key={task.id} task={task} blockColor={blockColor} />
          ))}
        </AnimatePresence>

        {/* Completed tasks (collapsible) */}
        {completedTasks.length > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-4 hover:text-ink-3 transition-colors w-full"
            >
              {showCompleted ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              {completedTasks.length} completed
            </button>
            <AnimatePresence>
              {showCompleted && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {completedTasks.map((task) => (
                    <TaskItem key={task.id} task={task} blockColor={blockColor} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Inline add task */}
      <div className="px-3 pb-3">
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              onSubmit={handleSubmit}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={`Add task to ${projectName}...`}
                onBlur={() => {
                  if (!newTaskTitle.trim()) setIsAdding(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setNewTaskTitle('')
                    setIsAdding(false)
                  }
                }}
                className="flex-1 bg-ink/15 border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-line-strong transition-colors"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim() || addTask.isPending}
                className="bg-ink/[0.06] hover:bg-ink/[0.08] disabled:opacity-30 text-ink text-sm px-3 py-2 rounded-lg transition-colors font-medium"
              >
                Add
              </button>
            </motion.form>
          ) : (
            <motion.button
              key="button"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-4 hover:text-ink-2 hover:bg-ink/[0.025] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add task
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
