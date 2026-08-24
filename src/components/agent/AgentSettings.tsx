// src/components/agent/AgentSettings.tsx
'use client'

import { Bot } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui'
import { useAgentSettings, useUpdateAgentSettings } from '@/hooks/useAgentSettings'

export function AgentSettings() {
  const { data: settings, isLoading } = useAgentSettings()
  const updateSettings = useUpdateAgentSettings()

  const toggle = (key: 'enabled' | 'auto_rebalance' | 'weekly_digest') => {
    if (!settings) return
    updateSettings.mutate({ [key]: !settings[key] })
  }

  const setPersonality = (personality: 'concise' | 'balanced' | 'detailed') => {
    updateSettings.mutate({ personality })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-ink-3" />
            <CardTitle>AI Assistant</CardTitle>
          </div>
        </CardHeader>
        <div className="h-32 bg-ink/[0.04] rounded-lg animate-pulse" />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-ink-3" />
          <CardTitle>AI Assistant</CardTitle>
        </div>
      </CardHeader>

      <div className="space-y-4">
        {/* Enable/Disable */}
        <ToggleRow
          label="Enable AI Assistant"
          description="Show AI suggestions and enable the chat panel"
          checked={settings?.enabled ?? true}
          onChange={() => toggle('enabled')}
        />

        {/* Auto-rebalance */}
        <ToggleRow
          label="Auto-rebalance suggestions"
          description="Suggest schedule adjustments when blocks are skipped"
          checked={settings?.auto_rebalance ?? false}
          onChange={() => toggle('auto_rebalance')}
        />

        {/* Weekly digest */}
        <ToggleRow
          label="Weekly review insights"
          description="Generate AI insights during your weekly review"
          checked={settings?.weekly_digest ?? true}
          onChange={() => toggle('weekly_digest')}
        />

        {/* Personality */}
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-2">
            Response style
          </label>
          <div className="flex gap-2">
            {(['concise', 'balanced', 'detailed'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPersonality(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  settings?.personality === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-ink/[0.04] text-ink-3 hover:bg-ink/[0.06] border border-line'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-ink">{label}</p>
        <p className="text-xs text-ink-4">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-ink/[0.06]'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'left-5' : 'left-1'
          }`}
        />
      </button>
    </div>
  )
}
