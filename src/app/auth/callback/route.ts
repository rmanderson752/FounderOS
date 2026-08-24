import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Log what we received
  console.log('Callback received:', { code: code ? 'yes' : 'no', error, error_description })

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${error_description || error}`, requestUrl.origin))
  }

  if (code) {
    const supabase = await createClient()
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (sessionError) {
      console.log('Session error:', sessionError.message)
      return NextResponse.redirect(new URL(`/login?error=${sessionError.message}`, requestUrl.origin))
    }
    
    // Success!
    return NextResponse.redirect(new URL('/', requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/login?error=no_code', requestUrl.origin))
}