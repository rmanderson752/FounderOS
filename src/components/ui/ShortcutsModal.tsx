// src/components/ui/ShortcutsModal.tsx
// Modal displaying available keyboard shortcuts
// Triggered by pressing '?' anywhere in the app

'use client'

import { useEffect, useState } from 'react'
import { X, Keyboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const SHORTCUTS = [
  { key: 'T', description: 'Go to Today' },
  { key: 'W', description: 'Go to Week view' },
  { key: 'P', description: 'Go to Progress' },
  { key: 'S', description: 'Go to Settings' },
  { key: 'N', description: 'New task' },
  { key: 'G', description: 'New goal' },
  { key: '?', description: 'Show shortcuts' },
  { key: 'Esc', description: 'Close modal' },
  { key: '⌘K', description: 'Open command palette' },
  { key: 'T', description: 'Go to Today' },
  { key: 'W', description: 'Go to Week view' },
  { key: 'P', description: 'Go to Progress' },
  { key: 'S', description: 'Go to Settings' },
  { key: 'N', description: 'New task' },
  { key: 'G', description: 'New goal' },
  { key: '?', description: 'Show shortcuts' },
  { key: 'Esc', description: 'Close modal' },
]

export function ShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleShow = () => setIsOpen(true)
    const handleClose = () => setIsOpen(false)

    window.addEventListener('show-shortcuts-modal', handleShow)
    window.addEventListener('close-modal', handleClose)

    return () => {
      window.removeEventListener('show-shortcuts-modal', handleShow)
      window.removeEventListener('close-modal', handleClose)
    }
  }, [])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-full max-w-sm bg-[#141417] border border-[#1F1F23] rounded-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, description }) => (
            <div 
              key={key}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#1A1A1E] transition-colors"
            >
              <span className="text-sm text-gray-300">{description}</span>
              <kbd className={cn(
                'px-2 py-1 text-xs font-mono font-medium rounded',
                'bg-[#1A1A1E] border border-[#2A2A30] text-gray-300'
              )}>
                {key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-xs text-gray-500 text-center mt-6">
          Press <kbd className="px-1.5 py-0.5 bg-[#1A1A1E] rounded text-gray-400">?</kbd> anytime to see shortcuts
        </p>
      </div>
    </div>
  )
}