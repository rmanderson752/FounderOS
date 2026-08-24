// src/components/projects/ProjectList.tsx
'use client'

import { useState } from 'react'
import { Plus, FolderOpen } from 'lucide-react'
import { useProjects, useAllProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects'
import { ProjectCard } from './ProjectCard'
import { ProjectModal } from './ProjectModal'
import type { Project } from '@/types/database'

export function ProjectList() {
  const { data: activeProjects, isLoading: loadingActive } = useProjects()
  const { data: allProjects, isLoading: loadingAll } = useAllProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [showPaused, setShowPaused] = useState(false)

  const pausedProjects = allProjects?.filter(p => p.status === 'paused') ?? []
  const totalWeeklyHours = activeProjects?.reduce((sum, p) => sum + p.weekly_hours, 0) ?? 0

  const handleCreate = async (data: { name: string; color: string; weekly_hours: number }) => {
    await createProject.mutateAsync(data)
    setIsModalOpen(false)
  }

  const handleEdit = async (data: { name: string; color: string; weekly_hours: number }) => {
    if (!editingProject) return
    await updateProject.mutateAsync({ id: editingProject.id, ...data })
    setEditingProject(null)
  }

  const handleDelete = async (id: string) => {
    await deleteProject.mutateAsync(id)
  }

  const handleToggleStatus = async (id: string, status: 'active' | 'paused') => {
    await updateProject.mutateAsync({ id, status })
  }

  if (loadingActive || loadingAll) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-line rounded-3xl shadow-sm p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-surface-3" />
              <div className="flex-1">
                <div className="h-4 bg-surface-3 rounded w-1/3 mb-1" />
                <div className="h-3 bg-surface-3 rounded w-1/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink">Projects</h1>
          <p className="text-sm text-ink-3 mt-1">
            {activeProjects?.length ?? 0} active · {totalWeeklyHours}h/week total
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-full transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>

      {/* Active Projects */}
      {activeProjects && activeProjects.length > 0 ? (
        <div className="space-y-2">
          {activeProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={setEditingProject}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center mb-4">
            <FolderOpen className="w-6 h-6 text-ink-4" />
          </div>
          <h3 className="text-lg font-medium text-ink mb-1">No projects yet</h3>
          <p className="text-sm text-ink-3 mb-4 max-w-sm">
            Add the projects you&apos;re working on. Each one will get dedicated time in your weekly schedule.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-full transition-colors"
          >
            Add Your First Project
          </button>
        </div>
      )}

      {/* Hour Budget Summary */}
      {activeProjects && activeProjects.length > 0 && (
        <div className="mt-6 p-4 bg-canvas border border-line rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-3">Total weekly hours needed</span>
            <span className="text-lg font-semibold text-ink">{totalWeeklyHours}h</span>
          </div>
          <div className="mt-2 flex gap-1">
            {activeProjects.map((project) => (
              <div
                key={project.id}
                className="h-2 rounded-full"
                style={{
                  backgroundColor: project.color,
                  width: `${(project.weekly_hours / totalWeeklyHours) * 100}%`,
                }}
                title={`${project.name}: ${project.weekly_hours}h`}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {activeProjects.map((project) => (
              <div key={project.id} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-xs text-ink-4">
                  {project.name} ({project.weekly_hours}h)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paused Projects */}
      {pausedProjects.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowPaused(!showPaused)}
            className="text-sm text-ink-4 hover:text-ink-2 transition-colors mb-3"
          >
            {showPaused ? 'Hide' : 'Show'} paused projects ({pausedProjects.length})
          </button>
          {showPaused && (
            <div className="space-y-2 opacity-60">
              {pausedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onEdit={setEditingProject}
                  onDelete={handleDelete}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        isLoading={createProject.isPending}
      />

      {/* Edit Modal */}
      <ProjectModal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSubmit={handleEdit}
        project={editingProject}
        isLoading={updateProject.isPending}
      />
    </div>
  )
}
