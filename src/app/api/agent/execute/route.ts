// src/app/api/agent/execute/route.ts
// Execute an agent action (template update, task reorder)

import { createClient } from '@/lib/supabase/server'
import { executeAction } from '@/lib/agent/actions'
import type { AgentAction } from '@/lib/agent/types'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { action } = (await request.json()) as { action: AgentAction }

    if (!action || !action.type) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const result = await executeAction(user.id, action)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Execute action error:', error)
    return NextResponse.json(
      { error: 'Execution failed', details: String(error) },
      { status: 500 }
    )
  }
}
