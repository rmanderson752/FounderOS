// src/components/agent/AgentInput.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Calendar, RefreshCw, Lightbulb } from 'lucide-react'

interface AgentInputProps {
  onSend: (message: string) => void
  onQuickAction: (endpoint: string) => void
  disabled?: boolean
}

const QUICK_ACTIONS = [
  {
    label: 'Generate template',
    icon: Calendar,
    endpoint: '/api/agent/generate-template',
  },
  {
    label: 'Rebalance week',
    icon: RefreshCw,
    endpoint: '/api/agent/rebalance',
  },
  {
    label: 'Review insights',
    icon: Lightbulb,
    endpoint: '/api/agent/review-insights',
  },
]

export function AgentInput({ onSend, onQuickAction, disabled }: AgentInputProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-line p-3 space-y-2.5">
      {/* Quick actions */}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_ACTIONS.map(({ label, icon: Icon, endpoint }) => (
          <button
            key={endpoint}
            onClick={() => onQuickAction(endpoint)}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-ink-3 bg-ink/[0.04] hover:bg-ink/[0.06] border border-line rounded-lg transition-colors disabled:opacity-50"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Chat input */}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your schedule..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-white border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50"
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:hover:bg-blue-600 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
