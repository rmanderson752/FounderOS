// src/lib/agent/parse.ts
// Client-safe action parser (no server imports)

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
    }
  }

  return actions
}
