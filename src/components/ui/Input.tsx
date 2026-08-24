import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-[13px] font-semibold text-ink-2 pl-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full rounded-2xl border bg-surface-3 px-4 py-2.5 text-sm text-ink',
            'placeholder:text-ink-4 transition-all duration-200',
            'focus:outline-none focus:bg-white focus:ring-4',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
              : 'border-transparent hover:bg-surface-4/60 focus:border-brand-500 focus:ring-brand-500/15',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs font-medium text-red-500 pl-1">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
