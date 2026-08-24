// src/app/(dashboard)/legacy/page.tsx
// v2 dashboard. Unlinked from navigation in v3; reachable at /legacy by direct URL.
'use client'

import { DailyView } from '@/components/daily'
import { ReviewPrompt } from '@/components/review'
import { PageTransition } from '@/components/ui'
import { useUser } from '@/hooks/useUser'

export default function LegacyDashboardPage() {
  const { data: user } = useUser()

  return (
    <PageTransition>
      <ReviewPrompt reviewDay={user?.review_day ?? 0} />
      <DailyView />
    </PageTransition>
  )
}
