import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error_description = requestUrl.searchParams.get('error_description')

  // If there's an error from the OAuth provider
  if (error_description) {
    console.error('OAuth error:', error_description)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error_description)}`, requestUrl.origin))
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Session exchange error:', error.message)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
    }

    // Success - redirect to dashboard
    return NextResponse.redirect(new URL('/', requestUrl.origin))
  }

  // No code present
  return NextResponse.redirect(new URL('/login?error=no_code', requestUrl.origin))
}