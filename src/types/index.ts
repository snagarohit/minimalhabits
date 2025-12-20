export interface HabitGroup {
  id: string
  name: string
  visible: boolean
}

export interface Habit {
  id: string
  groupId?: string
  name: string
  color?: string // deprecated - colors are now dynamically assigned based on visible habits
  emoji?: string // shows emoji instead of colored dot
  createdAt: string
}

export interface HabitCompletion {
  habitId: string
  date: string // YYYY-MM-DD format
  value: number // 1 for binary complete, count for counter
}

// Timed entry for day view journaling
// A "day" in day view runs from 4:00 AM to 6:00 AM next day
export interface TimedEntry {
  id: string
  habitId: string
  date: string // YYYY-MM-DD - the logical day (4am start)
  startTime: string // HH:MM (24h format)
  duration: number // minutes
}

export interface HabitData {
  habits: Habit[]
  completions: HabitCompletion[]
  groups: HabitGroup[]
  timedEntries?: TimedEntry[] // Optional for backward compatibility
}

export interface WeekData {
  weekStart: Date
  days: DayData[]
}

export interface DayData {
  date: Date
  dateString: string // YYYY-MM-DD
  dayOfMonth: number
  isToday: boolean
  isCurrentMonth: boolean
  isPrevMonth?: boolean
  month: number
  year: number
}
