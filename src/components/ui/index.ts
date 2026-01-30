// src/components/ui/index.ts
// Barrel export for all UI components

// Core components
export { Button } from './Button'
export type { ButtonProps } from './Button'

export { Card, CardHeader, CardTitle, CardContent } from './Card'
export type { CardProps } from './Card'

export { Input } from './Input'
export { Checkbox } from './Checkbox'
export { Badge } from './Badge'
export { Modal } from './Modal'
export { Select } from './Select'
export { Textarea } from './Textarea'
export { Spinner } from './Spinner'
export { Avatar } from './Avatar'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { ProgressBar } from './ProgressBar'

export { ToastProvider, useToast } from './Toast'

export { 
  Skeleton, 
  SkeletonCard, 
  SkeletonTaskList, 
  SkeletonStats,
  SkeletonProgressBar,
  SkeletonGoalHeader,
  DashboardSkeleton,
  WeekSkeleton,
  ProgressSkeleton,
} from './Skeleton'

export { Confetti } from './Confetti'
export { FocusMode } from './FocusMode'
export { PageTransition } from './PageTransition'
export { AvatarSelector, getAvatarById, AVATARS } from './AvatarSelector'