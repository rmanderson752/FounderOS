// src/components/review/TimeAudit.tsx
'use client'

interface ProjectHours {
  key: string
  name: string
  color: string
  planned: number
  actual: number
}

interface TimeAuditProps {
  projects: ProjectHours[]
}

export function TimeAudit({ projects }: TimeAuditProps) {
  const totalPlanned = projects.reduce((s, p) => s + p.planned, 0)
  const totalActual = projects.reduce((s, p) => s + p.actual, 0)
  const maxHours = Math.max(...projects.map(p => Math.max(p.planned, p.actual)), 1)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Time Audit</h3>
        <div className="flex items-center gap-4 text-xs text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-surface-3" />
            Planned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
            Actual
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {projects.map((project) => {
          const plannedPct = (project.planned / maxHours) * 100
          const actualPct = (project.actual / maxHours) * 100
          const diff = project.actual - project.planned
          const diffSign = diff > 0 ? '+' : ''

          return (
            <div key={project.key}>
              {/* Project name + hours */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="text-sm text-ink">{project.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ink-4">
                    {project.planned.toFixed(1)}h planned
                  </span>
                  <span className="text-ink font-medium">
                    {project.actual.toFixed(1)}h actual
                  </span>
                  {project.planned > 0 && (
                    <span className={`font-medium ${
                      diff >= 0 ? 'text-green-400' : 'text-amber-400'
                    }`}>
                      {diffSign}{diff.toFixed(1)}h
                    </span>
                  )}
                </div>
              </div>

              {/* Bars */}
              <div className="space-y-1">
                {/* Planned bar (muted) */}
                <div className="h-3 bg-canvas rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-surface-3 transition-all"
                    style={{ width: `${plannedPct}%` }}
                  />
                </div>
                {/* Actual bar (colored) */}
                <div className="h-3 bg-canvas rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${actualPct}%`,
                      backgroundColor: project.color,
                      opacity: 0.8,
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total */}
      <div className="pt-3 border-t border-line">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Total</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink-3">{totalPlanned.toFixed(1)}h planned</span>
            <span className="text-ink font-semibold">{totalActual.toFixed(1)}h actual</span>
            {totalPlanned > 0 && (
              <span className={`font-medium ${
                totalActual >= totalPlanned ? 'text-green-400' : 'text-amber-400'
              }`}>
                {totalActual >= totalPlanned ? '+' : ''}
                {(totalActual - totalPlanned).toFixed(1)}h
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
