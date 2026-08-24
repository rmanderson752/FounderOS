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
      <label className="flex items-center gap-3 cursor-pointer group select-none">
        <div className="relative w-[22px] h-[22px]">
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
              'w-[22px] h-[22px] rounded-[9px] border-2 transition-all duration-200 ease-out',
              checked
                ? 'bg-brand-500 border-brand-500 scale-100'
                : 'bg-white border-line-strong group-hover:border-brand-300 group-active:scale-90',
              className
            )}
          />
          <Check
            strokeWidth={3.25}
            className={cn(
              'absolute inset-0 w-[22px] h-[22px] text-white p-[3px] transition-all duration-200',
              checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            )}
          />
        </div>
        {label && <span className="text-sm text-ink">{label}</span>}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }
