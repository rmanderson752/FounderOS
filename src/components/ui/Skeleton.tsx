// src/components/ui/Skeleton.tsx
// Animated skeleton loading placeholders
// Used to show content structure while data is loading

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-[#1F1F23]',
        className
      )}
    />
  )
}

// Pre-built skeleton components for common patterns
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('bg-[#141417] border border-[#1F1F23] rounded-xl p-5', className)}>
      <Skeleton className="h-5 w-1/3 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  )
}

export function SkeletonTaskList({ count = 3 }: { count?: number }) {
  return (
    <div className="bg-[#141417] border border-[#1F1F23] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="bg-[#141417] border border-[#1F1F23] rounded-xl p-5">
      <Skeleton className="h-5 w-24 mb-4" />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-12" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonProgressBar() {
  return (
    <div className="bg-[#141417] border border-[#1F1F23] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-10" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex justify-between mt-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

export function SkeletonGoalHeader() {
  return (
    <div className="flex items-start justify-between">
      <div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="text-right">
        <Skeleton className="h-4 w-16 mb-2" />
        <Skeleton className="h-6 w-24 mb-1" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonGoalHeader />
      <SkeletonProgressBar />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonTaskList count={4} />
        </div>
        <div className="space-y-6">
          <SkeletonStats />
          <SkeletonTaskList count={3} />
        </div>
      </div>
    </div>
  )
}

export function WeekSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <SkeletonCard className="h-[400px]" />
        </div>
        <div>
          <SkeletonTaskList count={5} />
        </div>
      </div>
    </div>
  )
}

export function ProgressSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24" />
        ))}
      </div>
      <SkeletonCard className="h-64" />
      <SkeletonCard className="h-48" />
    </div>
  )
}