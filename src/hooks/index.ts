// src/hooks/index.ts
export { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from './useProjects'
export { useSchedule, useSaveSchedule, useTotalWeeklyHours } from './useSchedule'
export { useWeekTemplate, useSaveTemplate, useAddBlock, useUpdateBlock, useDeleteBlock } from './useWeekTemplate'
export { useDailyBlock, useBlockTasks } from './useDailyBlock'
export {
  useWeeklySnapshot,
  useSaveSnapshot,
  useSnapshotHistory,
  useActualHoursForWeek,
  getPlannedHoursFromTemplate,
} from './useReview'
export type { WeeklySnapshot, CreateSnapshotInput } from './useReview'
export * from './useDayCalendar'
