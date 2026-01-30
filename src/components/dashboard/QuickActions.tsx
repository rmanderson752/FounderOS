'use client'

import { useState } from 'react'
import { DollarSign, TrendingUp, Target, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

export function QuickActions() {
  const [isOpen, setIsOpen] = useState(false)

  const actions = [
    { icon: DollarSign, label: 'Update Cash', onClick: () => {} },
    { icon: TrendingUp, label: 'Log Metric', onClick: () => {} },
    { icon: Target, label: 'Add Priority', onClick: () => {} },
  ]

  return (
    <div className="relative">
      {/* Desktop: Show actions inline */}
      <div className="hidden sm:flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="text-gray-400"
          >
            <action.icon className="w-4 h-4 mr-1.5" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Mobile: Show dropdown */}
      <div className="sm:hidden">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Quick Actions
        </Button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-48 bg-background-card border border-border-subtle rounded-lg shadow-lg z-20 py-1">
              {actions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    action.onClick()
                    setIsOpen(false)
                  }}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-background-hover hover:text-white w-full"
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
