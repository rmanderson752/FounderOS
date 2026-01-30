// src/hooks/useKeyboardShortcuts.ts
// Global keyboard shortcuts for quick navigation and actions
// Supports: n (new task), g (new goal), t (today), w (week), p (progress), ? (help)

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ShortcutActions {
  onNewTask?: () => void
  onNewGoal?: () => void
}

export function useKeyboardShortcuts(actions?: ShortcutActions) {
  const router = useRouter()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return
    }

    // Ignore if modifier keys are pressed (except for ?)
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return
    }

    switch (e.key) {
      case 't':
      case 'T':
        e.preventDefault()
        router.push('/')
        break
      case 'w':
      case 'W':
        e.preventDefault()
        router.push('/week')
        break
      case 'p':
      case 'P':
        e.preventDefault()
        router.push('/progress')
        break
      case 's':
      case 'S':
        e.preventDefault()
        router.push('/settings')
        break
      case 'n':
      case 'N':
        e.preventDefault()
        actions?.onNewTask?.()
        break
      case 'g':
      case 'G':
        e.preventDefault()
        actions?.onNewGoal?.()
        break
      case '?':
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('show-shortcuts-modal'))
        break
      case 'Escape':
        window.dispatchEvent(new CustomEvent('close-modal'))
        break
    }
  }, [router, actions])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}