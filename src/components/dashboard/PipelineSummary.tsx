'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users, ChevronRight, Pin } from 'lucide-react'
import { Card, CardHeader, CardTitle, Badge, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'

// Mock data
const mockPipeline = {
  stages: [
    { id: 'cold', name: 'Cold', count: 12, color: 'bg-gray-500' },
    { id: 'warm', name: 'Warm', count: 5, color: 'bg-amber-500' },
    { id: 'pitched', name: 'Pitched', count: 3, color: 'bg-orange-500' },
    { id: 'closing', name: 'Closing', count: 1, color: 'bg-green-500' },
  ],
  nextAction: {
    contact: 'Sarah Chen',
    company: 'Sequoia',
    action: 'Follow up on term sheet',
    daysUntil: 2,
  },
  total: 21,
}

export function PipelineSummary() {
  const [pipeline] = useState(mockPipeline)

  if (pipeline.total === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add investors, customers, or candidates to track your pipeline"
          action={{
            label: 'Add Contact',
            onClick: () => {},
          }}
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investor Pipeline</CardTitle>
        <Link
          href="/pipeline"
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          View Pipeline
          <ChevronRight className="w-4 h-4" />
        </Link>
      </CardHeader>

      <div className="space-y-6">
        {/* Stage counts */}
        <div className="flex items-center justify-between">
          {pipeline.stages.map((stage) => (
            <div key={stage.id} className="text-center">
              <p className="text-2xl font-semibold text-white">{stage.count}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <div className={cn('w-2 h-2 rounded-full', stage.color)} />
                <p className="text-xs text-gray-400">{stage.name}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Next action */}
        {pipeline.nextAction && (
          <div className="flex items-start gap-3 p-3 bg-background-hover rounded-lg">
            <Pin className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">
                <span className="font-medium">{pipeline.nextAction.contact}</span>
                <span className="text-gray-400"> at </span>
                <span className="font-medium">{pipeline.nextAction.company}</span>
              </p>
              <p className="text-sm text-gray-400 truncate">{pipeline.nextAction.action}</p>
            </div>
            <Badge variant={pipeline.nextAction.daysUntil <= 1 ? 'warning' : 'neutral'}>
              {pipeline.nextAction.daysUntil === 0
                ? 'Today'
                : pipeline.nextAction.daysUntil === 1
                ? 'Tomorrow'
                : `${pipeline.nextAction.daysUntil}d`}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  )
}
