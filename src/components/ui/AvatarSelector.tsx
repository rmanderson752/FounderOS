// src/components/ui/AvatarSelector.tsx
// Sleek avatar picker with cool icons and minimalist gradients

'use client'

import { useState } from 'react'
import { Modal } from './Modal'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

// Cool icons with sleek, muted gradients
const AVATARS = [
  // Vehicles & Transport
  { id: 'rocket', emoji: '🚀', bg: 'from-slate-700 to-slate-900' },
  { id: 'car', emoji: '🏎️', bg: 'from-zinc-700 to-zinc-900' },
  { id: 'ship', emoji: '🚢', bg: 'from-slate-600 to-slate-800' },
  { id: 'plane', emoji: '✈️', bg: 'from-gray-700 to-gray-900' },
  
  // Tech & Gaming
  { id: 'controller', emoji: '🎮', bg: 'from-indigo-800 to-indigo-950' },
  { id: 'robot', emoji: '🤖', bg: 'from-zinc-600 to-zinc-800' },
  { id: 'laptop', emoji: '💻', bg: 'from-slate-600 to-slate-800' },
  { id: 'satellite', emoji: '🛰️', bg: 'from-gray-600 to-gray-800' },
  
  // Nature & Elements
  { id: 'lightning', emoji: '⚡', bg: 'from-amber-800 to-amber-950' },
  { id: 'fire', emoji: '🔥', bg: 'from-orange-800 to-orange-950' },
  { id: 'moon', emoji: '🌙', bg: 'from-indigo-900 to-slate-950' },
  { id: 'mountain', emoji: '🏔️', bg: 'from-slate-700 to-slate-900' },
  
  // Objects & Symbols
  { id: 'diamond', emoji: '💎', bg: 'from-cyan-800 to-cyan-950' },
  { id: 'crown', emoji: '👑', bg: 'from-yellow-800 to-yellow-950' },
  { id: 'target', emoji: '🎯', bg: 'from-rose-800 to-rose-950' },
  { id: 'anchor', emoji: '⚓', bg: 'from-blue-800 to-blue-950' },
  
  // Animals
  { id: 'wolf', emoji: '🐺', bg: 'from-gray-700 to-gray-900' },
  { id: 'eagle', emoji: '🦅', bg: 'from-amber-900 to-stone-900' },
  { id: 'dragon', emoji: '🐉', bg: 'from-emerald-800 to-emerald-950' },
  { id: 'shark', emoji: '🦈', bg: 'from-slate-700 to-slate-900' },
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
                'relative aspect-square rounded-2xl bg-gradient-to-br flex items-center justify-center text-2xl transition-all duration-200 border border-white/5',
                avatar.bg,
                selected === avatar.id 
                  ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#12121A] scale-105 border-white/20' 
                  : 'hover:scale-105 hover:border-white/10'
              )}
            >
              <span className="drop-shadow-lg">{avatar.emoji}</span>
              
              {selected === avatar.id && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <Check className="w-3 h-3 text-[#12121A]" />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary px-4 py-2"
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