import { format, startOfWeek, endOfWeek, isToday, isYesterday } from 'date-fns'

/**
 * Format a date for display
 */
export function formatDate(date: Date | string, pattern = 'MMM d, yyyy'): string {
  return format(new Date(date), pattern)
}

/**
 * Format date for API (YYYY-MM-DD)
 */
export function formatDateForApi(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Get a friendly date string
 */
export function getFriendlyDate(date: Date | string): string {
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, MMM d')
}

/**
 * Get the start of the current week (Monday)
 */
export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/**
 * Get the end of the current week (Sunday)
 */
export function getWeekEnd(date: Date = new Date()): Date {
  return endOfWeek(date, { weekStartsOn: 1 })
}

/**
 * Get week label string
 */
export function getWeekLabel(date: Date): string {
  const start = getWeekStart(date)
  const end = getWeekEnd(date)
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
}
