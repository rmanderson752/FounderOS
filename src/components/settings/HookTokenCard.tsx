// src/components/settings/HookTokenCard.tsx
//
// Mint the token the local `fos` CLI uses. Shown once; only its hash is
// stored. Minting again replaces the old token, which is also how you revoke.

'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound, TerminalSquare } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button } from '@/components/ui'

export function HookTokenCard() {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { data } = useQuery<{ configured: boolean }>({
    queryKey: ['hook-token'],
    queryFn: async () => {
      const res = await fetch('/api/settings/hook-token')
      return res.ok ? res.json() : { configured: false }
    },
  })
  const mint = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/hook-token', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create token')
      return (await res.json()) as { token: string }
    },
    onSuccess: (payload) => {
      setToken(payload.token)
      queryClient.invalidateQueries({ queryKey: ['hook-token'] })
    },
  })

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const command = token ? `node tools/fos/index.mjs init --url ${origin} --token ${token}` : null

  const copy = async () => {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // visible below anyway
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TerminalSquare className="w-5 h-5 text-ink-3" />
          <CardTitle>Terminal &amp; hooks</CardTitle>
        </div>
      </CardHeader>
      <div className="space-y-4">
        <p className="text-sm text-ink-3 leading-relaxed">
          The card prints into Claude Code when you open a mapped repo, and commits and sessions are pushed here as
          they happen. One token, minted once; the CLI keeps it in <span className="font-mono">~/.founder/config.json</span>.
        </p>
        {command ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-700">Shown once. Run this from the founder-os repo:</p>
            <pre className="bg-ink text-[#EDEBE6] rounded-2xl p-4 text-[12px] font-mono whitespace-pre-wrap break-all">{command}</pre>
            <Button variant="secondary" size="sm" onClick={copy}>
              <Copy className="w-4 h-4 mr-2" /> {copied ? 'Copied' : 'Copy command'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => mint.mutate()} disabled={mint.isPending}>
              <KeyRound className="w-4 h-4 mr-2" /> {data?.configured ? 'Replace token' : 'Create token'}
            </Button>
            {data?.configured && <span className="text-xs text-ink-4">A token exists. Replacing it revokes the old one.</span>}
          </div>
        )}
      </div>
    </Card>
  )
}
