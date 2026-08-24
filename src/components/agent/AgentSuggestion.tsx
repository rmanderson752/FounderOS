// src/components/agent/AgentSuggestion.tsx
// Inline suggestion card for daily view and review page
'use client'

import { useState } from 'react'
import { Bot, X, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface AgentSuggestionProps {
  message: string
  actionLabel?: string
  onAction?: () => void
  onDismiss?: () => void
}

export function AgentSuggestion({
  message,
  actionLabel = 'Let\'s do it',
  onAction,
  onDismiss,
}: AgentSuggestionProps) {
  const [dismissed, setDismissed] = useState(false)

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3.5"
        >
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 leading-relaxed">{message}</p>
              <div className="flex items-center gap-2 mt-2.5">
                {onAction && (
                  <button
                    onClick={onAction}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                  >
                    {actionLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={handleDismiss}
                  className="p-1.5 text-ink-4 hover:text-ink-2 rounded-lg hover:bg-ink/[0.04] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
