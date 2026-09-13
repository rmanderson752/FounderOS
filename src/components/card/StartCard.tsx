// src/components/card/StartCard.tsx
//
// The card on the web. Same text the hook prints and the email carries,
// rendered as a card, with the three corrections underneath: done, partial,
// redirect. "Skipped" is not offered as a button; it exists only as a
// correction the user types, because the default for an unseen block is
// "unobserved", never "skipped".

'use client'

import { useState } from 'react'
import { Check, CornerDownRight, Copy, Minus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardResponse } from '@/hooks/useCard'
import { useResolveBlock } from '@/hooks/useCard'

interface StartCardProps {
  card: CardResponse
  onRedirect: (note: string) => void
  isRefreshing?: boolean
}

export function StartCard({ card, onRedirect, isRefreshing }: StartCardProps) {
  const resolve = useResolveBlock()
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)

  const block = card.block

  const copyStart = async () => {
    if (!block?.startCommand) return
    try {
      await navigator.clipboard.writeText(block.startCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — the command is visible in the card anyway.
    }
  }

  const submitNote = () => {
    const trimmed = note.trim()
    if (!trimmed) return
    onRedirect(trimmed)
    setNote('')
  }

  return (
    <div className="bg-ink text-[#EDEBE6] rounded-3xl shadow-sm p-5 sm:p-6">
      <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words m-0">
        {card.text}
      </pre>

      {block && (
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
          {block.startCommand && (
            <button
              type="button"
              onClick={copyStart}
              className="inline-flex items-center gap-2 rounded-full bg-white text-ink px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              <Copy className="w-4 h-4" strokeWidth={2} />
              {copied ? 'Copied' : 'Copy start command'}
            </button>
          )}

          {block.status === 'planned' ? (
            <>
              <button
                type="button"
                onClick={() => resolve.mutate({ id: block.id, status: 'done' })}
                disabled={resolve.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold hover:bg-white/15 transition-colors"
              >
                <Check className="w-4 h-4" strokeWidth={2} /> Done
              </button>
              <button
                type="button"
                onClick={() => resolve.mutate({ id: block.id, status: 'partial' })}
                disabled={resolve.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold hover:bg-white/15 transition-colors"
              >
                <Minus className="w-4 h-4" strokeWidth={2} /> Partial
              </button>
            </>
          ) : (
            <span className={cn('text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full',
              block.status === 'done' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-white/70')}>
              {block.status}
            </span>
          )}

          <div className="flex-1 min-w-[220px] flex items-center gap-2">
            <CornerDownRight className="w-4 h-4 text-white/40 flex-shrink-0" strokeWidth={2} />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNote()}
              placeholder='Redirect: "shipped sign-in too" or "do voice instead"'
              className="flex-1 bg-transparent border-b border-white/15 focus:border-white/40 outline-none text-sm py-1.5 placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={submitNote}
              disabled={isRefreshing || !note.trim()}
              className="text-white/60 hover:text-white disabled:opacity-40"
              aria-label="Send redirect"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
