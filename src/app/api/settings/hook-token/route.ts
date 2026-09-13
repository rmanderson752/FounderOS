// src/app/api/settings/hook-token/route.ts
//
// Mint the bearer token the local fos CLI and hooks use. Session auth only —
// a token must not be able to mint another. The plaintext is returned once;
// only its hash is stored. Minting again replaces the old token.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateToken, hashToken } from '@/lib/auth/request'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const token = generateToken()
  const { error } = await supabase.from('users').update({ hook_token_hash: hashToken(token) }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ token })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await supabase.from('users').select('hook_token_hash').eq('id', user.id).maybeSingle()
  return NextResponse.json({ configured: !!data?.hook_token_hash })
}
