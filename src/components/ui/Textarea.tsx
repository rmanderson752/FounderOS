import { forwardRef, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs font-medium text-gray-400">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full bg-background-secondary border rounded-lg px-3 py-2 text-sm text-white',
            'placeholder:text-gray-500 resize-none',
            'focus:outline-none focus:ring-1 transition-colors',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-border-default focus:border-blue-500 focus:ring-blue-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea }
