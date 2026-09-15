// src/app/(dashboard)/layout.tsx
// Dashboard layout with collapsible sidebar navigation

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui'
import {
  Activity,
  Flag,
  Link2,
  LayoutDashboard,
  Settings,
  LogOut,
  Bot,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ChevronsUpDown,
} from 'lucide-react'
import { ShortcutsModal } from '@/components/ui/ShortcutsModal'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { useUser } from '@/hooks/useUser'
import { AgentChat } from '@/components/agent'
import { AnimatePresence, motion } from 'framer-motion'

// v4: the card, the goals behind it, and the signals it was built from.
// /week, /projects, /review, /metrics, /legacy and /legacy/goals still compile
// and load by direct URL — removed from navigation, not deleted (DECISIONS D7).
const navigation = [
  { name: 'Today', href: '/', icon: LayoutDashboard },
  { name: 'Your day', href: '/day', icon: Link2 },
  { name: 'Goals', href: '/goals', icon: Flag },
  { name: 'Signals', href: '/signals', icon: Activity },
]

const secondaryNav = [
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)

  // Get user data for avatar
  const { data: user } = useUser()

  // Global keyboard shortcuts
  useKeyboardShortcuts()

  // Listen for custom events to open agent panel
  useEffect(() => {
    const handler = () => setAgentOpen(true)
    window.addEventListener('open-agent', handler)
    return () => window.removeEventListener('open-agent', handler)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Persist sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-expanded')
    if (saved !== null) setSidebarExpanded(JSON.parse(saved))
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded(prev => {
      const next = !prev
      localStorage.setItem('sidebar-expanded', JSON.stringify(next))
      return next
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const sidebarContent = (isMobile = false) => (
    <>
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 h-14 flex-shrink-0">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-pop flex-shrink-0">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className={cn(
            'text-ink font-bold text-[15px] tracking-tight truncate sidebar-label',
            !sidebarExpanded && !isMobile && 'opacity-0'
          )}>
            Founder OS
          </span>
        </Link>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        <div className="sidebar-section-label">Navigate</div>
        {navigation.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'sidebar-nav-item',
                isActive && 'active'
              )}
              title={!sidebarExpanded && !isMobile ? item.name : undefined}
            >
              <item.icon className="sidebar-icon" />
              <span className="sidebar-label">{item.name}</span>
            </Link>
          )
        })}

        <div className="sidebar-section-label mt-4">System</div>
        {secondaryNav.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'sidebar-nav-item',
                isActive && 'active'
              )}
              title={!sidebarExpanded && !isMobile ? item.name : undefined}
            >
              <item.icon className="sidebar-icon" />
              <span className="sidebar-label">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex-shrink-0 border-t border-line p-2 pb-3">
        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="sidebar-user w-full"
          >
            <Avatar size="sm" avatarId={user?.avatar_id} />
            {(sidebarExpanded || isMobile) && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-ink truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-ink-4 truncate">
                  {user?.email || ''}
                </p>
              </div>
            )}
            {(sidebarExpanded || isMobile) && (
              <ChevronsUpDown className="w-4 h-4 text-ink-4 flex-shrink-0" />
            )}
          </button>

          {/* User dropdown */}
          <AnimatePresence>
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-50"
                  onClick={() => setUserMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'absolute z-50 w-52 bg-white border border-line rounded-2xl shadow-xl p-1.5',
                    sidebarExpanded || isMobile
                      ? 'bottom-full left-2 mb-1'
                      : 'left-full bottom-0 ml-2'
                  )}
                >
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-3 hover:text-ink rounded-xl transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-ink-2 hover:bg-red-50 hover:text-red-600 w-full rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button
            onClick={toggleSidebar}
            className="sidebar-nav-item w-full mt-1 justify-center"
            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarExpanded ? (
              <ChevronLeft className="sidebar-icon" />
            ) : (
              <ChevronRight className="sidebar-icon" />
            )}
            <span className="sidebar-label">Collapse</span>
          </button>
        )}
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-canvas">
      {/* Soft ambient wash */}
      <div className="ambient-bg" />

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'sidebar hidden md:flex',
          sidebarExpanded ? 'expanded' : 'collapsed'
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl backdrop-saturate-150 border-b border-line flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2.5 -ml-2 rounded-full text-ink-3 hover:text-ink hover:bg-ink/[0.05] transition-colors active:scale-90"
        >
          <Menu className="w-5 h-5" strokeWidth={2.25} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-pop">
            <span className="text-white font-bold text-xs">F</span>
          </div>
          <span className="text-ink font-bold text-[15px] tracking-tight">Founder OS</span>
        </Link>
      </header>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="sidebar-overlay md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="sidebar expanded md:hidden"
              initial={{ x: -244 }}
              animate={{ x: 0 }}
              exit={{ x: -244 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Close button */}
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-3.5 right-3.5 p-2 rounded-full text-ink-3 hover:text-ink hover:bg-ink/[0.05] transition-colors z-10 active:scale-90"
              >
                <X className="w-4 h-4" strokeWidth={2.25} />
              </button>
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main
        className={cn(
          'relative z-10 min-h-screen transition-[margin] duration-200',
          'md:ml-[244px]',
          !sidebarExpanded && 'md:ml-[76px]'
        )}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          {children}
        </div>
      </main>

      {/* Agent floating button */}
      <button
        onClick={() => setAgentOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white',
          'shadow-[0_6px_16px_-4px_rgba(108,92,231,0.5)] flex items-center justify-center z-30',
          'transition-transform duration-200 ease-out hover:scale-110 active:scale-95'
        )}
        title="AI Assistant"
      >
        <Bot className="w-6 h-6" strokeWidth={2} />
      </button>

      {/* Agent chat panel */}
      <AgentChat open={agentOpen} onClose={() => setAgentOpen(false)} />

      <ShortcutsModal />
      <CommandPalette />
    </div>
  )
}
