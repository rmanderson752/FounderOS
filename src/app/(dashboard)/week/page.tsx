// src/app/(dashboard)/week/page.tsx
'use client'

import { WeekView } from '@/components/week'
import { PageTransition } from '@/components/ui'

export default function WeekPage() {
  return (
    <PageTransition>
      <WeekView />
    </PageTransition>
  )
}
