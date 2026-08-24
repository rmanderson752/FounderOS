// src/components/week/AddBlockModal.tsx
'use client'

import { useState } from 'react'
import { X, Briefcase, Coffee } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProjectColorPicker } from '@/components/projects/ProjectColorPicker'
import { ColorDot } from '@/components/ui/ColorDot'
import { DEFAULT_PROJECT_COLOR } from '@/lib/constants'
import type { Project } from '@/types/database'

type BlockType = 'project' | 'life'

interface AddBlockModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    project_id?: string | null
    label?: string | null
    color?: string | null
    hours: number
    slot: 'morning' | 'afternoon' | 'full'
  }) => void
  projects: Project[]
  dayName: string
  isLoading?: boolean
}

export function AddBlockModal({ isOpen, onClose, onSubmit, projects, dayName, isLoading }: AddBlockModalProps) {
  const [blockType, setBlockType] = useState<BlockType>('project')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('#6B7280')
  const [hours, setHours] = useState(4)
  const [slot, setSlot] = useState<'morning' | 'afternoon' | 'full'>('full')

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (blockType === 'project' && !selectedProjectId) return
    if (blockType === 'life' && !label.trim()) return

    onSubmit({
      project_id: blockType === 'project' ? selectedProjectId : null,
      label: blockType === 'life' ? label.trim() : null,
      color: blockType === 'life' ? color : null,
      hours,
      slot,
    })

    // Reset
    setSelectedProjectId('')
    setLabel('')
    setColor('#6B7280')
    setHours(4)
    setSlot('full')
    setBlockType('project')
  }

  const canSubmit = blockType === 'project' ? !!selectedProjectId : !!label.trim()

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
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-ink">
                Add Block — {dayName}
              </h3>
              <button
                onClick={onClose}
                className="text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-surface-3 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Block type selector */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setBlockType('project')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  blockType === 'project'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-canvas text-ink-3 border border-line-strong hover:text-ink'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                Project
              </button>
              <button
                type="button"
                onClick={() => setBlockType('life')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  blockType === 'life'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-canvas text-ink-3 border border-line-strong hover:text-ink'
                }`}
              >
                <Coffee className="w-4 h-4" />
                Life / Other
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Project selector */}
              {blockType === 'project' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-3">Project</label>
                  {projects.length > 0 ? (
                    <div className="space-y-1.5">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => setSelectedProjectId(project.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                            selectedProjectId === project.id
                              ? 'bg-surface-3 border border-blue-500/30'
                              : 'bg-canvas border border-line-strong hover:bg-surface-3'
                          }`}
                        >
                          <ColorDot color={project.color} size="md" />
                          <span className="text-ink font-medium">{project.name}</span>
                          <span className="text-xs text-ink-4 ml-auto">{project.weekly_hours}h/wk</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-4 py-2">
                      No active projects. Create one in the Projects tab first.
                    </p>
                  )}
                </div>
              )}

              {/* Life block fields */}
              {blockType === 'life' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-ink-3">Label</label>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g., Bar Shift, Gym, Errands"
                      autoFocus
                      className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                  <ProjectColorPicker value={color} onChange={setColor} />
                </>
              )}

              {/* Hours */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-3">Hours</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={hours}
                    onChange={(e) => setHours(Math.max(0.5, parseFloat(e.target.value) || 0))}
                    min="0.5"
                    max="16"
                    step="0.5"
                    className="w-20 bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                  <span className="text-sm text-ink-3">hours</span>
                </div>
              </div>

              {/* Slot */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-3">Time Slot</label>
                <div className="flex gap-2">
                  {(['morning', 'afternoon', 'full'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot(s)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        slot === s
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          : 'bg-canvas text-ink-3 border border-line-strong hover:text-ink'
                      }`}
                    >
                      {s === 'full' ? 'Full Day' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3 p-3 bg-canvas rounded-lg border border-line">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: blockType === 'project'
                      ? (selectedProject?.color || '#3B82F6')
                      : color
                  }}
                />
                <span className="text-sm text-ink font-medium">
                  {blockType === 'project'
                    ? (selectedProject?.name || 'Select a project')
                    : (label || 'Block label')}
                </span>
                <span className="text-xs text-ink-4 ml-auto">
                  {hours}h · {slot === 'full' ? 'Full day' : slot}
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
                  disabled={!canSubmit || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-4 py-2 rounded-full transition-colors"
                >
                  {isLoading ? 'Adding...' : 'Add Block'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
