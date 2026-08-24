// src/components/projects/ProjectModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProjectColorPicker } from './ProjectColorPicker'
import { DEFAULT_PROJECT_COLOR } from '@/lib/constants'
import type { Project } from '@/types/database'

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; color: string; weekly_hours: number }) => void
  project?: Project | null // If provided, we're editing
  isLoading?: boolean
}

export function ProjectModal({ isOpen, onClose, onSubmit, project, isLoading }: ProjectModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_PROJECT_COLOR)
  const [weeklyHours, setWeeklyHours] = useState(8)

  const isEditing = !!project

  useEffect(() => {
    if (project) {
      setName(project.name)
      setColor(project.color)
      setWeeklyHours(project.weekly_hours)
    } else {
      setName('')
      setColor(DEFAULT_PROJECT_COLOR)
      setWeeklyHours(8)
    }
  }, [project, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), color, weekly_hours: weeklyHours })
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
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-ink">
                {isEditing ? 'Edit Project' : 'New Project'}
              </h3>
              <button
                onClick={onClose}
                className="text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-surface-3 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-3">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., HNRY Development"
                  autoFocus
                  className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Color */}
              <ProjectColorPicker value={color} onChange={setColor} />

              {/* Weekly Hours */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-3">
                  Weekly Hour Target
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(Math.max(0.5, parseFloat(e.target.value) || 0))}
                    min="0.5"
                    max="60"
                    step="0.5"
                    className="w-24 bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                  <span className="text-sm text-ink-3">hours per week</span>
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3 p-3 bg-canvas rounded-lg border border-line">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-ink font-medium">
                  {name || 'Project Name'}
                </span>
                <span className="text-xs text-ink-4 ml-auto">
                  {weeklyHours}h/week
                </span>
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
                  disabled={!name.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-4 py-2 rounded-full transition-colors"
                >
                  {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
