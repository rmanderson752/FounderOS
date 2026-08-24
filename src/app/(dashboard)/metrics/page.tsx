// src/app/(dashboard)/metrics/page.tsx
'use client'

import { MetricsDashboard } from '@/components/metrics'
import { PageTransition } from '@/components/ui'

export default function MetricsPage() {
  return (
    <PageTransition>
      <MetricsDashboard />
    </PageTransition>
  )
}
