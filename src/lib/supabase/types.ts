// src/lib/supabase/types.ts
//
// The shape of a Supabase client as this codebase uses it. The generated
// Database type lacks the Views/Functions members supabase-js needs to infer
// query results, so a typed client resolves every row to `never`. Until the
// types are regenerated from a live project, routes use this untyped alias and
// narrow rows themselves — the same convention the v3 routes already follow.

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, 'public', any>
