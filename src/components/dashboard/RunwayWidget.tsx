'use client'

import { useState } from 'react'
import { DollarSign, Pencil } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button, Modal, Input, ProgressBar, EmptyState } from '@/components/ui'
import { formatCurrency, calculateRunway } from '@/lib/utils'
import { cn } from '@/lib/utils'

// Mock data - will be replaced with real data
const mockRunway = {
  cashBalance: 412000,
  monthlyBurn: 50000,
  monthlyRevenue: 0,
  lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
}

export function RunwayWidget() {
  const [runway, setRunway] = useState(mockRunway)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    cashBalance: runway.cashBalance.toString(),
    monthlyBurn: runway.monthlyBurn.toString(),
    monthlyRevenue: runway.monthlyRevenue.toString(),
  })

  const calculation = calculateRunway(
    runway.cashBalance,
    runway.monthlyBurn,
    runway.monthlyRevenue
  )

  const statusColors = {
    healthy: 'text-green-400',
    caution: 'text-amber-400',
    critical: 'text-red-400',
  }

  const progressVariants = {
    healthy: 'success' as const,
    caution: 'warning' as const,
    critical: 'danger' as const,
  }

  const handleSave = () => {
    setRunway({
      cashBalance: parseFloat(formData.cashBalance) || 0,
      monthlyBurn: parseFloat(formData.monthlyBurn) || 0,
      monthlyRevenue: parseFloat(formData.monthlyRevenue) || 0,
      lastUpdated: new Date(),
    })
    setIsModalOpen(false)
  }

  const getDaysAgo = (date: Date) => {
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Updated today'
    if (days === 1) return 'Updated yesterday'
    return `Updated ${days} days ago`
  }

  // Show empty state if no runway data
  if (!runway.cashBalance && !runway.monthlyBurn) {
    return (
      <Card>
        <EmptyState
          icon={DollarSign}
          title="No runway data"
          description="Add your cash balance and burn rate to track runway"
          action={{
            label: 'Set Up Runway',
            onClick: () => setIsModalOpen(true),
          }}
        />
        <RunwayModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
        />
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Runway</CardTitle>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </CardHeader>

        <div className="space-y-4">
          {/* Main number */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-4xl font-semibold', statusColors[calculation.status])}>
                {calculation.months === Infinity ? '∞' : calculation.months.toFixed(1)}
              </span>
              <span className="text-gray-400 text-lg">months</span>
            </div>
            <ProgressBar
              value={Math.min(calculation.months, 12)}
              max={12}
              variant={progressVariants[calculation.status]}
              className="mt-3"
            />
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cash</p>
              <p className="text-white font-medium">{formatCurrency(runway.cashBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Monthly Burn</p>
              <p className="text-white font-medium">{formatCurrency(runway.monthlyBurn)}/mo</p>
            </div>
          </div>

          {/* Last updated */}
          <p className="text-xs text-gray-500">{getDaysAgo(runway.lastUpdated)}</p>
        </div>
      </Card>

      <RunwayModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
      />
    </>
  )
}

function RunwayModal({
  open,
  onClose,
  formData,
  setFormData,
  onSave,
}: {
  open: boolean
  onClose: () => void
  formData: { cashBalance: string; monthlyBurn: string; monthlyRevenue: string }
  setFormData: (data: { cashBalance: string; monthlyBurn: string; monthlyRevenue: string }) => void
  onSave: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Update Runway">
      <div className="space-y-4">
        <Input
          label="Cash Balance"
          type="number"
          value={formData.cashBalance}
          onChange={(e) => setFormData({ ...formData, cashBalance: e.target.value })}
          placeholder="500000"
        />
        <Input
          label="Monthly Burn"
          type="number"
          value={formData.monthlyBurn}
          onChange={(e) => setFormData({ ...formData, monthlyBurn: e.target.value })}
          placeholder="50000"
        />
        <Input
          label="Monthly Revenue (optional)"
          type="number"
          value={formData.monthlyRevenue}
          onChange={(e) => setFormData({ ...formData, monthlyRevenue: e.target.value })}
          placeholder="0"
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}
