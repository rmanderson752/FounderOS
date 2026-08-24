// src/components/metrics/AddMetricModal.tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ColorDot } from '@/components/ui/ColorDot'
import type { Project } from '@/types/database'

interface AddMetricModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    project_id: string
    name: string
    type: 'currency' | 'number' | 'percentage'
    goal?: number | null
  }) => void
  projects: Project[]
  isLoading?: boolean
}

const METRIC_TYPES: { value: 'currency' | 'number' | 'percentage'; label: string; example: string }[] = [
  { value: 'number', label: 'Number', example: 'e.g., Users, Subscribers' },
  { value: 'currency', label: 'Currency', example: 'e.g., Revenue, MRR' },
  { value: 'percentage', label: 'Percentage', example: 'e.g., Conversion rate' },
]

export function AddMetricModal({ isOpen, onClose, onSubmit, projects, isLoading }: AddMetricModalProps) {
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'currency' | 'number' | 'percentage'>('number')
  const [goal, setGoal] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !name.trim()) return
    onSubmit({
      project_id: projectId,
      name: name.trim(),
      type,
      goal: goal ? parseFloat(goal) : null,
    })
    setProjectId('')
    setName('')
    setType('number')
    setGoal('')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-ink/25 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md bg-white border border-line rounded-3xl shadow-sm p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-ink">Add Metric</h3>
              <button
                onClick={onClose}
                className="text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-surface-3 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Project */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-3">Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                >
                  <option value="">Select a project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-3">Metric Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Monthly Revenue, Active Users"
                  className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-3">Type</label>
                <div className="flex gap-2">
                  {METRIC_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        type === t.value
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          : 'bg-canvas text-ink-3 border border-line-strong hover:text-ink'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-3">Goal (optional)</label>
                <input
                  type="number"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Target value"
                  step="any"
                  className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-transparent border border-line-strong hover:bg-surface-3 text-ink font-medium text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!projectId || !name.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-4 py-2 rounded-full transition-colors"
                >
                  {isLoading ? 'Adding...' : 'Add Metric'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
