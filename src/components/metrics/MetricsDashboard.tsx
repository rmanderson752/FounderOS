// src/components/metrics/MetricsDashboard.tsx
'use client'

import { useState, useMemo } from 'react'
import { Plus, BarChart3 } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { useAllMetrics, useAllMetricEntries, useCreateMetric, useDeleteMetric } from '@/hooks/useMetrics'
import { ColorDot } from '@/components/ui/ColorDot'
import { ProjectMetricCard } from './ProjectMetricCard'
import { AddMetricModal } from './AddMetricModal'
import type { Project } from '@/types/database'

export function MetricsDashboard() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects()
  const { data: metrics = [], isLoading: metricsLoading } = useAllMetrics()
  const createMetric = useCreateMetric()
  const deleteMetric = useDeleteMetric()

  const [showAddModal, setShowAddModal] = useState(false)

  // Fetch entries for all metrics
  const metricIds = useMemo(() => metrics.map(m => m.id), [metrics])
  const { data: entriesByMetric = {} } = useAllMetricEntries(metricIds)

  // Group metrics by project
  const metricsByProject = useMemo(() => {
    const grouped: Record<string, typeof metrics> = {}
    for (const metric of metrics) {
      if (!grouped[metric.project_id]) grouped[metric.project_id] = []
      grouped[metric.project_id].push(metric)
    }
    return grouped
  }, [metrics])

  // Get projects that have metrics (in priority order)
  const projectsWithMetrics = useMemo(() => {
    return projects.filter(p => metricsByProject[p.id]?.length > 0)
  }, [projects, metricsByProject])

  const handleCreate = async (data: {
    project_id: string
    name: string
    type: 'currency' | 'number' | 'percentage'
    goal?: number | null
  }) => {
    await createMetric.mutateAsync(data)
    setShowAddModal(false)
  }

  const handleDelete = async (id: string) => {
    await deleteMetric.mutateAsync(id)
  }

  const isLoading = projectsLoading || metricsLoading

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 bg-surface-3 rounded w-40 animate-pulse" />
          <div className="h-8 bg-surface-3 rounded w-28 animate-pulse" />
        </div>
        <div className="space-y-6">
          {[1, 2].map(i => (
            <div key={i} className="space-y-3">
              <div className="h-5 bg-surface-3 rounded w-32 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map(j => (
                  <div key={j} className="h-32 bg-white border border-line rounded-3xl shadow-sm animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink">Metrics</h1>
          <p className="text-sm text-ink-3 mt-1">
            Track key numbers across your projects.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-full transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Metric
        </button>
      </div>

      {/* Metrics by project */}
      {projectsWithMetrics.length > 0 ? (
        <div className="space-y-8">
          {projectsWithMetrics.map((project) => {
            const projectMetrics = metricsByProject[project.id] ?? []

            return (
              <div key={project.id}>
                {/* Project header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <ColorDot color={project.color} size="md" />
                  <h2 className="text-sm font-semibold text-ink">{project.name}</h2>
                  <span className="text-xs text-ink-4">
                    {projectMetrics.length} metric{projectMetrics.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Metric cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projectMetrics.map((metric) => (
                    <ProjectMetricCard
                      key={metric.id}
                      metric={metric}
                      entries={entriesByMetric[metric.id] ?? []}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center mb-4">
            <BarChart3 className="w-6 h-6 text-ink-4" />
          </div>
          <h3 className="text-lg font-medium text-ink mb-1">No metrics yet</h3>
          <p className="text-sm text-ink-3 mb-4 max-w-sm">
            Add metrics to track key numbers for your projects — revenue, users, conversion rates, and more.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-full transition-colors"
          >
            Add Your First Metric
          </button>
        </div>
      )}

      {/* Add Metric Modal */}
      <AddMetricModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreate}
        projects={projects}
        isLoading={createMetric.isPending}
      />
    </div>
  )
}
