// src/components/ui/CommandPalette.tsx
// Global command palette triggered by Cmd+K / Ctrl+K
// Allows quick navigation, task creation, and actions from anywhere

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  LayoutDashboard,
  Settings,
  Plus,
  Target,
  Keyboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  icon: React.ElementType
  shortcut?: string
  action: () => void
  section: 'navigation' | 'actions' | 'settings'
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()

  const commands: Command[] = useMemo(() => [
    // Navigation — v3 daily path only; /week and /progress are off the
    // daily path and reachable by direct URL (see the v3 brief, section 2).
    { 
      id: 'today', 
      label: 'Go to Today', 
      icon: LayoutDashboard, 
      shortcut: 'T',
      action: () => router.push('/'),
      section: 'navigation',
    },
    { 
      id: 'settings', 
      label: 'Go to Settings', 
      icon: Settings, 
      shortcut: 'S',
      action: () => router.push('/settings'),
      section: 'navigation',
    },
    // Actions
    { 
      id: 'new-task', 
      label: 'Create new task', 
      icon: Plus, 
      shortcut: 'N',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-add-task'))
      },
      section: 'actions',
    },
    { 
      id: 'new-goal', 
      label: 'Create new goal', 
      icon: Target, 
      shortcut: 'G',
      action: () => {
        window.dispatchEvent(new CustomEvent('open-add-goal'))
      },
      section: 'actions',
    },
    // Settings
    {
      id: 'shortcuts',
      label: 'View keyboard shortcuts', 
      icon: Keyboard, 
      shortcut: '?',
      action: () => {
        window.dispatchEvent(new CustomEvent('show-shortcuts-modal'))
      },
      section: 'settings',
    },
  ], [router])

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands
    const query = search.toLowerCase()
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(query)
    )
  }, [commands, search])

  // Group by section
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {
      navigation: [],
      actions: [],
      settings: [],
    }
    filteredCommands.forEach(cmd => {
      groups[cmd.section].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Open with Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setIsOpen(prev => !prev)
      setSearch('')
      setSelectedIndex(0)
      return
    }

    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
          setIsOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }, [isOpen, filteredCommands, selectedIndex])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  if (!isOpen) return null

  const sectionLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    settings: 'Settings',
  }

  let flatIndex = -1

  return (
    <div 
      className="fixed inset-0 bg-ink/25 backdrop-blur-sm flex items-start justify-center pt-[20vh] p-4 z-50"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-full max-w-lg bg-white border border-line rounded-3xl shadow-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <Search className="w-5 h-5 text-ink-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-ink placeholder-gray-500 outline-none text-sm"
            autoFocus
          />
          <kbd className="px-2 py-0.5 text-xs bg-surface-3 border border-line-strong rounded text-ink-3">
            ESC
          </kbd>
        </div>

        {/* Commands list */}
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-ink-4">
              <p className="text-sm">No commands found</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([section, cmds]) => {
              if (cmds.length === 0) return null
              return (
                <div key={section} className="mb-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-ink-4 uppercase tracking-wide">
                    {sectionLabels[section]}
                  </div>
                  {cmds.map((cmd) => {
                    flatIndex++
                    const isSelected = flatIndex === selectedIndex
                    const Icon = cmd.icon
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.action()
                          setIsOpen(false)
                        }}
                        className={cn(
                          'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors',
                          isSelected 
                            ? 'bg-blue-500/20 text-ink' 
                            : 'text-ink-2 hover:bg-surface-3'
                        )}
                      >
                        <Icon className={cn(
                          'w-4 h-4',
                          isSelected ? 'text-blue-400' : 'text-ink-3'
                        )} />
                        <span className="flex-1 text-sm">{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className={cn(
                            'px-1.5 py-0.5 text-xs rounded',
                            isSelected 
                              ? 'bg-blue-500/30 text-blue-300' 
                              : 'bg-surface-3 border border-line-strong text-ink-4'
                          )}>
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-line flex items-center justify-between text-xs text-ink-4">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-surface-3 border border-line-strong rounded">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-surface-3 border border-line-strong rounded">↵</kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-surface-3 border border-line-strong rounded">⌘K</kbd>
            <span>Toggle</span>
          </div>
        </div>
      </div>
    </div>
  )
}