import { useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import type { Habit, HabitCompletion, HabitData, HabitGroup, TimedEntry } from '../types'

const STORAGE_KEY = 'habit-calendar-data'

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

function loadFromStorage(): HabitData {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const parsed = JSON.parse(data)
      return {
        habits: parsed.habits || [],
        completions: parsed.completions || [],
        groups: parsed.groups || [],
        timedEntries: parsed.timedEntries || [],
      }
    }
  } catch (e) {
    console.error('Failed to load habits from localStorage:', e)
  }
  return { habits: [], completions: [], groups: [], timedEntries: [] }
}

function saveToStorage(data: HabitData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
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
  onDataChange?: (data: HabitData) => void
}

export function useHabits(options: UseHabitsOptions = {}) {
  const { onDataChange } = options

  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<HabitCompletion[]>([])
  const [groups, setGroups] = useState<HabitGroup[]>([])
  const [timedEntries, setTimedEntries] = useState<TimedEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const data = loadFromStorage()
    // Migrate habits without groupId to "Ungrouped"
    const migratedHabits = data.habits.map(h =>
      h.groupId ? h : { ...h, groupId: UNGROUPED_GROUP_ID }
    )
    setHabits(migratedHabits)
    setCompletions(data.completions)
    // Ensure "Ungrouped" group always exists
    setGroups(ensureUngroupedGroup(data.groups))
    setTimedEntries(data.timedEntries || [])
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      const data = { habits, completions, groups, timedEntries }
      saveToStorage(data)
      onDataChange?.(data)
    }
  }, [habits, completions, groups, timedEntries, isLoaded, onDataChange])

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
    setTimedEntries(data.timedEntries || [])
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
    return { habits, completions, groups, timedEntries }
  }, [habits, completions, groups, timedEntries])

  // Timed entry management (for day view)
  const addTimedEntry = useCallback((habitId: string, date: string, startTime: string, duration: number) => {
    const newEntry: TimedEntry = {
      id: generateId(),
      habitId,
      date,
      startTime,
      duration,
    }
    setTimedEntries((prev) => [...prev, newEntry])
    return newEntry
  }, [])

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

  // Delete all data (habits, completions, groups, timed entries)
  const deleteAllData = useCallback(() => {
    setHabits([])
    setCompletions([])
    setGroups([])
    setTimedEntries([])
  }, [])

  return {
    habits,
    completions,
    groups,
    timedEntries,
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
  }
}
