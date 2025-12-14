import { useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import type { Habit, HabitCompletion, HabitData, HabitGroup } from '../types'
import { HABIT_COLORS } from '../types'

const STORAGE_KEY = 'habit-calendar-data'

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
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
      }
    }
  } catch (e) {
    console.error('Failed to load habits from localStorage:', e)
  }
  return { habits: [], completions: [], groups: [] }
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
  color?: string
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
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const data = loadFromStorage()
    setHabits(data.habits)
    setCompletions(data.completions)
    setGroups(data.groups)
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      const data = { habits, completions, groups }
      saveToStorage(data)
      onDataChange?.(data)
    }
  }, [habits, completions, groups, isLoaded, onDataChange])

  // Load all data from external source (for cloud sync)
  const loadAllData = useCallback((data: HabitData) => {
    setHabits(data.habits)
    setCompletions(data.completions)
    setGroups(data.groups)
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
    setGroups((prev) => prev.filter((g) => g.id !== id))
    // Remove groupId from habits in this group
    setHabits((prev) =>
      prev.map((h) => (h.groupId === id ? { ...h, groupId: undefined } : h))
    )
  }, [])

  const toggleGroupVisibility = useCallback((id: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, visible: !g.visible } : g))
    )
  }, [])

  // Habit management
  const addHabit = useCallback((options: AddHabitOptions) => {
    const usedColors = new Set(habits.map((h) => h.color))
    const availableColor = options.color ||
      HABIT_COLORS.find((c) => !usedColors.has(c)) ||
      HABIT_COLORS[habits.length % HABIT_COLORS.length]

    const newHabit: Habit = {
      id: generateId(),
      name: options.name,
      color: availableColor,
      emoji: options.emoji,
      groupId: options.groupId,
      createdAt: new Date().toISOString(),
    }

    setHabits((prev) => [...prev, newHabit])
    return newHabit
  }, [habits])

  const updateHabit = useCallback((id: string, updates: Partial<Omit<Habit, 'id' | 'createdAt'>>) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    )
  }, [])

  const deleteHabit = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id))
    setCompletions((prev) => prev.filter((c) => c.habitId !== id))
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
      const completion = completions.find(
        (c) => c.habitId === habitId && c.date === date
      )
      return completion?.value || 0
    },
    [completions]
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
      if (!habit.groupId) return true // Ungrouped habits always visible
      const group = groups.find((g) => g.id === habit.groupId)
      return group ? group.visible : true
    })
  }, [habits, groups])

  // Get all data as HabitData object
  const getAllData = useCallback((): HabitData => {
    return { habits, completions, groups }
  }, [habits, completions, groups])

  return {
    habits,
    completions,
    groups,
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
  }
}
