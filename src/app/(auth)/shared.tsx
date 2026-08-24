// src/app/(auth)/shared.tsx
// Shared chrome for the sign-in / sign-up screens — warm, rounded, welcoming.

'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Feature {
  icon: LucideIcon
  text: string
}

export function AuthAside({
  headline,
  blurb,
  features,
}: {
  headline: ReactNode
  blurb: string
  features: Feature[]
}) {
  return (
    <div className="hidden lg:flex lg:w-[54%] xl:w-[58%] relative overflow-hidden bg-canvas-deep">
      {/* Soft pastel blobs */}
      <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-brand-200/50 blur-3xl animate-float" />
      <div
        className="absolute bottom-[-14rem] left-1/3 w-[540px] h-[540px] rounded-full bg-amber-100/70 blur-3xl animate-float"
        style={{ animationDelay: '2.5s' }}
      />
      <div
        className="absolute top-1/3 right-[-10rem] w-[460px] h-[460px] rounded-full bg-emerald-100/70 blur-3xl animate-float"
        style={{ animationDelay: '1.2s' }}
      />

      <motion.div
        className="relative z-10 flex flex-col justify-center px-12 xl:px-20 2xl:px-24"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-3.5 mb-14">
          <div className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-pop">
            <span className="text-white font-bold text-xl tracking-tight">F</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[22px] font-bold text-ink tracking-tight leading-none">
              Founder OS
            </span>
            <span className="text-[11px] font-semibold text-ink-4 tracking-[0.14em] mt-1">
              WEEKLY BLOCK PLANNER
            </span>
          </div>
        </div>

        <h1 className="text-4xl xl:text-[52px] font-bold text-ink leading-[1.12] tracking-tight mb-6">
          {headline}
        </h1>

        <p className="text-[17px] text-ink-3 max-w-md leading-relaxed mb-12">{blurb}</p>

        <div className="space-y-3">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="flex items-center gap-3.5 bg-white/70 backdrop-blur-sm border border-white/80 rounded-3xl px-5 py-4 shadow-sm max-w-md"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + index * 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="text-ink-2 text-[15px] font-medium">{feature.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export function GoogleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full h-12 flex items-center justify-center gap-3 rounded-full',
        'bg-white border border-line text-ink font-semibold text-sm shadow-xs',
        'transition-all duration-200 ease-out',
        'hover:border-line-strong hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98]'
      )}
    >
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {label}
    </button>
  )
}

export function AuthField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  trailing,
  children,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  trailing?: ReactNode
  children?: ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 pl-1">
        <label className="block text-[13px] font-semibold text-ink-2">{label}</label>
        {trailing}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className={cn(
          'w-full h-12 px-4 rounded-2xl bg-surface-3 border border-transparent',
          'text-ink text-sm placeholder:text-ink-4 transition-all duration-200',
          'focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15'
        )}
      />
      {children}
    </div>
  )
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null
  return (
    <motion.div
      className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-100"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-[13px] font-medium text-red-600 leading-snug">{message}</p>
    </motion.div>
  )
}

export function AuthSubmit({
  isLoading,
  loadingLabel,
  children,
}: {
  isLoading: boolean
  loadingLabel: string
  children: ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={cn(
        'w-full h-12 rounded-full text-sm font-semibold text-white',
        'bg-brand-500 shadow-[0_2px_4px_rgba(28,25,23,0.08),0_10px_22px_-10px_rgba(108,92,231,0.6)]',
        'transition-all duration-200 ease-out',
        'hover:bg-brand-600 hover:-translate-y-0.5 active:scale-[0.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0'
      )}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
