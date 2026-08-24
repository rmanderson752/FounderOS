// src/hooks/useAgent.ts
// Chat hook with streaming support
'use client'

import { useState, useCallback, useRef } from 'react'
import { parseActions } from '@/lib/agent/parse'
import type { AgentAction } from '@/lib/agent/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  actions?: AgentAction[]
}

interface UseAgentReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  sendMessage: (message: string) => Promise<void>
  sendQuickAction: (endpoint: string) => Promise<void>
  executeAction: (action: AgentAction) => Promise<boolean>
  clearMessages: () => void
}

export function useAgent(): UseAgentReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)

  const sendMessage = useCallback(async (message: string) => {
    setError(null)
    setIsStreaming(true)

    // Add user message immediately
    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    // Add placeholder for assistant response
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationId: conversationIdRef.current,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Chat failed')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        fullResponse += text

        // Update the last message (assistant) with streamed text
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: fullResponse }
          }
          return updated
        })
      }

      // Parse actions from the complete response
      const actions = parseActions(fullResponse)
      if (actions.length > 0) {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, actions }
          }
          return updated
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      // Remove the empty assistant message on error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const sendQuickAction = useCallback(async (endpoint: string) => {
    setError(null)
    setIsStreaming(true)

    const actionLabels: Record<string, string> = {
      '/api/agent/generate-template': 'Generate my weekly template',
      '/api/agent/rebalance': 'Rebalance this week',
      '/api/agent/review-insights': 'Give me review insights',
    }

    // Add a user-facing label for the quick action
    const userMsg: ChatMessage = {
      role: 'user',
      content: actionLabels[endpoint] || 'Quick action',
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      // Review insights uses non-streaming JSON response
      if (endpoint === '/api/agent/review-insights') {
        const res = await fetch(endpoint, { method: 'POST' })
        if (!res.ok) throw new Error('Request failed')
        const data = await res.json()
        const content = data.insights || 'No insights available.'

        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content,
            timestamp: new Date().toISOString(),
          }
          return updated
        })
        return
      }

      // Streaming endpoints
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) throw new Error('Request failed')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        fullResponse += text

        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: fullResponse }
          }
          return updated
        })
      }

      const actions = parseActions(fullResponse)
      if (actions.length > 0) {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, actions }
          }
          return updated
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const executeAction = useCallback(async (action: AgentAction): Promise<boolean> => {
    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) return false
      return true
    } catch {
      return false
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    conversationIdRef.current = null
    setError(null)
  }, [])

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    sendQuickAction,
    executeAction,
    clearMessages,
  }
}
