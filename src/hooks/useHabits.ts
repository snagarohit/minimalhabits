import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subDays } from 'date-fns'
import type { Habit, HabitCompletion, HabitData, HabitGroup, TimedEntry, ActiveTimer } from '../types'

const STORAGE_KEY_PREFIX = 'habit-calendar-data'
const LOCAL_STORAGE_KEY = 'habit-calendar-data' // For non-authenticated users

// Special ID for the default "Ungrouped" group
export const UNGROUPED_GROUP_ID = 'ungrouped'

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function ensureUngroupedGroup(groups: HabitGroup[]): HabitGroup[] {
  const hasUngrouped = groups.some(g => g.id === UNGROUPED_GROUP_ID)
  if (!hasUngrouped) {
    return [
      { id: UNGROUPED_GROUP_ID, name: 'Ungrouped', visible: true },
      ...groups
    ]
  }
  return groups
}

// Helper to convert HH:MM to minutes from midnight
function timeToMinutesStatic(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Helper to convert minutes to HH:MM
function minutesToTimeStatic(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Merge overlapping/touching timed entries for the same habit and date
function mergeOverlappingEntries(entries: TimedEntry[]): TimedEntry[] {
  if (entries.length === 0) return entries

  // Group entries by habitId and date
  const groups = new Map<string, TimedEntry[]>()
  for (const entry of entries) {
    const key = `${entry.habitId}:${entry.date}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(entry)
  }

  const result: TimedEntry[] = []

  for (const [, groupEntries] of groups) {
    if (groupEntries.length === 1) {
      result.push(groupEntries[0])
      continue
    }

    // Sort by start time
    const sorted = [...groupEntries].sort((a, b) =>
      timeToMinutesStatic(a.startTime) - timeToMinutesStatic(b.startTime)
    )

    // Merge overlapping entries
    const merged: TimedEntry[] = []
    let current = sorted[0]

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]
      const currentEnd = timeToMinutesStatic(current.startTime) + current.duration
      const nextStart = timeToMinutesStatic(next.startTime)

      if (currentEnd >= nextStart) {
        // Overlapping or touching - merge
        const nextEnd = nextStart + next.duration
        const mergedEnd = Math.max(currentEnd, nextEnd)
        current = {
          id: current.id, // Keep first entry's id
          habitId: current.habitId,
          date: current.date,
          startTime: current.startTime,
          duration: mergedEnd - timeToMinutesStatic(current.startTime),
        }
      } else {
        // No overlap - push current and move to next
        merged.push(current)
        current = next
      }
    }
    merged.push(current)
    result.push(...merged)
  }

  return result
}

// Only keep one active timer per habit (the one with earliest start)
function deduplicateActiveTimers(timers: ActiveTimer[]): ActiveTimer[] {
  const byHabit = new Map<string, ActiveTimer>()
  for (const timer of timers) {
    const existing = byHabit.get(timer.habitId)
    if (!existing || timer.startTimestamp < existing.startTimestamp) {
      byHabit.set(timer.habitId, timer)
    }
  }
  return Array.from(byHabit.values())
}

function getStorageKey(userId?: string): string {
  if (!userId) return LOCAL_STORAGE_KEY
  // Use email as namespace (sanitize for storage key)
  const sanitizedId = userId.replace(/[^a-zA-Z0-9@._-]/g, '_')
  return `${STORAGE_KEY_PREFIX}-${sanitizedId}`
}

function loadFromStorage(storageKey: string): HabitData {
  if (typeof window === 'undefined') {
    return { habits: [], completions: [], groups: [], timedEntries: [], activeTimers: [] }
  }
  try {
    const data = localStorage.getItem(storageKey)
    if (data) {
      const parsed = JSON.parse(data)
      return {
        habits: parsed.habits || [],
        completions: parsed.completions || [],
        groups: parsed.groups || [],
        // Normalize on load: merge overlapping entries, deduplicate timers
        timedEntries: mergeOverlappingEntries(parsed.timedEntries || []),
        activeTimers: deduplicateActiveTimers(parsed.activeTimers || []),
      }
    }
  } catch (e) {
    console.error('Failed to load habits from localStorage:', e)
  }
  return { habits: [], completions: [], groups: [], timedEntries: [], activeTimers: [] }
}

function saveToStorage(storageKey: string, data: HabitData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save habits to localStorage:', e)
  }
}

export interface AddHabitOptions {
  name: string
  groupId?: string
  emoji?: string
}

export interface UseHabitsOptions {
  userId?: string // User's email for multi-user support
  onDataChange?: (data: HabitData) => void
}

export function useHabits(options: UseHabitsOptions = {}) {
  const { userId, onDataChange } = options

  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<HabitCompletion[]>([])
  const [groups, setGroups] = useState<HabitGroup[]>([])
  const [timedEntries, setTimedEntries] = useState<TimedEntry[]>([])
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Track current storage key
  const storageKeyRef = useRef<string>(getStorageKey(userId))

  // Load data when userId changes (user signs in/out or switches accounts)
  useEffect(() => {
    const newStorageKey = getStorageKey(userId)
    storageKeyRef.current = newStorageKey

    const data = loadFromStorage(newStorageKey)
    // Migrate habits without groupId to "Ungrouped"
    const migratedHabits = data.habits.map(h =>
      h.groupId ? h : { ...h, groupId: UNGROUPED_GROUP_ID }
    )
    setHabits(migratedHabits)
    setCompletions(data.completions)
    // Ensure "Ungrouped" group always exists
    setGroups(ensureUngroupedGroup(data.groups))
    setTimedEntries(data.timedEntries || [])
    setActiveTimers(data.activeTimers || [])
    setIsLoaded(true)
  }, [userId])

  useEffect(() => {
    if (isLoaded) {
      const data = { habits, completions, groups, timedEntries, activeTimers }
      saveToStorage(storageKeyRef.current, data)
      onDataChange?.(data)
    }
  }, [habits, completions, groups, timedEntries, activeTimers, isLoaded, onDataChange])

  // Load all data from external source (for cloud sync)
  const loadAllData = useCallback((data: HabitData) => {
    // Migrate habits without groupId to "Ungrouped"
    const migratedHabits = data.habits.map(h =>
      h.groupId ? h : { ...h, groupId: UNGROUPED_GROUP_ID }
    )
    setHabits(migratedHabits)
    setCompletions(data.completions)
    // Ensure "Ungrouped" group always exists
    setGroups(ensureUngroupedGroup(data.groups))
    // Normalize: merge overlapping entries, deduplicate timers
    setTimedEntries(mergeOverlappingEntries(data.timedEntries || []))
    setActiveTimers(deduplicateActiveTimers(data.activeTimers || []))
  }, [])

  // Group management
  const addGroup = useCallback((name: string) => {
    const newGroup: HabitGroup = {
      id: generateId(),
      name,
      visible: true,
    }
    setGroups((prev) => [...prev, newGroup])
    return newGroup
  }, [])

  const updateGroup = useCallback((id: string, updates: Partial<Omit<HabitGroup, 'id'>>) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
    )
  }, [])

  const deleteGroup = useCallback((id: string) => {
    // Prevent deletion of "Ungrouped" group
    if (id === UNGROUPED_GROUP_ID) return

    setGroups((prev) => prev.filter((g) => g.id !== id))
    // Move habits to "Ungrouped" group instead of removing groupId
    setHabits((prev) =>
      prev.map((h) => (h.groupId === id ? { ...h, groupId: UNGROUPED_GROUP_ID } : h))
    )
  }, [])

  const toggleGroupVisibility = useCallback((id: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, visible: !g.visible } : g))
    )
  }, [])

  // Habit management
  const addHabit = useCallback((options: AddHabitOptions) => {
    const newHabit: Habit = {
      id: generateId(),
      name: options.name,
      emoji: options.emoji,
      // Default to "Ungrouped" if no group specified
      groupId: options.groupId || UNGROUPED_GROUP_ID,
      createdAt: new Date().toISOString(),
    }

    setHabits((prev) => [...prev, newHabit])
    return newHabit
  }, [])

  const updateHabit = useCallback((id: string, updates: Partial<Omit<Habit, 'id' | 'createdAt'>>) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    )
  }, [])

  const deleteHabit = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id))
    setCompletions((prev) => prev.filter((c) => c.habitId !== id))
    setTimedEntries((prev) => prev.filter((e) => e.habitId !== id))
    setActiveTimers((prev) => prev.filter((t) => t.habitId !== id))
  }, [])

  // Completion management
  const setCompletion = useCallback((habitId: string, date: string, value: number) => {
    setCompletions((prev) => {
      const existing = prev.find((c) => c.habitId === habitId && c.date === date)

      if (value <= 0) {
        return prev.filter((c) => !(c.habitId === habitId && c.date === date))
      }

      if (existing) {
        return prev.map((c) =>
          c.habitId === habitId && c.date === date ? { ...c, value } : c
        )
      }

      return [...prev, { habitId, date, value }]
    })
  }, [])

  const toggleBinary = useCallback((habitId: string, date: string): boolean => {
    const existing = completions.find((c) => c.habitId === habitId && c.date === date)
    const newValue = existing ? 0 : 1
    setCompletion(habitId, date, newValue)
    return newValue === 1
  }, [completions, setCompletion])

  const getCompletionValue = useCallback(
    (habitId: string, date: string): number => {
      // Check regular completions first
      const completion = completions.find(
        (c) => c.habitId === habitId && c.date === date
      )
      if (completion?.value) return completion.value

      // Also check if there are any timed entries for this habit on this date
      // Timed entries count as completion (collapsed to single dot in calendar views)
      const hasTimedEntry = timedEntries.some(
        (e) => e.habitId === habitId && e.date === date
      )
      return hasTimedEntry ? 1 : 0
    },
    [completions, timedEntries]
  )

  const getStreak = useCallback(
    (habitId: string): number => {
      let streak = 0
      let date = new Date()

      const todayStr = format(date, 'yyyy-MM-dd')
      const todayComplete = getCompletionValue(habitId, todayStr) > 0

      if (!todayComplete) {
        date = subDays(date, 1)
      }

      for (let i = 0; i < 365; i++) {
        const dateStr = format(date, 'yyyy-MM-dd')
        const isComplete = getCompletionValue(habitId, dateStr) > 0

        if (isComplete) {
          streak++
          date = subDays(date, 1)
        } else {
          break
        }
      }

      return streak
    },
    [getCompletionValue]
  )

  // Get visible habits (based on group visibility)
  const getVisibleHabits = useCallback(() => {
    return habits.filter((habit) => {
      const group = groups.find((g) => g.id === habit.groupId)
      return group ? group.visible : true
    })
  }, [habits, groups])

  // Get all data as HabitData object
  const getAllData = useCallback((): HabitData => {
    return { habits, completions, groups, timedEntries, activeTimers }
  }, [habits, completions, groups, timedEntries, activeTimers])

  // Helper to convert HH:MM to minutes from midnight
  const timeToMinutes = useCallback((time: string): number => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }, [])

  // Helper to convert minutes to HH:MM
  const minutesToTime = useCallback((minutes: number): string => {
    const h = Math.floor(minutes / 60) % 24
    const m = minutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }, [])

  // Timed entry management (for day view)
  // Automatically merges overlapping/touching entries for the same habit
  const addTimedEntry = useCallback((habitId: string, date: string, startTime: string, duration: number) => {
    const newStartMinutes = timeToMinutes(startTime)
    const newEndMinutes = newStartMinutes + duration

    setTimedEntries((prev) => {
      // Find all entries for same habit/date that overlap or touch the new entry
      const sameHabitEntries = prev.filter(e => e.habitId === habitId && e.date === date)
      const otherEntries = prev.filter(e => !(e.habitId === habitId && e.date === date))

      // Find entries that overlap or touch (end >= start of other)
      const overlapping: TimedEntry[] = []
      const nonOverlapping: TimedEntry[] = []

      for (const entry of sameHabitEntries) {
        const entryStart = timeToMinutes(entry.startTime)
        const entryEnd = entryStart + entry.duration

        // Check if they overlap or touch
        // Two ranges [a,b] and [c,d] overlap/touch if a <= d && c <= b
        if (newStartMinutes <= entryEnd && entryStart <= newEndMinutes) {
          overlapping.push(entry)
        } else {
          nonOverlapping.push(entry)
        }
      }

      if (overlapping.length === 0) {
        // No overlap, just add the new entry
        const newEntry: TimedEntry = {
          id: generateId(),
          habitId,
          date,
          startTime,
          duration,
        }
        return [...prev, newEntry]
      }

      // Merge all overlapping entries into one
      let mergedStart = newStartMinutes
      let mergedEnd = newEndMinutes

      for (const entry of overlapping) {
        const entryStart = timeToMinutes(entry.startTime)
        const entryEnd = entryStart + entry.duration
        mergedStart = Math.min(mergedStart, entryStart)
        mergedEnd = Math.max(mergedEnd, entryEnd)
      }

      const mergedEntry: TimedEntry = {
        id: generateId(),
        habitId,
        date,
        startTime: minutesToTime(mergedStart),
        duration: mergedEnd - mergedStart,
      }

      return [...otherEntries, ...nonOverlapping, mergedEntry]
    })

    // Return a placeholder - the actual entry may be merged
    return { id: '', habitId, date, startTime, duration }
  }, [timeToMinutes, minutesToTime])

  const updateTimedEntry = useCallback((id: string, updates: Partial<Omit<TimedEntry, 'id'>>) => {
    setTimedEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    )
  }, [])

  const deleteTimedEntry = useCallback((id: string) => {
    setTimedEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const getTimedEntriesForDate = useCallback(
    (date: string): TimedEntry[] => {
      return timedEntries.filter((e) => e.date === date)
    },
    [timedEntries]
  )

  // Check if a habit has any timed entries on a date
  const hasTimedEntryForDate = useCallback(
    (habitId: string, date: string): boolean => {
      return timedEntries.some((e) => e.habitId === habitId && e.date === date)
    },
    [timedEntries]
  )

  // Get completions for a date (used by DayView to show quick-logged items)
  const getCompletionsForDate = useCallback(
    (date: string) => {
      return completions.filter((c) => c.date === date && c.value > 0)
    },
    [completions]
  )

  // Active timer management (synced across devices)
  // Only one timer per habit allowed - if timer exists for habit, keep the earlier one
  // If a recent entry exists that touches/overlaps with timer start, continue from entry's start
  const startTimer = useCallback((habitId: string, date: string, startTime: string, customStartTimestamp?: number) => {
    let timestamp = customStartTimestamp ?? Date.now()
    let effectiveStartTime = startTime

    // Check if there's already a timer for this habit
    const existingTimer = activeTimers.find(t => t.habitId === habitId)
    if (existingTimer) {
      // Keep the one with earlier start timestamp (merge by keeping earlier)
      if (existingTimer.startTimestamp <= timestamp) {
        return existingTimer // Already have an earlier timer running
      }
      // New timer is earlier, replace existing
      const newTimer: ActiveTimer = {
        id: generateId(),
        habitId,
        date,
        startTime: effectiveStartTime,
        startTimestamp: timestamp,
      }
      setActiveTimers((prev) => prev.map(t => t.habitId === habitId ? newTimer : t))
      return newTimer
    }

    // Check if there's a recent timed entry for this habit that the timer should continue from
    const newStartMinutes = timeToMinutes(startTime)
    const entriesToMerge: TimedEntry[] = []
    const MERGE_GAP_MINUTES = 15 // Merge if entry ended within 15 minutes of timer start

    for (const entry of timedEntries) {
      if (entry.habitId !== habitId || entry.date !== date) continue

      const entryStart = timeToMinutes(entry.startTime)
      const entryEnd = entryStart + entry.duration

      // If entry ends within gap threshold of timer start (or overlapping), merge
      // This allows "resuming" an entry that ended recently
      if (entryEnd >= newStartMinutes - MERGE_GAP_MINUTES) {
        entriesToMerge.push(entry)
      }
    }

    if (entriesToMerge.length > 0) {
      // Find the earliest start time among entries to merge
      let earliestStartMinutes = newStartMinutes
      for (const entry of entriesToMerge) {
        const entryStart = timeToMinutes(entry.startTime)
        if (entryStart < earliestStartMinutes) {
          earliestStartMinutes = entryStart
          effectiveStartTime = entry.startTime
        }
      }

      // Calculate the timestamp for the earliest start time
      const [h, m] = effectiveStartTime.split(':').map(Number)
      const startDate = new Date()
      startDate.setHours(h, m, 0, 0)
      timestamp = startDate.getTime()

      // Delete the entries that are being merged into the timer
      setTimedEntries((prev) => prev.filter(e =>
        !entriesToMerge.some(toRemove => toRemove.id === e.id)
      ))
    }

    const newTimer: ActiveTimer = {
      id: generateId(),
      habitId,
      date,
      startTime: effectiveStartTime,
      startTimestamp: timestamp,
    }
    setActiveTimers((prev) => [...prev, newTimer])
    return newTimer
  }, [activeTimers, timedEntries, timeToMinutes])

  const stopTimer = useCallback((timerId: string) => {
    const timer = activeTimers.find(t => t.id === timerId)
    setActiveTimers((prev) => prev.filter((t) => t.id !== timerId))
    return timer
  }, [activeTimers])

  const getActiveTimersForHabit = useCallback(
    (habitId: string) => {
      return activeTimers.filter((t) => t.habitId === habitId)
    },
    [activeTimers]
  )

  // Delete all data (habits, completions, groups, timed entries, active timers)
  const deleteAllData = useCallback(() => {
    setHabits([])
    setCompletions([])
    setGroups([])
    setTimedEntries([])
    setActiveTimers([])
  }, [])

  return {
    habits,
    completions,
    groups,
    timedEntries,
    activeTimers,
    isLoaded,
    addGroup,
    updateGroup,
    deleteGroup,
    toggleGroupVisibility,
    addHabit,
    updateHabit,
    deleteHabit,
    setCompletion,
    toggleBinary,
    getCompletionValue,
    getStreak,
    getVisibleHabits,
    loadAllData,
    getAllData,
    deleteAllData,
    addTimedEntry,
    updateTimedEntry,
    deleteTimedEntry,
    getTimedEntriesForDate,
    hasTimedEntryForDate,
    getCompletionsForDate,
    startTimer,
    stopTimer,
    getActiveTimersForHabit,
  }
}
