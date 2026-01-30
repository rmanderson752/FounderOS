'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button, Modal, Input, Select, EmptyState } from '@/components/ui'
import { formatMetricValue, calculateTrend, cn } from '@/lib/utils'

// Mock data
const mockMetrics = [
  {
    id: '1',
    name: 'MRR',
    type: 'currency' as const,
    current: 4200,
    previous: 3750,
    history: [2800, 3100, 3400, 3500, 3600, 3750, 4000, 4200],
  },
  {
    id: '2',
    name: 'Users',
    type: 'number' as const,
    current: 1247,
    previous: 1158,
    history: [850, 920, 980, 1020, 1080, 1120, 1158, 1247],
  },
  {
    id: '3',
    name: 'Conversion',
    type: 'percentage' as const,
    current: 3.2,
    previous: 3.2,
    history: [2.8, 2.9, 3.0, 3.1, 3.0, 3.1, 3.2, 3.2],
  },
]

export function MetricsWidget() {
  const [metrics, setMetrics] = useState(mockMetrics)
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (metrics.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={TrendingUp}
          title="No metrics tracked"
          description="Add the numbers that matter most to your business"
          action={{
            label: 'Add Metric',
            onClick: () => setIsModalOpen(true),
          }}
        />
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Key Metrics</CardTitle>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </CardHeader>

        <div className="grid grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      </Card>

      <AddMetricModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={(newMetric) => {
          setMetrics([...metrics, newMetric])
          setIsModalOpen(false)
        }}
      />
    </>
  )
}

function MetricCard({
  metric,
}: {
  metric: {
    id: string
    name: string
    type: 'currency' | 'number' | 'percentage'
    current: number
    previous: number
    history: number[]
  }
}) {
  const trend = calculateTrend(metric.current, metric.previous)

  const TrendIcon = trend.direction === 'up' 
    ? TrendingUp 
    : trend.direction === 'down' 
    ? TrendingDown 
    : Minus

  const trendColor = trend.direction === 'up'
    ? 'text-green-400'
    : trend.direction === 'down'
    ? 'text-red-400'
    : 'text-gray-400'

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{metric.name}</p>
      <p className="text-xl font-semibold text-white">
        {formatMetricValue(metric.current, metric.type)}
      </p>
      <div className={cn('flex items-center gap-1 text-xs', trendColor)}>
        <TrendIcon className="w-3 h-3" />
        <span>
          {trend.direction === 'flat' ? '0%' : `${trend.percentage.toFixed(1)}%`}
        </span>
      </div>
      {/* Sparkline */}
      <Sparkline data={metric.history} />
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <svg
      className="w-full h-8"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-blue-500"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function AddMetricModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (metric: any) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'currency' | 'number' | 'percentage'>('number')

  const handleAdd = () => {
    if (!name.trim()) return

    onAdd({
      id: Date.now().toString(),
      name: name.trim(),
      type,
      current: 0,
      previous: 0,
      history: [0],
    })

    setName('')
    setType('number')
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Metric">
      <div className="space-y-4">
        <Input
          label="Metric Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., MRR, Users, Conversion Rate"
        />
        <Select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          options={[
            { value: 'number', label: 'Number' },
            { value: 'currency', label: 'Currency ($)' },
            { value: 'percentage', label: 'Percentage (%)' },
          ]}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!name.trim()}>
            Add Metric
          </Button>
        </div>
      </div>
    </Modal>
  )
}
