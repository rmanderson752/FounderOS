// src/components/ui/AvatarSelector.tsx
// Sleek avatar picker with cool icons and minimalist gradients

'use client'

import { useState } from 'react'
import { Modal } from './Modal'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

// Friendly pastel bubbles — soft gradients that sit happily on paper
const AVATARS = [
  // Vehicles & Transport
  { id: 'rocket', emoji: '🚀', bg: 'from-violet-100 to-violet-200' },
  { id: 'car', emoji: '🏎️', bg: 'from-rose-100 to-rose-200' },
  { id: 'ship', emoji: '🚢', bg: 'from-sky-100 to-sky-200' },
  { id: 'plane', emoji: '✈️', bg: 'from-blue-100 to-blue-200' },

  // Tech & Gaming
  { id: 'controller', emoji: '🎮', bg: 'from-indigo-100 to-indigo-200' },
  { id: 'robot', emoji: '🤖', bg: 'from-teal-100 to-teal-200' },
  { id: 'laptop', emoji: '💻', bg: 'from-slate-100 to-slate-200' },
  { id: 'satellite', emoji: '🛰️', bg: 'from-purple-100 to-purple-200' },

  // Nature & Elements
  { id: 'lightning', emoji: '⚡', bg: 'from-amber-100 to-amber-200' },
  { id: 'fire', emoji: '🔥', bg: 'from-orange-100 to-orange-200' },
  { id: 'moon', emoji: '🌙', bg: 'from-indigo-100 to-blue-200' },
  { id: 'mountain', emoji: '🏔️', bg: 'from-sky-100 to-slate-200' },

  // Objects & Symbols
  { id: 'diamond', emoji: '💎', bg: 'from-cyan-100 to-sky-200' },
  { id: 'crown', emoji: '👑', bg: 'from-yellow-100 to-amber-200' },
  { id: 'target', emoji: '🎯', bg: 'from-rose-100 to-pink-200' },
  { id: 'anchor', emoji: '⚓', bg: 'from-blue-100 to-indigo-200' },

  // Animals
  { id: 'wolf', emoji: '🐺', bg: 'from-slate-100 to-slate-200' },
  { id: 'eagle', emoji: '🦅', bg: 'from-amber-100 to-orange-200' },
  { id: 'dragon', emoji: '🐉', bg: 'from-emerald-100 to-teal-200' },
  { id: 'shark', emoji: '🦈', bg: 'from-sky-100 to-cyan-200' },
]

interface AvatarSelectorProps {
  open: boolean
  onClose: () => void
  currentAvatar: string | null
  onSelect: (avatarId: string) => void
}

export function AvatarSelector({ open, onClose, currentAvatar, onSelect }: AvatarSelectorProps) {
  const [selected, setSelected] = useState(currentAvatar)

  const handleSelect = (avatarId: string) => {
    setSelected(avatarId)
  }

  const handleSave = () => {
    if (selected) {
      onSelect(selected)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Choose your avatar" size="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-5 gap-3">
          {AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => handleSelect(avatar.id)}
              className={cn(
                'relative aspect-square rounded-3xl bg-gradient-to-br flex items-center justify-center text-2xl transition-all duration-200 border border-line',
                avatar.bg,
                selected === avatar.id 
                  ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white scale-105 border-transparent' 
                  : 'hover:scale-105 hover:-translate-y-0.5'
              )}
            >
              <span>{avatar.emoji}</span>
              
              {selected === avatar.id && (
                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn-ghost px-5 py-2.5">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary px-5 py-2.5 disabled:opacity-45"
            disabled={!selected}
          >
            Save Avatar
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Helper to get avatar by ID
export function getAvatarById(id: string | null) {
  return AVATARS.find(a => a.id === id) || AVATARS[0]
}

export { AVATARS }