'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { CalendarDays, Sparkles, LineChart } from 'lucide-react'
import { AuthAside, GoogleButton, AuthField, AuthError, AuthSubmit } from '../shared'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Handle OAuth redirect with token in hash
  useEffect(() => {
    const handleAuthCallback = async () => {
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const supabase = createClient()
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (!error) {
            window.location.href = '/'
          }
        }
      }
    }

    handleAuthCallback()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  const handleGoogleLogin = () => {
    window.location.href =
      'https://botlicwjcsprmgjcvnus.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://founder-os-xi.vercel.app/login'
  }

  return (
    <div className="min-h-screen flex bg-canvas">
      <AuthAside
        headline={
          <>
            Your week,
            <br />
            <span className="text-brand-500">beautifully blocked.</span>
          </>
        }
        blurb="Every project gets its day. Stop deciding what to work on and start shipping."
        features={[
          { icon: CalendarDays, text: 'Assign projects to days of the week' },
          { icon: Sparkles, text: 'Eliminate daily decision fatigue' },
          { icon: LineChart, text: 'Track progress across all your projects' },
        ]}
      />

      <div className="w-full lg:w-[46%] xl:w-[42%] flex items-center justify-center p-6 sm:p-10">
        <motion.div
          className="w-full max-w-[380px]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-pop">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <span className="text-xl font-bold text-ink tracking-tight">Founder OS</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[28px] leading-tight font-bold text-ink tracking-tight mb-2">
              Welcome back 👋
            </h2>
            <p className="text-ink-3 text-[15px]">Let&apos;s pick up where you left off.</p>
          </div>

          <GoogleButton onClick={handleGoogleLogin} label="Continue with Google" />

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-canvas text-ink-4 text-xs font-semibold uppercase tracking-wider">
                or
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <AuthField
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <AuthField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="current-password"
              trailing={
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-brand-500 hover:text-brand-600 transition-colors"
                >
                  Forgot?
                </Link>
              }
            />

            <AuthError message={error} />

            <AuthSubmit isLoading={isLoading} loadingLabel="Signing in…">
              Sign in
            </AuthSubmit>
          </form>

          <p className="text-center text-ink-3 text-sm mt-7">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-semibold text-brand-500 hover:text-brand-600 transition-colors"
            >
              Sign up free
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
