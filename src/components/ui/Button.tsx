// src/components/ui/Button.tsx
// Soft Paper buttons — pill shaped, springy press, gentle coloured shadow

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  glow?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, glow = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-full ' +
      'transition-[transform,box-shadow,background-color,color] duration-200 ease-out ' +
      'active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed ' +
      'disabled:hover:translate-y-0 disabled:active:scale-100'

    const variants = {
      primary:
        'bg-brand-500 text-white shadow-[0_1px_2px_rgba(28,25,23,0.08),0_8px_18px_-8px_rgba(108,92,231,0.55)] ' +
        'hover:bg-brand-600 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(28,25,23,0.08),0_14px_26px_-10px_rgba(108,92,231,0.55)]',
      secondary:
        'bg-white text-ink border border-line shadow-xs ' +
        'hover:border-line-strong hover:-translate-y-0.5 hover:shadow-sm',
      soft:
        'bg-brand-50 text-brand-600 hover:bg-brand-100 hover:-translate-y-0.5',
      ghost:
        'bg-transparent text-ink-3 hover:bg-ink/[0.05] hover:text-ink',
      danger:
        'bg-red-500 text-white shadow-[0_1px_2px_rgba(28,25,23,0.08),0_8px_18px_-8px_rgba(240,68,56,0.55)] ' +
        'hover:bg-red-600 hover:-translate-y-0.5',
      success:
        'bg-emerald-500 text-white shadow-[0_1px_2px_rgba(28,25,23,0.08),0_8px_18px_-8px_rgba(18,183,106,0.55)] ' +
        'hover:bg-emerald-600 hover:-translate-y-0.5',
    }

    const sizes = {
      sm: 'px-4 py-1.5 text-[13px]',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-7 py-3 text-base',
    }

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          glow && variant === 'primary' && 'animate-pulse-glow',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading…
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
