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
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs font-medium text-gray-400">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full appearance-none bg-background-secondary border rounded-lg px-3 py-2 pr-10 text-sm text-white',
              'focus:outline-none focus:ring-1 transition-colors',
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-border-default focus:border-blue-500 focus:ring-blue-500',
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
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export { Select }
