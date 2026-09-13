// src/lib/signals/attribute.ts
// Which project does a path belong to? Longest matching root wins. Pure.

export interface ProjectRoots {
  id: string
  repo_path: string | null
  folder_paths: string[] | null
}

function normalisePath(p: string): string {
  return p.replace(/\/+$/, '').toLowerCase()
}

export function projectForPath<T extends ProjectRoots>(projects: T[], cwd: string | null | undefined): T | null {
  if (!cwd) return null
  const target = normalisePath(cwd)
  let best: { project: T; length: number } | null = null
  for (const p of projects) {
    const roots = [p.repo_path, ...(p.folder_paths ?? [])].filter((r): r is string => !!r).map(normalisePath)
    for (const root of roots) {
      if (target === root || target.startsWith(root + '/')) {
        if (!best || root.length > best.length) best = { project: p, length: root.length }
      }
    }
  }
  return best?.project ?? null
}
