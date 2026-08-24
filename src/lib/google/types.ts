// src/lib/google/types.ts
// Types for Google Calendar integration

export interface GoogleTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  colorId?: string
  extendedProperties?: {
    private?: Record<string, string>
  }
}

export interface CalendarEventListResponse {
  items: CalendarEvent[]
  nextPageToken?: string
}

// Google Calendar has 11 preset event color IDs
export const GCAL_COLOR_MAP: Record<string, string> = {
  '#3B82F6': '9',  // blueberry
  '#A855F7': '3',  // grape
  '#F59E0B': '5',  // banana
  '#22C55E': '2',  // sage
  '#EC4899': '4',  // flamingo
  '#EF4444': '11', // tomato
  '#06B6D4': '7',  // peacock
  '#F97316': '6',  // tangerine
  '#8B5CF6': '3',  // grape
  '#14B8A6': '2',  // sage
}

// Default color ID if no match found
export const DEFAULT_GCAL_COLOR = '9'

export function getGcalColorId(hexColor: string): string {
  return GCAL_COLOR_MAP[hexColor] || DEFAULT_GCAL_COLOR
}
