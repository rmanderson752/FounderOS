// src/lib/agent/actions.ts
// Parse and execute agent actions from response text

import { createClient } from '@/lib/supabase/server'
import type { AgentAction, TemplateUpdateAction, TaskReorderAction } from './types'

/**
 * Parse ```action blocks from the agent response.
 */
export function parseActions(response: string): AgentAction[] {
  const actions: AgentAction[] = []
  const regex = /```action\s*\n([\s\S]*?)```/g

  let match
  while ((match = regex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())

      if (parsed.type === 'template_update' && Array.isArray(parsed.blocks)) {
        actions.push(parsed as TemplateUpdateAction)
      } else if (parsed.type === 'task_reorder' && parsed.project_id && Array.isArray(parsed.task_ids)) {
        actions.push(parsed as TaskReorderAction)
      }
    } catch {
      // Skip malformed JSON
      console.warn('Failed to parse agent action block:', match[1])
    }
  }

  return actions
}

/**
 * Execute a single agent action.
 * Called when the user clicks "Apply" on a suggested action.
 */
export async function executeAction(
  userId: string,
  action: AgentAction
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    switch (action.type) {
      case 'template_update': {
        // Delete existing template
        const { error: deleteError } = await supabase
          .from('template_blocks')
          .delete()
          .eq('user_id', userId)

        if (deleteError) throw deleteError

        // Insert new blocks
        if (action.blocks.length > 0) {
          const rows = action.blocks.map((block, index) => ({
            user_id: userId,
            project_id: block.project_id,
            day_of_week: block.day_of_week,
            slot: block.slot,
            hours: block.hours,
            position: index,
          }))

          const { error: insertError } = await supabase
            .from('template_blocks')
            .insert(rows)

          if (insertError) throw insertError
        }

        // Trigger calendar sync (fire-and-forget, handled by the client)
        return { success: true }
      }

      case 'task_reorder': {
        // Update task priorities based on the suggested order
        for (let i = 0; i < action.task_ids.length; i++) {
          const { error } = await supabase
            .from('tasks')
            .update({ priority: i + 1 })
            .eq('id', action.task_ids[i])
            .eq('user_id', userId)

          if (error) throw error
        }

        return { success: true }
      }

      default:
        return { success: false, error: 'Unknown action type' }
    }
  } catch (error) {
    console.error('Failed to execute agent action:', error)
    return { success: false, error: String(error) }
  }
}
