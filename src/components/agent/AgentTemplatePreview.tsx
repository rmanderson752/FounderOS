// src/components/agent/AgentTemplatePreview.tsx
'use client'

import { useState } from 'react'
import { Check, X, Calendar } from 'lucide-react'
import { Button } from '@/components/ui'
import { useProjects } from '@/hooks/useProjects'
import type { AgentAction, TemplateUpdateAction } from '@/lib/agent/types'
import { DAY_NAMES_SHORT } from '@/lib/constants'

interface AgentTemplatePreviewProps {
  action: AgentAction
  onApply: () => void
}

export function AgentTemplatePreview({ action, onApply }: AgentTemplatePreviewProps) {
  const [applied, setApplied] = useState(false)
  const [applying, setApplying] = useState(false)
  const { data: projects = [] } = useProjects()

  const handleApply = async () => {
    setApplying(true)
    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setApplied(true)
        onApply()
      }
    } finally {
      setApplying(false)
    }
  }

  if (action.type === 'template_update') {
    const templateAction = action as TemplateUpdateAction

    // Group blocks by day
    const byDay: Record<number, typeof templateAction.blocks> = {}
    for (const block of templateAction.blocks) {
      if (!byDay[block.day_of_week]) byDay[block.day_of_week] = []
      byDay[block.day_of_week].push(block)
    }

    return (
      <div className="bg-white border border-line-strong rounded-lg p-3 max-w-[85%]">
        <div className="flex items-center gap-2 mb-2.5">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-ink-2">
            Proposed Template
          </span>
        </div>

        {/* Mini week grid */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {[0, 1, 2, 3, 4, 5, 6].map(day => {
            const blocks = byDay[day] || []
            return (
              <div key={day} className="text-center">
                <div className="text-[10px] text-ink-4 mb-1">
                  {DAY_NAMES_SHORT[day]}
                </div>
                <div className="space-y-0.5">
                  {blocks.length > 0 ? (
                    blocks.map((block, i) => {
                      const project = projects.find(p => p.id === block.project_id)
                      return (
                        <div
                          key={i}
                          className="h-5 rounded text-[9px] text-ink-2 flex items-center justify-center truncate px-0.5"
                          style={{ backgroundColor: project?.color || '#3B82F6' }}
                          title={`${project?.name || 'Project'} — ${block.hours}h`}
                        >
                          {block.hours}h
                        </div>
                      )
                    })
                  ) : (
                    <div className="h-5 rounded bg-ink/[0.04] border border-dashed border-line" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Apply / Reject */}
        {!applied ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleApply}
              disabled={applying}
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {applying ? 'Applying...' : 'Apply'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setApplied(true)}
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Dismiss
            </Button>
          </div>
        ) : (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            Applied
          </p>
        )}
      </div>
    )
  }

  if (action.type === 'task_reorder') {
    return (
      <div className="bg-white border border-line-strong rounded-lg p-3 max-w-[85%]">
        <p className="text-xs text-ink-3 mb-2">Task priority reorder suggested</p>
        {!applied ? (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleApply} disabled={applying}>
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {applying ? 'Applying...' : 'Apply'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setApplied(true)}>
              <X className="w-3.5 h-3.5 mr-1.5" />
              Dismiss
            </Button>
          </div>
        ) : (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            Applied
          </p>
        )}
      </div>
    )
  }

  return null
}
