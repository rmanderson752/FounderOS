// src/components/week/HourBudget.tsx
'use client'

import { AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import type { TemplateBlockWithProject } from '@/hooks/useWeekTemplate'
import type { Project } from '@/types/database'

interface HourBudgetProps {
  blocks: TemplateBlockWithProject[]
  totalAvailable: number
  projects: Project[]
}

export function HourBudget({ blocks, totalAvailable, projects }: HourBudgetProps) {
  const totalAllocated = blocks.reduce((sum, b) => sum + Number(b.hours), 0)
  const isOver = totalAllocated > totalAvailable
  const buffer = totalAvailable - totalAllocated

  // Group hours by project
  const projectHours: { name: string; color: string; hours: number }[] = []

  const byProject = blocks.reduce((acc, b) => {
    if (b.project_id) {
      acc[b.project_id] = (acc[b.project_id] ?? 0) + Number(b.hours)
    }
    return acc
  }, {} as Record<string, number>)

  for (const [projectId, hours] of Object.entries(byProject)) {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      projectHours.push({ name: project.name, color: project.color, hours })
    }
  }

  // Life blocks
  const lifeHours = blocks.filter(b => !b.project_id).reduce((sum, b) => sum + Number(b.hours), 0)
  if (lifeHours > 0) {
    projectHours.push({ name: 'Life / Other', color: '#6B7280', hours: lifeHours })
  }

  projectHours.sort((a, b) => b.hours - a.hours)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="p-4 bg-canvas border border-line rounded-xl"
    >
      {/* Summary line */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-ink-3">Weekly budget</span>
        <div className="flex items-center gap-2">
          {isOver && <AlertTriangle className="w-4 h-4 text-red-400" />}
          <span className={`text-sm font-semibold tabular-nums ${isOver ? 'text-red-400' : 'text-ink'}`}>
            {totalAllocated}h
          </span>
          <span className="text-sm text-ink-4">/ {totalAvailable}h</span>
          {!isOver && buffer > 0 && (
            <span className="text-xs text-ink-4">({buffer}h buffer)</span>
          )}
        </div>
      </div>

      {/* Animated stacked bar */}
      {totalAvailable > 0 && (
        <div className="h-3 bg-ink/[0.03] rounded-full overflow-hidden flex">
          {projectHours.map((ph, i) => (
            <motion.div
              key={i}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: ph.color, opacity: 0.85 }}
              initial={{ width: 0 }}
              animate={{ width: `${(ph.hours / totalAvailable) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] }}
              title={`${ph.name}: ${ph.hours}h`}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      {projectHours.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          {projectHours.map((ph, i) => {
            const target = projects.find(p => p.name === ph.name)?.weekly_hours
            return (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: ph.color }}
                />
                <span className="text-xs text-ink-4">
                  {ph.name} ({ph.hours}h{target ? `/${target}h` : ''})
                </span>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
