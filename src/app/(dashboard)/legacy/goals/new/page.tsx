// src/app/(dashboard)/goals/new/page.tsx
// Create new goal page

'use client'

import { GoalSetup } from '@/components/goals/GoalSetup'
import { useCreateGoal } from '@/hooks/useGoals'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

export default function NewGoalPage() {
  const router = useRouter()
  const createGoal = useCreateGoal()
  const { addToast } = useToast()

  return (
    <GoalSetup
      onComplete={async (newGoal) => {
        await createGoal.mutateAsync({
          title: newGoal.title,
          description: newGoal.description,
          deadline: newGoal.deadline,
          status: 'active',
        })
        addToast('Goal created! Let\'s do this.', 'success')
        router.push('/')
      }}
      onCancel={() => router.back()}
    />
  )
}