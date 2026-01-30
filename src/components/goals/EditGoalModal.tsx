// src/components/goals/EditGoalModal.tsx
// Modal for editing existing goals

'use client'

import { useState, useEffect } from 'react'
import { Modal, Button, Input } from '@/components/ui'
import { useUpdateGoal } from '@/hooks/useGoals'
import { useToast } from '@/components/ui/Toast'
import type { Goal } from '@/types/database'
import { format } from 'date-fns'

interface EditGoalModalProps {
  goal: Goal | null
  open: boolean
  onClose: () => void
}

export function EditGoalModal({ goal, open, onClose }: EditGoalModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  
  const updateGoal = useUpdateGoal()
  const { addToast } = useToast()

  useEffect(() => {
    if (goal) {
      setTitle(goal.title)
      setDescription(goal.description || '')
      setDeadline(format(new Date(goal.deadline), 'yyyy-MM-dd'))
    }
  }, [goal])

  const handleSave = async () => {
    if (!goal || !title.trim() || !deadline) return

    await updateGoal.mutateAsync({
      id: goal.id,
      title: title.trim(),
      description: description.trim() || null,
      deadline: new Date(deadline).toISOString(),
    })

    addToast('Goal updated!', 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Goal" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Goal title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to achieve?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more details..."
            rows={3}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Deadline
          </label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !deadline || updateGoal.isPending}
            isLoading={updateGoal.isPending}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}