'use client'

import { forwardRef, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-[13px] font-semibold text-ink-2 pl-1">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full appearance-none rounded-2xl border bg-surface-3 px-4 py-2.5 pr-11 text-sm text-ink',
              'transition-all duration-200 cursor-pointer',
              'focus:outline-none focus:bg-white focus:ring-4',
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                : 'border-transparent hover:bg-surface-4/60 focus:border-brand-500 focus:ring-brand-500/15',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 pointer-events-none" />
        </div>
        {error && <p className="text-xs font-medium text-red-500 pl-1">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export { Select }
