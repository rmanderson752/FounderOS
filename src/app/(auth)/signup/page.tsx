'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Rocket, Layers, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthAside, GoogleButton, AuthField, AuthError, AuthSubmit } from '../shared'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    router.push('/onboarding')
    router.refresh()
  }

  const handleGoogleLogin = async () => {
    const supabase = createClient()

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const getPasswordStrength = () => {
    if (password.length === 0) return 0
    if (password.length < 6) return 1
    if (password.length < 8) return 2
    if (password.length < 12) return 3
    return 4
  }

  const strength = getPasswordStrength()
  const strengthColors = ['bg-surface-3', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500']
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']

  return (
    <div className="min-h-screen flex bg-canvas">
      <AuthAside
        headline={
          <>
            Ship more,
            <br />
            <span className="text-brand-500">decide less.</span>
          </>
        }
        blurb="Set up your week once. Founder OS keeps every project moving without the daily scramble."
        features={[
          { icon: Layers, text: 'One home for every project you run' },
          { icon: Timer, text: 'Time-blocked days that actually hold' },
          { icon: Rocket, text: 'Weekly reviews that keep you honest' },
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
              Let&apos;s get you set up ✨
            </h2>
            <p className="text-ink-3 text-[15px]">Free to start. No card needed.</p>
          </div>

          <GoogleButton onClick={handleGoogleLogin} label="Sign up with Google" />

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

          <form onSubmit={handleSignup} className="space-y-4">
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
              placeholder="At least 8 characters"
              autoComplete="new-password"
            >
              {password.length > 0 && (
                <div className="flex items-center gap-2.5 mt-2.5 pl-1">
                  <div className="flex gap-1.5 flex-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-colors duration-300',
                          level <= strength ? strengthColors[strength] : 'bg-surface-3'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-ink-3 w-11 text-right">
                    {strengthLabels[strength]}
                  </span>
                </div>
              )}
            </AuthField>

            <AuthError message={error} />

            <AuthSubmit isLoading={isLoading} loadingLabel="Creating account…">
              Create account
            </AuthSubmit>
          </form>

          <p className="text-center text-ink-4 text-xs mt-5 leading-relaxed">
            By signing up you agree to our Terms and Privacy Policy.
          </p>

          <p className="text-center text-ink-3 text-sm mt-6">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-brand-500 hover:text-brand-600 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
