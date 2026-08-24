'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui'
import { ProjectColorPicker } from '@/components/projects/ProjectColorPicker'
import { PROJECT_COLORS, DEFAULT_PROJECT_COLOR, DAY_NAMES } from '@/lib/constants'
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  X,
  Rocket,
  FolderOpen,
  Clock,
  Calendar,
  ListTodo,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'projects', title: 'Projects', icon: FolderOpen },
  { id: 'schedule', title: 'Schedule', icon: Clock },
  { id: 'template', title: 'Plan', icon: Calendar },
  { id: 'tasks', title: 'Tasks', icon: ListTodo },
]

interface ProjectDraft {
  name: string
  color: string
  weekly_hours: number
}

interface DaySchedule {
  available_hours: number
  is_available: boolean
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Projects
  const [projects, setProjects] = useState<ProjectDraft[]>([])
  const [addingProject, setAddingProject] = useState(false)
  const [newProject, setNewProject] = useState<ProjectDraft>({
    name: '',
    color: DEFAULT_PROJECT_COLOR,
    weekly_hours: 8,
  })

  // Step 2: Schedule
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    DAY_NAMES.map((_, i) => ({
      available_hours: i >= 1 && i <= 5 ? 8 : 0,
      is_available: i >= 1 && i <= 5,
    }))
  )

  // Step 3: Template — auto-generated, user can adjust
  // We'll auto-distribute projects across available days

  // Step 4: Tasks for first project
  const [tasks, setTasks] = useState<string[]>([])
  const [newTask, setNewTask] = useState('')

  const totalWeeklyHours = schedule.reduce(
    (sum, d) => sum + (d.is_available ? d.available_hours : 0),
    0
  )
  const totalProjectHours = projects.reduce((sum, p) => sum + p.weekly_hours, 0)

  const canProceed = () => {
    switch (step) {
      case 0:
        return projects.length > 0
      case 1:
        return totalWeeklyHours > 0
      case 2:
        return true // Template step is optional
      case 3:
        return true // Tasks step is optional
      default:
        return true
    }
  }

  const addProject = () => {
    if (!newProject.name.trim()) return
    setProjects([...projects, { ...newProject, name: newProject.name.trim() }])

    // Pick next unused color
    const usedColors = new Set([...projects.map((p) => p.color), newProject.color])
    const nextColor = PROJECT_COLORS.find((c) => !usedColors.has(c)) || DEFAULT_PROJECT_COLOR

    setNewProject({ name: '', color: nextColor, weekly_hours: 8 })
    setAddingProject(false)
  }

  const removeProject = (index: number) => {
    setProjects(projects.filter((_, i) => i !== index))
  }

  const addTask = () => {
    if (!newTask.trim()) return
    setTasks([...tasks, newTask.trim()])
    setNewTask('')
  }

  // Auto-generate template blocks from projects + schedule
  const generateTemplate = () => {
    const availableDays = schedule
      .map((d, i) => ({ day: i, hours: d.available_hours }))
      .filter((d) => d.hours > 0)

    if (availableDays.length === 0 || projects.length === 0) return []

    const blocks: {
      project_index: number
      day_of_week: number
      hours: number
      position: number
    }[] = []

    // Simple round-robin: assign each project to days proportionally
    const remaining = projects.map((p) => p.weekly_hours)
    let dayIdx = 0

    for (let pIdx = 0; pIdx < projects.length; pIdx++) {
      while (remaining[pIdx] > 0 && dayIdx < availableDays.length * 3) {
        const day = availableDays[dayIdx % availableDays.length]
        const dayAllocated = blocks
          .filter((b) => b.day_of_week === day.day)
          .reduce((s, b) => s + b.hours, 0)
        const dayFree = day.hours - dayAllocated

        if (dayFree > 0) {
          const hrs = Math.min(remaining[pIdx], dayFree)
          const pos = blocks.filter((b) => b.day_of_week === day.day).length
          blocks.push({ project_index: pIdx, day_of_week: day.day, hours: hrs, position: pos })
          remaining[pIdx] -= hrs
        }
        dayIdx++
      }
    }

    return blocks
  }

  const templateBlocks = generateTemplate()

  const handleComplete = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 1. Update user profile
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()

      const userPayload = {
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Founder',
        onboarded: true,
      }

      if (existingUser) {
        await supabase.from('users').update(userPayload).eq('id', user.id)
      } else {
        await supabase.from('users').insert({ id: user.id, email: user.email!, ...userPayload })
      }

      // 2. Create projects
      const projectIds: string[] = []
      for (let i = 0; i < projects.length; i++) {
        const { data, error: pErr } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            name: projects[i].name,
            color: projects[i].color,
            weekly_hours: projects[i].weekly_hours,
            priority: i,
            status: 'active',
          })
          .select('id')
          .single()

        if (pErr) throw pErr
        projectIds.push(data.id)
      }

      // 3. Save schedule constraints
      const scheduleRows = schedule.map((d, i) => ({
        user_id: user.id,
        day_of_week: i,
        available_hours: d.available_hours,
        is_available: d.is_available,
      }))
      const { error: sErr } = await supabase
        .from('schedule_constraints')
        .upsert(scheduleRows, { onConflict: 'user_id,day_of_week' })
      if (sErr) throw sErr

      // 4. Save template blocks
      if (templateBlocks.length > 0) {
        const blockRows = templateBlocks.map((b) => ({
          user_id: user.id,
          project_id: projectIds[b.project_index],
          day_of_week: b.day_of_week,
          slot: 'full' as const,
          hours: b.hours,
          position: b.position,
        }))
        const { error: tErr } = await supabase.from('template_blocks').insert(blockRows)
        if (tErr) throw tErr
      }

      // 5. Create tasks for first project
      if (tasks.length > 0 && projectIds.length > 0) {
        const taskRows = tasks.map((title, i) => ({
          user_id: user.id,
          project_id: projectIds[0],
          title,
          status: 'todo' as const,
          estimated_minutes: 0,
          priority: i,
        }))
        const { error: taskErr } = await supabase.from('tasks').insert(taskRows)
        if (taskErr) throw taskErr
      }

      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  i < step
                    ? 'bg-blue-600 text-white'
                    : i === step
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-3 text-ink-3'
                )}
              >
                {i < step ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn('w-10 h-0.5 mx-1.5', i < step ? 'bg-blue-600' : 'bg-surface-3')}
                />
              )}
            </div>
          ))}
        </div>

        <Card className="p-8">
          {/* Step 1: Projects */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-ink">What are you working on?</h2>
                <p className="text-sm text-ink-3 mt-1">
                  Add the projects that need your time each week.
                </p>
              </div>

              {/* Project list */}
              <div className="space-y-2">
                {projects.map((project, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 bg-canvas border border-line rounded-lg"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="text-sm text-ink font-medium flex-1">{project.name}</span>
                    <span className="text-xs text-ink-4">{project.weekly_hours}h/wk</span>
                    <button
                      onClick={() => removeProject(i)}
                      className="p-1 text-ink-4 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add project form */}
              {addingProject ? (
                <div className="space-y-3 p-4 bg-canvas border border-line rounded-xl">
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    placeholder="Project name"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && addProject()}
                    className="w-full bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <ProjectColorPicker
                    value={newProject.color}
                    onChange={(c) => setNewProject({ ...newProject, color: c })}
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={newProject.weekly_hours}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          weekly_hours: Math.max(1, parseFloat(e.target.value) || 0),
                        })
                      }
                      min="1"
                      max="40"
                      step="0.5"
                      className="w-20 bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <span className="text-xs text-ink-3">hours/week</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAddingProject(false)}
                      className="flex-1 bg-transparent border border-line-strong hover:bg-surface-3 text-ink font-medium text-sm px-3 py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addProject}
                      disabled={!newProject.name.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm px-3 py-2 rounded-full transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingProject(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-line-strong text-ink-3 hover:text-ink hover:border-line-strong transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Project
                </button>
              )}

              {projects.length > 0 && (
                <div className="text-center text-xs text-ink-4">
                  {totalProjectHours}h/week across {projects.length} project
                  {projects.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Schedule */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-ink">When do you work?</h2>
                <p className="text-sm text-ink-3 mt-1">
                  Set your available hours for each day.
                </p>
              </div>

              <div className="space-y-2">
                {schedule.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      day.is_available
                        ? 'bg-canvas border-line'
                        : 'bg-canvas border-line opacity-50'
                    )}
                  >
                    <button
                      onClick={() => {
                        const updated = [...schedule]
                        updated[i] = { ...day, is_available: !day.is_available }
                        setSchedule(updated)
                      }}
                      className={cn(
                        'w-10 h-6 rounded-full transition-colors flex-shrink-0 relative',
                        day.is_available ? 'bg-blue-600' : 'bg-surface-3'
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full bg-white absolute top-1 transition-transform',
                          day.is_available ? 'translate-x-5' : 'translate-x-1'
                        )}
                      />
                    </button>
                    <span className="text-sm font-medium text-ink w-20">{DAY_NAMES[i]}</span>
                    {day.is_available ? (
                      <>
                        <input
                          type="number"
                          value={day.available_hours}
                          onChange={(e) => {
                            const updated = [...schedule]
                            updated[i] = {
                              ...day,
                              available_hours: Math.max(0, Math.min(16, parseFloat(e.target.value) || 0)),
                            }
                            setSchedule(updated)
                          }}
                          min="0"
                          max="16"
                          step="0.5"
                          className="w-16 bg-canvas border border-line-strong rounded-md px-2 py-1 text-sm text-ink text-center focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <span className="text-xs text-ink-4">hours</span>
                      </>
                    ) : (
                      <span className="text-xs text-ink-4">Off</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-canvas border border-line rounded-lg text-center">
                <span className="text-2xl font-semibold text-ink">{totalWeeklyHours}h</span>
                <span className="text-sm text-ink-3 ml-2">available per week</span>
                {totalProjectHours > totalWeeklyHours && (
                  <p className="text-xs text-amber-400 mt-1">
                    Your projects need {totalProjectHours}h — {totalProjectHours - totalWeeklyHours}h over budget
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Template preview */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-ink">Your weekly plan</h2>
                <p className="text-sm text-ink-3 mt-1">
                  We auto-assigned your projects. You can adjust this later.
                </p>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
                  const dayBlocks = templateBlocks.filter((b) => b.day_of_week === dayOfWeek)
                  const daySchedule = schedule[dayOfWeek]

                  return (
                    <div
                      key={dayOfWeek}
                      className={cn(
                        'rounded-lg border p-2 min-h-[80px]',
                        daySchedule.is_available && daySchedule.available_hours > 0
                          ? 'border-line bg-canvas'
                          : 'border-line bg-canvas opacity-40'
                      )}
                    >
                      <span className="text-[10px] font-semibold text-ink-3 block mb-1">
                        {DAY_NAMES[dayOfWeek].slice(0, 3)}
                      </span>
                      <div className="space-y-1">
                        {dayBlocks.map((block, bi) => (
                          <div
                            key={bi}
                            className="rounded px-1.5 py-1 text-[10px]"
                            style={{
                              backgroundColor: `${projects[block.project_index]?.color}20`,
                              borderLeft: `2px solid ${projects[block.project_index]?.color}`,
                            }}
                          >
                            <span className="text-ink font-medium truncate block">
                              {projects[block.project_index]?.name}
                            </span>
                            <span className="text-ink-4">{block.hours}h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-ink-4 text-center">
                You can customize this in detail from the Week view after setup.
              </p>
            </div>
          )}

          {/* Step 4: Tasks */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-ink">What&apos;s first?</h2>
                <p className="text-sm text-ink-3 mt-1">
                  Add a few tasks for{' '}
                  <span className="text-ink font-medium">
                    {projects[0]?.name || 'your first project'}
                  </span>
                  . Optional — you can add more later.
                </p>
              </div>

              <div className="space-y-2">
                {tasks.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 bg-canvas border border-line rounded-lg"
                  >
                    <div className="w-4 h-4 rounded border border-line-strong flex-shrink-0" />
                    <span className="text-sm text-ink flex-1">{task}</span>
                    <button
                      onClick={() => setTasks(tasks.filter((_, j) => j !== i))}
                      className="p-1 text-ink-4 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  addTask()
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Add a task..."
                  autoFocus
                  className="flex-1 bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newTask.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-3 py-2 rounded-full transition-colors"
                >
                  Add
                </button>
              </form>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-line">
            <button
              onClick={() => {
                setError(null)
                setStep((s) => s - 1)
              }}
              disabled={step === 0}
              className={cn(
                'flex items-center gap-1 text-sm font-medium transition-colors',
                step === 0 ? 'text-ink-4 cursor-not-allowed' : 'text-ink-3 hover:text-ink'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => {
                  if (!canProceed()) {
                    setError('Add at least one project to continue')
                    return
                  }
                  setError(null)
                  setStep((s) => s + 1)
                }}
                disabled={!canProceed()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm px-4 py-2 rounded-full transition-colors flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 rounded-full transition-colors flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-ink"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Setting up...
                  </>
                ) : (
                  <>
                    Let&apos;s Go!
                    <Rocket className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </Card>

        {/* Skip option on tasks step */}
        {step === 3 && tasks.length === 0 && (
          <p className="text-center text-sm text-ink-4 mt-4">
            No tasks yet?{' '}
            <button onClick={handleComplete} className="text-blue-400 hover:underline">
              Skip and finish setup
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
