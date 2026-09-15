// src/lib/week/commitments.ts
// Validation shared by the commitments routes and the CLI.

const KINDS = new Set(['flexible', 'fixed', 'habit', 'chore'])
const TIME = /^\d{2}:\d{2}(:\d{2})?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export interface CommitmentBody {
  title?: string
  kind?: 'flexible' | 'fixed' | 'habit' | 'chore'
  days_of_week?: number[]
  duration_minutes?: number
  fixed_start?: string | null
  fixed_end?: string | null
  due_date?: string | null
  project_id?: string | null
  outcome_id?: string | null
  active?: boolean
  notes?: string | null
}

export function validateCommitment(body: CommitmentBody, partial = false): string | null {
  if (!partial && !body.title?.trim()) return 'title is required'
  if (!partial && (!body.kind || !KINDS.has(body.kind))) return 'kind must be flexible, fixed, habit or chore'
  if (body.kind && !KINDS.has(body.kind)) return 'invalid kind'
  if (body.days_of_week && !body.days_of_week.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return 'days_of_week must be 0–6'
  if (body.duration_minutes !== undefined && (!Number.isInteger(body.duration_minutes) || body.duration_minutes < 5 || body.duration_minutes > 480)) return 'duration_minutes must be 5–480'
  if (body.fixed_start && !TIME.test(body.fixed_start)) return 'fixed_start must be HH:mm'
  if (body.fixed_end && !TIME.test(body.fixed_end)) return 'fixed_end must be HH:mm'
  if (body.due_date && !DATE.test(body.due_date)) return 'due_date must be yyyy-MM-dd'
  if (body.kind === 'fixed' && !partial && (!body.fixed_start || !body.fixed_end)) return 'fixed commitments need fixed_start and fixed_end'
  if (body.kind === 'chore' && !partial && !body.due_date) return 'chores need a due_date'
  if ((body.kind === 'flexible' || body.kind === 'habit' || body.kind === 'fixed') && !partial && (!body.days_of_week || body.days_of_week.length === 0)) return `${body.kind} commitments need days_of_week`
  return null
}

