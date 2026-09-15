// src/app/api/calendar/callback/route.ts
// The v3 calendar OAuth redirect. Logic lives in lib/calendar/connect.ts so
// the already-registered v2 URI can complete the same flow.

import { NextRequest } from 'next/server'
import { completeCalendarConnection } from '@/lib/calendar/connect'

export async function GET(request: NextRequest) {
  return completeCalendarConnection(request)
}
