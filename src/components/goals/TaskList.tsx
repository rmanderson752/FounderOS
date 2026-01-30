// src/components/goals/TaskList.tsx
// Displays all tasks grouped by status (To Do, In Progress, Completed)
// Includes add/edit task modal with time presets and recurring options

'use client'

import { useState, useEffect } from 'react'
import { Plus, MoreVertical, Trash2, Edit2, Check, X, RotateCcw, GripVertical } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button, Input, Modal } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/database'

interface TaskListProps {
  tasks: Task[]
  showAddTask?: boolean
  onShowAddTask?: (show: boolean) => void
  onAddTask: (task: Omit<Task, 'id'>) => void
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void
  onDeleteTask: (taskId: string) => void
}

export function TaskList({ 
  tasks, 
  showAddTask = false,
  onShowAddTask,
  onAddTask, 
  onUpdateTask, 
  onDeleteTask 
}: TaskListProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Sync external control with internal state
  useEffect(() => {
    if (showAddTask) {
      setShowAddModal(true)
    }
  }, [showAddTask])

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingTask(null)
    onShowAddTask?.(false)
  }

  const handleOpenModal = () => {
    setShowAddModal(true)
    onShowAddTask?.(true)
  }

  // Group tasks by status
  const todoTasks = tasks.filter(t => t.status === 'todo')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Tasks</CardTitle>
          <button
            onClick={handleOpenModal}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </CardHeader>

        <div className="space-y-4">
          {/* In Progress */}
          {inProgressTasks.length > 0 && (
            <TaskSection
              title="In Progress"
              tasks={inProgressTasks}
              onEdit={setEditingTask}
              onDelete={onDeleteTask}
              onToggleComplete={(id) => onUpdateTask(id, { 
                status: 'completed', 
                completed_at: new Date().toISOString() 
              })}
            />
          )}

          {/* To Do */}
          {todoTasks.length > 0 && (
            <TaskSection
              title="To Do"
              tasks={todoTasks}
              onEdit={setEditingTask}
              onDelete={onDeleteTask}
              onToggleComplete={(id) => onUpdateTask(id, { 
                status: 'completed', 
                completed_at: new Date().toISOString() 
              })}
            />
          )}

          {/* Completed */}
          {completedTasks.length > 0 && (
            <TaskSection
              title="Completed"
              tasks={completedTasks}
              onEdit={setEditingTask}
              onDelete={onDeleteTask}
              onToggleComplete={(id) => onUpdateTask(id, { 
                status: 'todo', 
                completed_at: null 
              })}
              collapsed
            />
          )}

          {tasks.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">No tasks yet</p>
              <button
                onClick={handleOpenModal}
                className="text-blue-400 text-sm hover:underline mt-1"
              >
                Add your first task
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Add/Edit Task Modal */}
      {(showAddModal || editingTask) && (
        <TaskModal
          task={editingTask}
          onSave={(taskData) => {
            if (editingTask) {
              onUpdateTask(editingTask.id, taskData)
            } else {
              onAddTask({
                ...taskData,
                user_id: '',
                actual_minutes: 0,
                status: 'todo',
                completed_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as Omit<Task, 'id'>)
            }
            handleCloseModal()
          }}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}

// Task Section Component
interface TaskSectionProps {
  title: string
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  onToggleComplete: (taskId: string) => void
  collapsed?: boolean
}

function TaskSection({ title, tasks, onEdit, onDelete, onToggleComplete, collapsed = false }: TaskSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed)

  return (
    <div>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between w-full text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-300 transition-colors"
      >
        <span>{title} ({tasks.length})</span>
        <span>{isCollapsed ? '+' : '−'}</span>
      </button>
      
      {!isCollapsed && (
        <div className="space-y-1">
          {tasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
              onToggleComplete={() => onToggleComplete(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Individual Task Item
interface TaskItemProps {
  task: Task
  onEdit: () => void
  onDelete: () => void
  onToggleComplete: () => void
}

function TaskItem({ task, onEdit, onDelete, onToggleComplete }: TaskItemProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#1A1A1E] group">
      {/* Checkbox */}
      <button
        onClick={onToggleComplete}
        className={cn(
          'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
          task.status === 'completed'
            ? 'bg-green-500 border-green-500'
            : 'border-gray-600 hover:border-gray-400'
        )}
      >
        {task.status === 'completed' && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Task title */}
      <span className={cn(
        'flex-1 text-sm truncate',
        task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-200'
      )}>
        {task.title}
      </span>

      {/* Recurring indicator */}
      {task.is_recurring && (
        <RotateCcw className="w-3 h-3 text-gray-500" />
      )}

      {/* Time */}
      <span className="text-xs text-gray-500">
        {task.estimated_minutes}m
      </span>

      {/* Menu */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-all"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        
        {showMenu && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowMenu(false)} 
            />
            <div className="absolute right-0 top-6 z-20 bg-[#1F1F24] border border-[#2A2A30] rounded-lg shadow-xl py-1 min-w-[120px]">
              <button
                onClick={() => { onEdit(); setShowMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-[#2A2A30]"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-[#2A2A30]"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Task Modal for Add/Edit
interface TaskModalProps {
  task: Task | null
  onSave: (data: Partial<Task>) => void
  onClose: () => void
}

function TaskModal({ task, onSave, onClose }: TaskModalProps) {
  const [title, setTitle] = useState(task?.title || '')
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimated_minutes || 30)
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring || false)
  const [recurrencePattern, setRecurrencePattern] = useState(task?.recurrence_pattern || 'daily')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    onSave({
      title: title.trim(),
      estimated_minutes: estimatedMinutes,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      priority: task?.priority || 0,
      goal_id: task?.goal_id || null,
      description: task?.description || null,
      due_date: task?.due_date || null,
    })
  }

  // Time presets
  const timePresets = [
    { label: '15m', minutes: 15 },
    { label: '30m', minutes: 30 },
    { label: '1h', minutes: 60 },
    { label: '2h', minutes: 120 },
    { label: '4h', minutes: 240 },
  ]

  return (
    <Modal open={true} onClose={onClose} title={task ? 'Edit Task' : 'Add Task'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Task
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            autoFocus
          />
        </div>

        {/* Time estimate */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Estimated time
          </label>
          <div className="flex gap-2 mb-2">
            {timePresets.map(({ label, minutes }) => (
              <button
                key={label}
                type="button"
                onClick={() => setEstimatedMinutes(minutes)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                  estimatedMinutes === minutes
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-[#2A2A30] text-gray-400 hover:border-gray-500'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            type="number"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 0)}
            min={1}
            max={480}
          />
          <p className="text-xs text-gray-500 mt-1">
            {Math.floor(estimatedMinutes / 60)}h {estimatedMinutes % 60}m
          </p>
        </div>

        {/* Recurring toggle */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#2A2A30] rounded-full peer-checked:bg-blue-500 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
            </div>
            <span className="text-sm text-gray-300">Recurring task</span>
          </label>
        </div>

        {/* Recurrence pattern */}
        {isRecurring && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Repeat
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Daily', value: 'daily' },
                { label: 'Weekdays', value: 'weekdays' },
                { label: 'Weekly', value: 'weekly' },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRecurrencePattern(value)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                    recurrencePattern === value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-[#2A2A30] text-gray-400 hover:border-gray-500'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            {task ? 'Save Changes' : 'Add Task'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}