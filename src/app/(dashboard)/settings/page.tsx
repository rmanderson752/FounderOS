// src/app/(dashboard)/settings/page.tsx
// User settings page - profile, work schedule, and account management

'use client'

import { useState, useEffect } from 'react'
import { Clock, User, Save, Check, Trash2, AlertTriangle, Pencil } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button, Input, Modal, Avatar, AvatarSelector } from '@/components/ui'
import { useUser, useUpdateUser } from '@/hooks/useUser'
import { useActiveGoal } from '@/hooks/useGoals'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

export default function SettingsPage() {
  const router = useRouter()
  const { data: user, isLoading: userLoading } = useUser()
  const { data: goal } = useActiveGoal()
  const updateUser = useUpdateUser()
  const { addToast } = useToast()

  const [name, setName] = useState('')
  const [dailyHours, setDailyHours] = useState(6)
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [saved, setSaved] = useState(false)
  
  // Avatar selector state
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  
  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Load user data into form
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setDailyHours(user.daily_hours_available || 6)
      setWorkDays(user.work_days || [1, 2, 3, 4, 5])
    }
  }, [user])

  const toggleDay = (day: number) => {
    setWorkDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  const handleSave = async () => {
    await updateUser.mutateAsync({
      name,
      daily_hours_available: dailyHours,
      work_days: workDays,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAvatarSelect = async (avatarId: string) => {
    await updateUser.mutateAsync({ avatar_id: avatarId })
    addToast('Avatar updated!', 'success')
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    
    setIsDeleting(true)
    try {
      const supabase = createClient()
      
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        await supabase.from('users').delete().eq('id', authUser.id)
      }
      
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error deleting account:', error)
      setIsDeleting(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Configure your work schedule and preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            <CardTitle>Profile</CardTitle>
          </div>
        </CardHeader>

        <div className="space-y-6">
          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Avatar
            </label>
            <div className="flex items-center gap-4">
              <Avatar 
                size="lg" 
                avatarId={user?.avatar_id} 
              />
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setShowAvatarSelector(true)}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Change Avatar
              </Button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Email
            </label>
            <Input
              value={user?.email || ''}
              disabled
              className="opacity-50"
            />
          </div>
        </div>
      </Card>

      {/* Work Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <CardTitle>Work Schedule</CardTitle>
          </div>
        </CardHeader>

        <div className="space-y-6">
          {/* Daily Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Available hours per day
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={dailyHours}
                onChange={(e) => setDailyHours(parseInt(e.target.value) || 0)}
                min={1}
                max={16}
                className="w-24"
              />
              <span className="text-gray-400">hours</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              How many hours can you dedicate to focused work each day?
            </p>
          </div>

          {/* Work Days */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Work days
            </label>
            <div className="flex gap-2">
              {DAYS_OF_WEEK.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleDay(value)}
                  className={cn(
                    'w-12 h-12 rounded-lg text-sm font-medium transition-all',
                    workDays.includes(value)
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {workDays.length} days × {dailyHours} hours = {workDays.length * dailyHours} hours/week
            </p>
          </div>
        </div>
      </Card>

      {/* Current Goal */}
      {goal && (
        <Card>
          <CardHeader>
            <CardTitle>Current Goal</CardTitle>
          </CardHeader>
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <p className="text-white font-medium">{goal.title}</p>
            <p className="text-sm text-gray-400 mt-1">
              Deadline: {format(new Date(goal.deadline), 'MMM d, yyyy')}
            </p>
          </div>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={updateUser.isPending}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved!
            </>
          ) : updateUser.isPending ? (
            'Saving...'
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Danger Zone */}
      <Card className="border-rose-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <CardTitle className="text-rose-400">Danger Zone</CardTitle>
          </div>
        </CardHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Delete Account</p>
              <p className="text-sm text-gray-400">
                Permanently delete your account and all data. This cannot be undone.
              </p>
            </div>
            <Button 
              variant="danger" 
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </div>
      </Card>

      {/* Avatar Selector Modal */}
      <AvatarSelector
        open={showAvatarSelector}
        onClose={() => setShowAvatarSelector(false)}
        currentAvatar={user?.avatar_id || null}
        onSelect={handleAvatarSelect}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDeleteConfirmText('')
        }}
        title="Delete Account"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-rose-400 font-medium">This action is irreversible</p>
                <p className="text-sm text-gray-400 mt-1">
                  All your data will be permanently deleted, including your goals, tasks, and progress history.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Type <span className="text-rose-400 font-mono">DELETE</span> to confirm
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button 
              variant="ghost" 
              onClick={() => {
                setShowDeleteModal(false)
                setDeleteConfirmText('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              isLoading={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete My Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}