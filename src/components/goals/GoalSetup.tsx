'use client'

import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { Target, Calendar, ArrowRight, X } from 'lucide-react'
import { Card, Button, Input } from '@/components/ui'
import type { Goal } from '@/types/database'

interface GoalSetupProps {
  onComplete: (goal: Goal) => void
  onCancel: () => void
  existingGoal?: Goal
}

export function GoalSetup({ onComplete, onCancel, existingGoal }: GoalSetupProps) {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState(existingGoal?.title || '')
  const [description, setDescription] = useState(existingGoal?.description || '')
  const [deadline, setDeadline] = useState(
    existingGoal?.deadline || format(addDays(new Date(), 14), 'yyyy-MM-dd')
  )

  const handleSubmit = () => {
    const newGoal: Goal = {
      id: existingGoal?.id || Date.now().toString(),
      user_id: '1', // Will be replaced with actual user ID
      title,
      description: description || null,
      deadline,
      status: 'active',
      created_at: existingGoal?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    onComplete(newGoal)
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {existingGoal ? 'Edit Goal' : 'Set Your Goal'}
              </h2>
              <p className="text-sm text-gray-400">Step {step} of 2</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-700'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-700'}`} />
        </div>

        {/* Step 1: Goal Title */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                What do you want to accomplish?
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Launch MVP, Complete course, Ship feature..."
                className="text-lg"
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-500">
                Be specific. "Launch landing page" is better than "Work on website"
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any details or context..."
                className="w-full bg-[#111113] border border-[#2A2A30] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors min-h-[80px] resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!title.trim()}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Deadline */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                When do you want to complete this by?
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="pl-10"
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            </div>

            {/* Quick select buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: '1 week', days: 7 },
                { label: '2 weeks', days: 14 },
                { label: '1 month', days: 30 },
                { label: '3 months', days: 90 },
              ].map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => setDeadline(format(addDays(new Date(), days), 'yyyy-MM-dd'))}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    deadline === format(addDays(new Date(), days), 'yyyy-MM-dd')
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-[#2A2A30] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="p-4 bg-[#111113] rounded-lg border border-[#1F1F23]">
              <h3 className="font-medium text-white mb-2">Your goal:</h3>
              <p className="text-gray-300">{title}</p>
              <p className="text-sm text-gray-500 mt-1">
                Due: {format(new Date(deadline), 'MMMM d, yyyy')}
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleSubmit}>
                {existingGoal ? 'Save Changes' : 'Create Goal'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
