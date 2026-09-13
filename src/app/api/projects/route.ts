// src/app/api/projects/route.ts
//
// Projects are buckets a signal can be attributed to. The CLI's `fos init`
// registers repo paths here; the goal form creates them by name. There is no
// project management screen: a project exists because a goal or a repo does.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await caller.supabase
    .from('projects')
    .select('id, name, repo_path, folder_paths, kind, weight, paused, status')
    .eq('user_id', caller.userId)
    .order('name')
  return NextResponse.json({ projects: data ?? [] })
}

interface ProjectBody {
  name?: string
  repo_path?: string | null
  folder_paths?: string[]
  kind?: 'code' | 'docs' | 'life'
  weight?: number
  paused?: boolean
}

/** Upsert by name (case-insensitive). */
export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as ProjectBody | null
  const name = body?.name?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (body!.repo_path !== undefined) patch.repo_path = body!.repo_path
  if (body!.folder_paths !== undefined) patch.folder_paths = body!.folder_paths
  if (body!.kind !== undefined) patch.kind = body!.kind
  if (body!.weight !== undefined) patch.weight = body!.weight
  if (body!.paused !== undefined) patch.paused = body!.paused

  const { data: existing } = await caller.supabase
    .from('projects')
    .select('id')
    .eq('user_id', caller.userId)
    .ilike('name', name)
    .maybeSingle()

  if (existing) {
    const { data, error } = await caller.supabase
      .from('projects')
      .update(patch)
      .eq('id', existing.id)
      .select('id, name, repo_path, folder_paths, kind, weight, paused')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ project: data, created: false })
  }

  const { data, error } = await caller.supabase
    .from('projects')
    .insert({ user_id: caller.userId, name, ...patch })
    .select('id, name, repo_path, folder_paths, kind, weight, paused')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data, created: true }, { status: 201 })
}
