import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// API routes that authenticate themselves: a CLI/hook bearer token or the
// cron secret. They get no session redirect and no onboarding gate; each
// route resolves its caller and returns 401 on its own.
const SELF_AUTH_PREFIXES = ['/api/card', '/api/signals', '/api/blocks', '/api/jobs', '/api/goals', '/api/calendar/day', '/api/calendar/status', '/api/projects', '/api/week', '/api/commitments', '/api/milestones', '/api/integrations']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (SELF_AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  const { response, user, supabase } = await updateSession(request)

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/signup']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If logged in and trying to access auth pages
  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // If logged in, check if onboarded
  if (user && !pathname.startsWith('/onboarding') && !isPublicRoute) {
    const { data: profile } = await supabase
      .from('users')
      .select('onboarded')
      .eq('id', user.id)
      .single()

    if (profile && !profile.onboarded) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  // If onboarded user tries to access onboarding
  if (user && pathname.startsWith('/onboarding')) {
    const { data: profile } = await supabase
      .from('users')
      .select('onboarded')
      .eq('id', user.id)
      .single()

    if (profile && profile.onboarded) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
