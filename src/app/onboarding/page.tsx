'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card } from '@/components/ui'
import { ChevronRight, ChevronLeft, Check, Target, Clock, Calendar, Rocket, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Get started' },
  { id: 'schedule', title: 'Schedule', description: 'Set your availability' },
  { id: 'goal', title: 'Goal', description: 'Set your first goal' },
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    dailyHours: 6,
    workDays: [1, 2, 3, 4, 5],
    goalTitle: '',
    goalDeadline: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
  })

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.name.trim().length > 0
      case 1:
        return formData.dailyHours > 0 && formData.workDays.length > 0
      case 2:
        return formData.goalTitle.trim().length > 0
      default:
        return true
    }
  }

  const handleNext = () => {
    if (!canProceed()) {
      setError('Please fill in the required fields')
      return
    }
    setError(null)
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    setError(null)
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const toggleDay = (day: number) => {
    const newDays = formData.workDays.includes(day)
      ? formData.workDays.filter(d => d !== day)
      : [...formData.workDays, day].sort()
    setFormData({ ...formData, workDays: newDays })
  }

  const handleComplete = async () => {
    if (!canProceed()) {
      setError('Please enter a goal title')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        throw authError
      }
      
      if (!user) {
        router.push('/login')
        return
      }

      // Check if user profile exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (existingUser) {
        // Update existing user
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: formData.name.trim(),
            daily_hours_available: formData.dailyHours,
            work_days: formData.workDays,
            onboarded: true,
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('Update error:', updateError)
          throw updateError
        }
      } else {
        // Insert new user profile
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            name: formData.name.trim(),
            daily_hours_available: formData.dailyHours,
            work_days: formData.workDays,
            onboarded: true,
          })

        if (insertError) {
          console.error('Insert error:', insertError)
          throw insertError
        }
      }

      // Create first goal
      const { error: goalError } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          title: formData.goalTitle.trim(),
          deadline: formData.goalDeadline,
          status: 'active',
        })

      if (goalError) {
        console.error('Goal error:', goalError)
        throw goalError
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
      console.error('Onboarding error:', err)
      setError(err?.message || 'Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  index < currentStep
                    ? 'bg-blue-600 text-white'
                    : index === currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#1A1A1E] text-gray-400'
                )}
              >
                {index < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-12 h-0.5 mx-2',
                    index < currentStep ? 'bg-blue-600' : 'bg-[#1A1A1E]'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <Card className="p-8">
          {/* Step content */}
          {currentStep === 0 && (
            <StepWelcome formData={formData} setFormData={setFormData} />
          )}
          {currentStep === 1 && (
            <StepSchedule formData={formData} setFormData={setFormData} toggleDay={toggleDay} />
          )}
          {currentStep === 2 && (
            <StepGoal formData={formData} setFormData={setFormData} />
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#1F1F23]">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={cn(
                'flex items-center gap-1 text-sm font-medium transition-colors',
                currentStep === 0
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            
            {currentStep < STEPS.length - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete} 
                disabled={isLoading || !canProceed()}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Setting up...
                  </>
                ) : (
                  <>
                    Let's Go!
                    <Rocket className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>

        {/* Skip option for goal step */}
        {currentStep === 2 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Not sure yet?{' '}
            <button 
              onClick={() => {
                setFormData({ ...formData, goalTitle: 'My First Goal' })
                handleComplete()
              }}
              className="text-blue-400 hover:underline"
            >
              Skip for now
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

function StepWelcome({ formData, setFormData }: { formData: any; setFormData: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">Welcome to Founder OS</h2>
        <p className="text-gray-400 mt-2 max-w-sm mx-auto">
          Your personal command center for getting things done. Let's set you up in 60 seconds.
        </p>
      </div>

      <div className="space-y-4 pt-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            What should we call you?
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Your name"
            autoFocus
          />
        </div>
      </div>
    </div>
  )
}

function StepSchedule({ formData, setFormData, toggleDay }: { formData: any; setFormData: (data: any) => void; toggleDay: (day: number) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">When do you work?</h2>
        <p className="text-gray-400 mt-1">We'll use this to pace your tasks realistically</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Hours available per day
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="12"
              value={formData.dailyHours}
              onChange={(e) => setFormData({ ...formData, dailyHours: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-[#1A1A1E] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-2xl font-bold text-white w-16 text-right">{formData.dailyHours}h</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formData.dailyHours <= 4 ? "Light schedule - great for side projects" : 
             formData.dailyHours <= 6 ? "Balanced schedule - sustainable pace" :
             formData.dailyHours <= 8 ? "Full-time focus - ambitious!" :
             "Intense schedule - remember to take breaks!"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Which days do you work?</label>
          <div className="flex gap-2 justify-center">
            {DAYS_OF_WEEK.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={cn(
                  'w-11 h-11 rounded-lg text-sm font-medium transition-all',
                  formData.workDays.includes(value)
                    ? 'bg-blue-500 text-white scale-105'
                    : 'bg-[#1A1A1E] text-gray-400 hover:bg-[#2A2A30]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg text-center border border-blue-500/20">
          <p className="text-3xl font-bold text-white">{formData.workDays.length * formData.dailyHours}h</p>
          <p className="text-sm text-gray-400">available per week</p>
        </div>
      </div>
    </div>
  )
}

function StepGoal({ formData, setFormData }: { formData: any; setFormData: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
          <Target className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">What's your #1 goal?</h2>
        <p className="text-gray-400 mt-1">Focus on one thing at a time for best results</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            I want to...
          </label>
          <Input
            value={formData.goalTitle}
            onChange={(e) => setFormData({ ...formData, goalTitle: e.target.value })}
            placeholder="Launch my MVP, finish the course, ship the feature..."
            autoFocus
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">By when?</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { label: '1 week', days: 7 },
              { label: '2 weeks', days: 14 },
              { label: '1 month', days: 30 },
            ].map(({ label, days }) => (
              <button
                key={label}
                type="button"
                onClick={() => setFormData({ ...formData, goalDeadline: format(addDays(new Date(), days), 'yyyy-MM-dd') })}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg border transition-colors',
                  formData.goalDeadline === format(addDays(new Date(), days), 'yyyy-MM-dd')
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-[#2A2A30] text-gray-400 hover:border-gray-500'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="date"
              value={formData.goalDeadline}
              onChange={(e) => setFormData({ ...formData, goalDeadline: e.target.value })}
              className="pl-10"
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-[#111113] rounded-lg">
        <p className="text-sm text-gray-400">
          💡 <span className="text-gray-300">Pro tip:</span> Break your goal into small tasks after setup. We'll help you stay on track.
        </p>
      </div>
    </div>
  )
}