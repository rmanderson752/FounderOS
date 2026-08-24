// src/components/daily/TaskItem.tsx
'use client'

import { useState } from 'react'
import { Check, Clock, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task } from '@/types/database'

interface TaskItemProps {
  task: Task
  blockColor: string
}

export function TaskItem({ task, blockColor }: TaskItemProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const isCompleted = task.status === 'completed'

  const toggleComplete = useMutation({
    mutationFn: async () => {
      setIsCompleting(true)
      const newStatus = isCompleted ? 'todo' : 'completed'
      const { error } = await supabase
        .from('tasks')
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['block-tasks'] })
        setIsCompleting(false)
      }, 300)
    },
    onError: () => setIsCompleting(false),
  })

  const deleteTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-tasks'] })
    },
  })

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isCompleting ? 0.5 : 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0 }}
      transition={{ duration: 0.2 }}
      className="group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-ink/[0.025]"
    >
      {/* Checkbox */}
      <button
        onClick={() => toggleComplete.mutate()}
        className="mt-0.5 relative flex-shrink-0"
      >
        <motion.div
          whileTap={{ scale: 0.85 }}
          className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-all duration-200 ${
            isCompleted
              ? 'border-transparent'
              : 'border-line-strong hover:border-line-strong'
          }`}
          style={isCompleted ? { backgroundColor: blockColor, borderColor: blockColor } : {}}
        >
          <AnimatePresence>
            {isCompleted && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <Check className="w-3 h-3 text-ink" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm leading-snug transition-all duration-200 ${
          isCompleted ? 'text-ink-4 line-through' : 'text-ink'
        }`}>
          {task.title}
        </span>
        {task.estimated_minutes && task.estimated_minutes > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-ink-4" />
            <span className="text-xs text-ink-4">
              {task.estimated_minutes >= 60
                ? `${Math.floor(task.estimated_minutes / 60)}h ${task.estimated_minutes % 60 > 0 ? `${task.estimated_minutes % 60}m` : ''}`
                : `${task.estimated_minutes}m`
              }
            </span>
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => deleteTask.mutate()}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-4 hover:text-red-400 transition-all flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  )
}
