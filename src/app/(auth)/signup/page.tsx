'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'

// Shooting star type
interface ShootingStar {
  id: number
  x: number
  y: number
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([])
  const brandingRef = useRef<HTMLDivElement>(null)
  const starIdRef = useRef(0)
  const lastStarTime = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle mouse move to create shooting stars
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!brandingRef.current) return
    
    const now = Date.now()
    // Throttle to one star every 150ms
    if (now - lastStarTime.current < 150) return
    
    const rect = brandingRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Only create stars in certain area (not too close to edges)
    if (x < 50 || x > rect.width - 50 || y < 50 || y > rect.height - 50) return
    
    const newStar: ShootingStar = {
      id: starIdRef.current++,
      x,
      y,
    }
    
    lastStarTime.current = now
    setShootingStars(prev => [...prev.slice(-3), newStar]) // Keep max 4 stars
    
    // Remove star after animation completes
    setTimeout(() => {
      setShootingStars(prev => prev.filter(s => s.id !== newStar.id))
    }, 1500)
  }, [])

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
  const strengthColors = ['bg-gray-700', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500']
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']

  return (
    <div className="min-h-screen flex bg-[#07070a]">
      {/* Left side - Branding */}
      <div 
        ref={brandingRef}
        className="hidden lg:flex lg:w-[55%] xl:w-[58%] relative overflow-hidden bg-[#07070a]"
        onMouseMove={handleMouseMove}
      >
        {/* Static starfield background */}
        <div className="absolute inset-0">
          {/* Layer 1 - Tiny distant stars */}
          <div 
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: `
                radial-gradient(1px 1px at 100px 50px, rgba(255,255,255,0.4), transparent),
                radial-gradient(1px 1px at 200px 150px, rgba(255,255,255,0.3), transparent),
                radial-gradient(1px 1px at 300px 100px, rgba(255,255,255,0.4), transparent),
                radial-gradient(1px 1px at 400px 200px, rgba(255,255,255,0.3), transparent),
                radial-gradient(1px 1px at 500px 80px, rgba(255,255,255,0.5), transparent),
                radial-gradient(1px 1px at 150px 250px, rgba(255,255,255,0.3), transparent),
                radial-gradient(1px 1px at 350px 300px, rgba(255,255,255,0.4), transparent),
                radial-gradient(1px 1px at 450px 350px, rgba(255,255,255,0.3), transparent),
                radial-gradient(1px 1px at 50px 180px, rgba(255,255,255,0.4), transparent),
                radial-gradient(1px 1px at 250px 220px, rgba(255,255,255,0.3), transparent)
              `,
              backgroundSize: '550px 400px',
            }}
          />
          
          {/* Layer 2 - Medium stars with subtle twinkle */}
          <div 
            className="absolute inset-0 opacity-50 animate-pulse"
            style={{
              backgroundImage: `
                radial-gradient(1.5px 1.5px at 80px 120px, rgba(147,197,253,0.6), transparent),
                radial-gradient(1.5px 1.5px at 220px 80px, rgba(196,181,253,0.5), transparent),
                radial-gradient(1.5px 1.5px at 380px 180px, rgba(147,197,253,0.6), transparent),
                radial-gradient(1.5px 1.5px at 480px 120px, rgba(255,255,255,0.5), transparent),
                radial-gradient(1.5px 1.5px at 120px 320px, rgba(196,181,253,0.5), transparent),
                radial-gradient(1.5px 1.5px at 320px 280px, rgba(147,197,253,0.6), transparent)
              `,
              backgroundSize: '600px 450px',
              animationDuration: '4s',
            }}
          />
          
          {/* Layer 3 - Bright accent stars */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                radial-gradient(2px 2px at 180px 100px, rgba(16,185,129,0.7), transparent),
                radial-gradient(2px 2px at 420px 220px, rgba(52,211,153,0.6), transparent),
                radial-gradient(2px 2px at 280px 350px, rgba(16,185,129,0.7), transparent)
              `,
              backgroundSize: '600px 500px',
            }}
          />
          
          {/* Subtle nebula glow - emerald tint for signup */}
          <div 
            className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full opacity-15"
            style={{
              background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
        </div>

        {/* Shooting stars layer */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {shootingStars.map(star => (
            <div
              key={star.id}
              className="shooting-star-container"
              style={{
                position: 'absolute',
                left: star.x,
                top: star.y,
              }}
            >
              {/* The comet head */}
              <div className="comet-head" />
              {/* The tail */}
              <div className="comet-tail" />
            </div>
          ))}
        </div>

        {/* Content */}
        <motion.div 
          className="relative z-10 flex flex-col justify-center px-12 xl:px-20 2xl:px-24"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Logo - Enhanced */}
          <div className="flex items-center gap-3.5 mb-16">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <span className="text-white font-bold text-lg tracking-tight">F</span>
              </div>
              {/* Subtle glow behind logo */}
              <div className="absolute inset-0 rounded-xl bg-indigo-500/20 blur-xl -z-10" />
            </div>
            <div className="flex flex-col">
              <span className="text-[22px] font-semibold text-white tracking-tight leading-none">Founder OS</span>
              <span className="text-[11px] text-gray-500 tracking-wide mt-0.5">PRODUCTIVITY SYSTEM</span>
            </div>
          </div>
          
          {/* Main headline */}
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight mb-5">
            Start shipping
            <br />
            <span className="text-gray-500">what matters.</span>
          </h1>
          
          <p className="text-base text-gray-500 max-w-sm leading-relaxed mb-12">
            The productivity system for ambitious makers. Free forever.
          </p>

          {/* Benefits - clean checkmarks */}
          <div className="space-y-3.5">
            {[
              'Set clear goals with deadlines',
              'Break goals into daily tasks',
              'Track time and see your progress',
            ].map((benefit, index) => (
              <motion.div
                key={index}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: mounted ? 1 : 0, x: mounted ? 0 : -10 }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-400 text-sm">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-[45%] xl:w-[42%] flex items-center justify-center p-6 sm:p-8 bg-[#0a0a0d]">
        <motion.div 
          className="w-full max-w-[360px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <span className="text-xl font-semibold text-white">Founder OS</span>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-2">Create account</h2>
            <p className="text-gray-500 text-sm">Get started free today</p>
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full h-11 flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-medium text-sm rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[#0a0a0d] text-gray-600">or</span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full h-11 px-3.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className="w-full h-11 px-3.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                          strength >= level ? strengthColors[strength] : 'bg-gray-800'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    strength <= 1 ? 'text-red-400' : 
                    strength === 2 ? 'text-orange-400' : 
                    strength === 3 ? 'text-yellow-400' : 
                    'text-emerald-400'
                  }`}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <motion.div 
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-xs text-red-400">{error}</p>
              </motion.div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-11 text-sm font-medium bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create free account'
              )}
            </button>
          </form>

          {/* Terms */}
          <p className="text-center text-xs text-gray-600 mt-4">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-gray-500 hover:text-gray-400 underline">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-gray-500 hover:text-gray-400 underline">Privacy</Link>
          </p>

          {/* Sign in link */}
          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <Link 
              href="/login" 
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Shooting star styles - emerald tint for signup */}
      <style jsx>{`
        .shooting-star-container {
          transform: rotate(35deg);
          transform-origin: center;
        }
        
        .comet-head {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: white;
          box-shadow: 
            0 0 10px 2px rgba(52, 211, 153, 0.8),
            0 0 20px 4px rgba(16, 185, 129, 0.6),
            0 0 30px 6px rgba(16, 185, 129, 0.3);
          animation: cometMove 1.2s ease-out forwards;
        }
        
        .comet-tail {
          position: absolute;
          top: 2px;
          right: 6px;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, 
            rgba(52, 211, 153, 0.8) 0%,
            rgba(16, 185, 129, 0.5) 30%,
            rgba(5, 150, 105, 0.3) 60%,
            transparent 100%
          );
          border-radius: 2px;
          animation: tailGrow 1.2s ease-out forwards;
        }
        
        @keyframes cometMove {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translate(200px, 120px);
            opacity: 0;
          }
        }
        
        @keyframes tailGrow {
          0% {
            width: 0;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            width: 150px;
            opacity: 0.8;
          }
          100% {
            width: 80px;
            opacity: 0;
            transform: translate(200px, 120px);
          }
        }
      `}</style>
    </div>
  )
}