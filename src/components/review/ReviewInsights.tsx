// src/components/review/ReviewInsights.tsx
// AI-generated insights shown on the review page
'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { useAgentSettings } from '@/hooks/useAgentSettings'

export function ReviewInsights() {
  const { data: settings } = useAgentSettings()
  const [insights, setInsights] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only show if agent + weekly digest is enabled
  if (!settings?.enabled || !settings?.weekly_digest) return null

  const fetchInsights = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/agent/review-insights', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to generate insights')
      const data = await res.json()
      setInsights(data.insights || 'No insights available.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-ink">AI Insights</h3>
        </div>
        {insights && (
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="p-1.5 text-ink-4 hover:text-ink-2 rounded-lg hover:bg-ink/[0.04] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {!insights && !loading && !error && (
        <div>
          <p className="text-sm text-ink-3 mb-3">
            Get AI-powered insights based on your review data and patterns.
          </p>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Insights
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyzing your data...
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {insights && !loading && (
        <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
          {insights}
        </div>
      )}
    </div>
  )
}
