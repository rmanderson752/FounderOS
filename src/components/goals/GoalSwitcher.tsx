// src/components/goals/GoalSwitcher.tsx
// Dropdown component for switching between goals in the header

'use client'

import { useState, Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Target, ChevronDown, Plus, Check, Clock, Archive } from 'lucide-react'
import { useGoals, useActiveGoal, useUpdateGoal } from '@/hooks/useGoals'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'

export function GoalSwitcher() {
  const { data: goals = [] } = useGoals()
  const { data: activeGoal } = useActiveGoal()
  const updateGoal = useUpdateGoal()

  const handleSwitchGoal = async (goalId: string) => {
    await updateGoal.mutateAsync({ id: goalId, status: 'active' })
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const pausedGoals = goals.filter(g => g.status === 'paused')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
        <Target className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-medium text-white max-w-[200px] truncate">
          {activeGoal?.title || 'No active goal'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
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
        <Menu.Items className="absolute left-0 mt-2 w-72 origin-top-left glass-card p-2 z-50">
          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Active
              </div>
              {activeGoals.map(goal => (
                <Menu.Item key={goal.id}>
                  {({ active }) => (
                    <button
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        active ? 'bg-white/10' : ''
                      )}
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{goal.title}</p>
                        <p className="text-xs text-gray-400">
                          Due {format(new Date(goal.deadline), 'MMM d')}
                        </p>
                      </div>
                      <Check className="w-4 h-4 text-indigo-400" />
                    </button>
                  )}
                </Menu.Item>
              ))}
            </div>
          )}

          {/* Paused Goals */}
          {pausedGoals.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Paused
              </div>
              {pausedGoals.map(goal => (
                <Menu.Item key={goal.id}>
                  {({ active }) => (
                    <button
                      onClick={() => handleSwitchGoal(goal.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        active ? 'bg-white/10' : ''
                      )}
                    >
                      <Clock className="w-4 h-4 text-amber-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{goal.title}</p>
                        <p className="text-xs text-gray-400">
                          Due {format(new Date(goal.deadline), 'MMM d')}
                        </p>
                      </div>
                    </button>
                  )}
                </Menu.Item>
              ))}
            </div>
          )}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Completed
              </div>
              {completedGoals.slice(0, 3).map(goal => (
                <Menu.Item key={goal.id}>
                  {({ active }) => (
                    <div
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left',
                        active ? 'bg-white/5' : ''
                      )}
                    >
                      <Check className="w-4 h-4 text-emerald-400" />
                      <p className="text-sm text-gray-400 truncate">{goal.title}</p>
                    </div>
                  )}
                </Menu.Item>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/10 my-2" />

          {/* Actions */}
          <Menu.Item>
            {({ active }) => (
              <Link
                href="/goals"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  active ? 'bg-white/10' : ''
                )}
              >
                <Archive className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">Manage all goals</span>
              </Link>
            )}
          </Menu.Item>

          <Menu.Item>
            {({ active }) => (
              <Link
                href="/goals/new"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  active ? 'bg-white/10' : ''
                )}
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-indigo-400 font-medium">New goal</span>
              </Link>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}