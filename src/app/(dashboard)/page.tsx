// src/app/(dashboard)/page.tsx
'use client'

import { DailyView } from '@/components/daily'
import { ReviewPrompt } from '@/components/review'
import { PageTransition } from '@/components/ui'
import { useUser } from '@/hooks/useUser'

export default function DashboardPage() {
  const { data: user } = useUser()

  return (
    <PageTransition>
      <ReviewPrompt reviewDay={user?.review_day ?? 0} />
      <DailyView />
    </PageTransition>
  )
}
