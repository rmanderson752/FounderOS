'use client'

import { forwardRef, InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, checked, onChange, ...props }, ref) => {
    return (
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'w-5 h-5 rounded-md border-2 transition-colors',
              'bg-transparent group-hover:border-gray-500',
              checked
                ? 'bg-blue-600 border-blue-600'
                : 'border-border-default',
              className
            )}
          />
          <Check
            className={cn(
              'absolute inset-0 w-5 h-5 text-white p-0.5 transition-opacity',
              checked ? 'opacity-100' : 'opacity-0'
            )}
          />
        </div>
        {label && (
          <span className="text-sm text-white">{label}</span>
        )}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }
