'use client'

import { useState } from 'react'
import { Plus, Target } from 'lucide-react'
import { Card, CardHeader, CardTitle, Checkbox, Input, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'

// Mock data for now - will be replaced with real data from Supabase
const mockPriorities = [
  { id: '1', text: 'Ship new landing page', completed: true },
  { id: '2', text: 'Call with investor (Sequoia)', completed: false },
  { id: '3', text: 'Review PRD with cofounder', completed: false },
]

export function PriorityWidget() {
  const [priorities, setPriorities] = useState(mockPriorities)
  const [newPriority, setNewPriority] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const completedCount = priorities.filter(p => p.completed).length
  const canAddMore = priorities.length < 3

  const handleToggle = (id: string) => {
    setPriorities(prev =>
      prev.map(p => (p.id === id ? { ...p, completed: !p.completed } : p))
    )
  }

  const handleAdd = () => {
    if (!newPriority.trim() || !canAddMore) return

    setPriorities(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        text: newPriority.trim(),
        completed: false,
      },
    ])
    setNewPriority('')
    setIsAdding(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd()
    } else if (e.key === 'Escape') {
      setNewPriority('')
      setIsAdding(false)
    }
  }

  if (priorities.length === 0 && !isAdding) {
    return (
      <Card>
        <EmptyState
          icon={Target}
          title="No priorities yet"
          description="What are your top 3 priorities for today?"
          action={{
            label: 'Add Priority',
            onClick: () => setIsAdding(true),
          }}
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Priorities</CardTitle>
        <span className="text-sm text-gray-400">
          {completedCount}/{priorities.length}
        </span>
      </CardHeader>

      <div className="space-y-3">
        {priorities.map((priority) => (
          <div
            key={priority.id}
            className="flex items-center gap-3 group"
          >
            <Checkbox
              checked={priority.completed}
              onChange={() => handleToggle(priority.id)}
            />
            <span
              className={cn(
                'flex-1 text-sm transition-colors',
                priority.completed ? 'text-gray-500 line-through' : 'text-white'
              )}
            >
              {priority.text}
            </span>
          </div>
        ))}

        {/* Add new priority */}
        {canAddMore && (
          isAdding ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5" />
              <Input
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newPriority.trim()) {
                    setIsAdding(false)
                  }
                }}
                placeholder="What's important today?"
                className="flex-1 bg-transparent border-none text-sm px-0 focus:ring-0"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-3 text-gray-500 hover:text-gray-300 transition-colors w-full"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add a priority...</span>
            </button>
          )
        )}
      </div>
    </Card>
  )
}
