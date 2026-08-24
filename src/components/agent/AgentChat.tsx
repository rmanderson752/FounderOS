// src/components/agent/AgentChat.tsx
// Slide-over chat panel from right side
'use client'

import { useRef, useEffect } from 'react'
import { X, Bot, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgent } from '@/hooks/useAgent'
import { AgentMessage } from './AgentMessage'
import { AgentInput } from './AgentInput'
import type { AgentAction } from '@/lib/agent/types'
import { useQueryClient } from '@tanstack/react-query'

interface AgentChatProps {
  open: boolean
  onClose: () => void
}

export function AgentChat({ open, onClose }: AgentChatProps) {
  const { messages, isStreaming, error, sendMessage, sendQuickAction, clearMessages } = useAgent()
  const scrollRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleApplyAction = (_action: AgentAction) => {
    // Invalidate template and tasks queries after action is applied
    queryClient.invalidateQueries({ queryKey: ['template'] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    // Also trigger calendar sync
    fetch('/api/google/calendar/sync', { method: 'POST' }).catch(() => {})
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-ink/15 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-canvas border-l border-line z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-ink">AI Assistant</h2>
                  <p className="text-xs text-ink-4">Schedule & planning help</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearMessages}
                    className="p-1.5 text-ink-4 hover:text-ink-2 transition-colors rounded-lg hover:bg-ink/[0.04]"
                    title="Clear conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-ink-4 hover:text-ink-2 transition-colors rounded-lg hover:bg-ink/[0.04]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                    <Bot className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-sm font-medium text-ink mb-1">
                    How can I help?
                  </h3>
                  <p className="text-xs text-ink-4 max-w-xs">
                    I can generate weekly templates, rebalance your schedule,
                    or give you insights from your review data.
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <AgentMessage
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    actions={msg.actions}
                    isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
                    onApplyAction={handleApplyAction}
                  />
                ))
              )}

              {error && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Input */}
            <AgentInput
              onSend={sendMessage}
              onQuickAction={sendQuickAction}
              disabled={isStreaming}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
