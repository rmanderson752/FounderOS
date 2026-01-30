// src/app/(dashboard)/layout.tsx
// Dashboard layout with navigation, goal switcher, and user menu

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Avatar, Button } from '@/components/ui'
import { GoalSwitcher } from '@/components/goals/GoalSwitcher'
import {
  LayoutDashboard,
  Calendar,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Target,
} from 'lucide-react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { ShortcutsModal } from '@/components/ui/ShortcutsModal'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { useUser } from '@/hooks/useUser'

const navigation = [
  { name: 'Today', href: '/', icon: LayoutDashboard },
  { name: 'Week', href: '/week', icon: Calendar },
  { name: 'Progress', href: '/progress', icon: TrendingUp },
  { name: 'Goals', href: '/goals', icon: Target },
]

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  
  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white w-full transition-colors"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4" />
          Light mode
        </>
      ) : (
        <>
          <Moon className="w-4 h-4" />
          Dark mode
        </>
      )}
    </button>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  
  // Get user data for avatar
  const { data: user } = useUser()
  
  // Global keyboard shortcuts
  useKeyboardShortcuts()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* Ambient background */}
      <div className="starfield" />
      <div className="ambient-bg" />
      
      {/* Top Navigation */}
      <nav className="h-16 border-b border-white/5 bg-[#09090B]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Logo & Goal Switcher */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="text-white font-semibold hidden sm:block">Founder OS</span>
            </Link>

            {/* Goal Switcher - Desktop */}
            <div className="hidden md:block border-l border-white/10 pl-6">
              <GoalSwitcher />
            </div>
          </div>

          {/* Desktop Navigation - Center */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'nav-pill flex items-center gap-2',
                    isActive && 'active'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Avatar size="sm" avatarId={user?.avatar_id} />
                <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 glass-card p-1 z-20">
                    <ThemeToggle />
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white w-full rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-400" />
              ) : (
                <Menu className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/5 bg-[#0C0C0F]">
          <div className="px-4 py-3 space-y-1">
            {/* Goal Switcher - Mobile */}
            <div className="pb-3 mb-3 border-b border-white/10">
              <GoalSwitcher />
            </div>
            
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-500/20 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
      
      <ShortcutsModal />
      <CommandPalette />
    </div>
  )
}