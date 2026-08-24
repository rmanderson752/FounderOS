// src/app/(dashboard)/projects/page.tsx
'use client'

import { ProjectList } from '@/components/projects'
import { PageTransition } from '@/components/ui'

export default function ProjectsPage() {
  return (
    <PageTransition>
      <ProjectList />
    </PageTransition>
  )
}
