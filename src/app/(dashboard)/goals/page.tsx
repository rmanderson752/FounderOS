// src/app/(dashboard)/goals/page.tsx
// Goals management page - view, edit, complete, delete goals

'use client'

import { useState } from 'react'
import { format, differenceInDays, isPast } from 'date-fns'
import { 
  Target, Plus, MoreHorizontal, Pencil, Trash2, 
  CheckCircle, Play, Pause, Calendar, Clock,
  AlertTriangle
} from 'lucide-react'
import { Card, Button, Modal, EmptyState } from '@/components/ui'
import { useGoals, useUpdateGoal, useDeleteGoal } from '@/hooks/useGoals'
import { EditGoalModal } from '@/components/goals/EditGoalModal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { Goal } from '@/types/database'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'

export default function GoalsPage() {
  const { data: goals = [], isLoading } = useGoals()
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()
  const { addToast } = useToast()

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null)

  const activeGoals = goals.filter(g => g.status === 'active')
  const pausedGoals = goals.filter(g => g.status === 'paused')
  const completedGoals = goals.filter(g => g.status === 'completed')

  const handleSetActive = async (goalId: string) => {
    await updateGoal.mutateAsync({ id: goalId, status: 'active' })
    addToast('Goal is now active!', 'success')
  }

  const handlePause = async (goalId: string) => {
    await updateGoal.mutateAsync({ id: goalId, status: 'paused' })
    addToast('Goal paused', 'info')
  }

  const handleComplete = async (goalId: string) => {
    await updateGoal.mutateAsync({ id: goalId, status: 'completed' })
    addToast('Goal completed! 🎉', 'success')
  }

  const handleDelete = async () => {
    if (!deletingGoal) return
    await deleteGoal.mutateAsync(deletingGoal.id)
    addToast('Goal deleted', 'info')
    setDeletingGoal(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">Loading goals...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <p className="text-gray-400 mt-1">Manage your goals and track progress</p>
        </div>
        <Link href="/goals/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Goal
          </Button>
        </Link>
      </div>

      {/* No Goals */}
      {goals.length === 0 && (
        <Card className="p-8">
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Set your first goal to start tracking progress and staying focused."
            action={{
              label: 'Create Goal',
              onClick: () => window.location.href = '/goals/new',
            }}
          />
        </Card>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            Active ({activeGoals.length})
          </h2>
          <div className="space-y-3">
            {activeGoals.map(goal => (
              <GoalCard 
                key={goal.id} 
                goal={goal}
                onEdit={() => setEditingGoal(goal)}
                onPause={() => handlePause(goal.id)}
                onComplete={() => handleComplete(goal.id)}
                onDelete={() => setDeletingGoal(goal)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Paused Goals */}
      {pausedGoals.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Paused ({pausedGoals.length})
          </h2>
          <div className="space-y-3">
            {pausedGoals.map(goal => (
              <GoalCard 
                key={goal.id} 
                goal={goal}
                onEdit={() => setEditingGoal(goal)}
                onSetActive={() => handleSetActive(goal.id)}
                onComplete={() => handleComplete(goal.id)}
                onDelete={() => setDeletingGoal(goal)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Completed ({completedGoals.length})
          </h2>
          <div className="space-y-3">
            {completedGoals.map(goal => (
              <GoalCard 
                key={goal.id} 
                goal={goal}
                onEdit={() => setEditingGoal(goal)}
                onSetActive={() => handleSetActive(goal.id)}
                onDelete={() => setDeletingGoal(goal)}
                isCompleted
              />
            ))}
          </div>
        </section>
      )}

      {/* Edit Modal */}
      <EditGoalModal
        goal={editingGoal}
        open={!!editingGoal}
        onClose={() => setEditingGoal(null)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingGoal}
        onClose={() => setDeletingGoal(null)}
        title="Delete Goal"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <div>
                <p className="text-rose-400 font-medium">This will delete the goal</p>
                <p className="text-sm text-gray-400 mt-1">
                  All tasks associated with "{deletingGoal?.title}" will also be deleted. This cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeletingGoal(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteGoal.isPending}
            >
              Delete Goal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Goal Card Component
interface GoalCardProps {
  goal: Goal
  onEdit: () => void
  onSetActive?: () => void
  onPause?: () => void
  onComplete?: () => void
  onDelete: () => void
  isCompleted?: boolean
}

function GoalCard({ 
  goal, 
  onEdit, 
  onSetActive, 
  onPause, 
  onComplete, 
  onDelete,
  isCompleted 
}: GoalCardProps) {
  const daysRemaining = differenceInDays(new Date(goal.deadline), new Date())
  const isOverdue = isPast(new Date(goal.deadline)) && !isCompleted

  return (
    <Card hover className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn(
              "font-semibold",
              isCompleted ? "text-gray-400" : "text-white"
            )}>
              {goal.title}
            </h3>
            {goal.status === 'active' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                Active
              </span>
            )}
          </div>
          
          {goal.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{goal.description}</p>
          )}
          
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className={cn(
              "flex items-center gap-1.5",
              isOverdue ? "text-rose-400" : "text-gray-400"
            )}>
              <Calendar className="w-4 h-4" />
              <span>
                {isCompleted 
                  ? `Completed`
                  : isOverdue 
                    ? `Overdue by ${Math.abs(daysRemaining)} days`
                    : `${daysRemaining} days left`
                }
              </span>
            </div>
            <div className="text-gray-500">
              Due {format(new Date(goal.deadline), 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        {/* Actions Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <MoreHorizontal className="w-5 h-5 text-gray-400" />
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-48 glass-card p-1 z-50">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onEdit}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm',
                      active ? 'bg-white/10' : ''
                    )}
                  >
                    <Pencil className="w-4 h-4 text-gray-400" />
                    <span className="text-white">Edit</span>
                  </button>
                )}
              </Menu.Item>

              {onSetActive && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={onSetActive}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm',
                        active ? 'bg-white/10' : ''
                      )}
                    >
                      <Play className="w-4 h-4 text-emerald-400" />
                      <span className="text-white">Set as Active</span>
                    </button>
                  )}
                </Menu.Item>
              )}

              {onPause && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={onPause}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm',
                        active ? 'bg-white/10' : ''
                      )}
                    >
                      <Pause className="w-4 h-4 text-amber-400" />
                      <span className="text-white">Pause</span>
                    </button>
                  )}
                </Menu.Item>
              )}

              {onComplete && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={onComplete}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm',
                        active ? 'bg-white/10' : ''
                      )}
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-white">Mark Complete</span>
                    </button>
                  )}
                </Menu.Item>
              )}

              <div className="border-t border-white/10 my-1" />

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onDelete}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm',
                      active ? 'bg-rose-500/20' : ''
                    )}
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span className="text-rose-400">Delete</span>
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </Card>
  )
}