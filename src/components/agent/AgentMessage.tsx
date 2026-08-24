// src/components/agent/AgentMessage.tsx
'use client'

import { Bot, User } from 'lucide-react'
import type { AgentAction } from '@/lib/agent/types'
import { AgentTemplatePreview } from './AgentTemplatePreview'

interface AgentMessageProps {
  role: 'user' | 'assistant'
  content: string
  actions?: AgentAction[]
  isStreaming?: boolean
  onApplyAction?: (action: AgentAction) => void
}

/**
 * Strip ```action blocks from displayed content
 * (they get rendered as AgentTemplatePreview instead)
 */
function stripActionBlocks(content: string): string {
  return content.replace(/```action\s*\n[\s\S]*?```/g, '').trim()
}

export function AgentMessage({
  role,
  content,
  actions,
  isStreaming,
  onApplyAction,
}: AgentMessageProps) {
  const displayContent = stripActionBlocks(content)

  return (
    <div className={`flex gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          role === 'assistant'
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-ink/[0.06] text-ink-3'
        }`}
      >
        {role === 'assistant' ? (
          <Bot className="w-4 h-4" />
        ) : (
          <User className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${role === 'user' ? 'text-right' : ''}`}>
        <div
          className={`inline-block text-sm leading-relaxed rounded-xl px-3.5 py-2.5 max-w-[85%] ${
            role === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-surface-3 text-gray-200 border border-line-strong'
          }`}
        >
          {displayContent ? (
            <div className="whitespace-pre-wrap">{displayContent}</div>
          ) : isStreaming ? (
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          ) : null}
        </div>

        {/* Action previews */}
        {actions && actions.length > 0 && (
          <div className="mt-2 space-y-2">
            {actions.map((action, i) => (
              <AgentTemplatePreview
                key={i}
                action={action}
                onApply={() => onApplyAction?.(action)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
