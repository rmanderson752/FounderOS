// src/components/projects/ProjectCard.tsx
'use client'

import { useState } from 'react'
import { Pencil, Trash2, GripVertical, Pause, Play } from 'lucide-react'
import { ColorDot } from '@/components/ui/ColorDot'
import type { Project } from '@/types/database'

interface ProjectCardProps {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
  onToggleStatus: (id: string, status: 'active' | 'paused') => void
}

export function ProjectCard({ project, onEdit, onDelete, onToggleStatus }: ProjectCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  return (
    <div className="bg-white border border-line rounded-3xl shadow-sm p-4 hover:bg-surface-3 hover:border-line-strong transition-colors group">
      <div className="flex items-center gap-3">
        {/* Drag handle placeholder */}
        <GripVertical className="w-4 h-4 text-ink-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex-shrink-0" />

        {/* Color dot */}
        <ColorDot color={project.color} size="lg" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-ink truncate">
              {project.name}
            </h3>
            {project.status === 'paused' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
                Paused
              </span>
            )}
          </div>
          <p className="text-xs text-ink-4 mt-0.5">
            {project.weekly_hours}h / week target
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggleStatus(project.id, project.status === 'active' ? 'paused' : 'active')}
            className="p-1.5 rounded-md text-ink-3 hover:text-ink hover:bg-surface-3 transition-colors"
            title={project.status === 'active' ? 'Pause project' : 'Resume project'}
          >
            {project.status === 'active' ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onEdit(project)}
            className="p-1.5 rounded-md text-ink-3 hover:text-ink hover:bg-surface-3 transition-colors"
            title="Edit project"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {showConfirmDelete ? (
            <button
              onClick={() => {
                onDelete(project.id)
                setShowConfirmDelete(false)
              }}
              className="px-2 py-1 rounded-md text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              Confirm
            </button>
          ) : (
            <button
              onClick={() => setShowConfirmDelete(true)}
              onBlur={() => setTimeout(() => setShowConfirmDelete(false), 200)}
              className="p-1.5 rounded-md text-ink-3 hover:text-red-400 hover:bg-surface-3 transition-colors"
              title="Delete project"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
